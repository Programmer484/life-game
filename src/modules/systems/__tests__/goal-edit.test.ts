import { describe, expect, it } from 'vitest';
import { GOAL_TEMPLATES, TASKS_PER_TREE } from '../../config/index.ts';
import type { Goal, TaskDef } from '../../config/index.ts';
import { completeNextTask, createGoal } from '../../entities/index.ts';
import { createWorld } from '../../world/index.ts';
import { updateGoalTasks } from '../index.ts';
import type { GameplayState } from '../index.ts';

const BASE_TASKS: TaskDef[] = GOAL_TEMPLATES.sleep.tasks.map((task) => ({ ...task }));

function stateWith(goal: Goal): GameplayState {
  return { world: createWorld(), trees: [], goals: { [goal.id]: goal } };
}

function completeN(goal: Goal, n: number): Goal {
  let g = goal;
  for (let i = 0; i < n; i++) g = completeNextTask(g);
  return g;
}

describe('systems / updateGoalTasks', () => {
  it('replaces the task list and preserves done flags positionally', () => {
    const goal = completeN(createGoal('g', GOAL_TEMPLATES.sleep), 2);
    const state = stateWith(goal);
    const next = BASE_TASKS.map((task, i) =>
      i >= 2 ? { ...task, title: `reworked ${String(i)}` } : task,
    );

    const result = updateGoalTasks(state, 'g', next);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tasks = result.state.goals['g']!.tasks;
    expect(tasks[0]!.done).toBe(true);
    expect(tasks[1]!.done).toBe(true);
    expect(tasks[2]!.done).toBe(false);
    expect(tasks[5]!.title).toBe('reworked 5');
  });

  it('rejects an unknown goal', () => {
    const result = updateGoalTasks(
      stateWith(createGoal('g', GOAL_TEMPLATES.sleep)),
      'x',
      BASE_TASKS,
    );
    expect(result).toEqual({ ok: false, reason: 'unknown-goal' });
  });

  it('rejects the wrong task count', () => {
    const state = stateWith(createGoal('g', GOAL_TEMPLATES.sleep));
    expect(updateGoalTasks(state, 'g', BASE_TASKS.slice(0, 17))).toEqual({
      ok: false,
      reason: 'wrong-count',
    });
  });

  it('rejects an empty title or out-of-range minutes', () => {
    const state = stateWith(createGoal('g', GOAL_TEMPLATES.sleep));
    const emptyTitle = BASE_TASKS.map((task, i) => (i === 4 ? { ...task, title: '  ' } : task));
    expect(updateGoalTasks(state, 'g', emptyTitle)).toEqual({ ok: false, reason: 'invalid-task' });
    const tooLong = BASE_TASKS.map((task, i) =>
      i === 4 ? { ...task, estimatedMinutes: 999 } : task,
    );
    expect(updateGoalTasks(state, 'g', tooLong)).toEqual({ ok: false, reason: 'invalid-task' });
    const tooShort = BASE_TASKS.map((task, i) =>
      i === 4 ? { ...task, estimatedMinutes: 1 } : task,
    );
    expect(updateGoalTasks(state, 'g', tooShort)).toEqual({ ok: false, reason: 'invalid-task' });
  });

  it('rejects changing a completed (locked) task title or minutes', () => {
    const goal = completeN(createGoal('g', GOAL_TEMPLATES.sleep), 3);
    const state = stateWith(goal);
    const changedTitle = BASE_TASKS.map((task, i) => (i === 1 ? { ...task, title: 'nope' } : task));
    expect(updateGoalTasks(state, 'g', changedTitle)).toEqual({
      ok: false,
      reason: 'locked-changed',
    });
    const changedMinutes = BASE_TASKS.map((task, i) =>
      i === 0 ? { ...task, estimatedMinutes: task.estimatedMinutes + 1 } : task,
    );
    expect(updateGoalTasks(state, 'g', changedMinutes)).toEqual({
      ok: false,
      reason: 'locked-changed',
    });
  });

  it('does not mutate the input state', () => {
    const goal = createGoal('g', GOAL_TEMPLATES.sleep);
    const state = stateWith(goal);
    const snapshot = JSON.stringify(state);
    updateGoalTasks(
      state,
      'g',
      BASE_TASKS.map((task) => ({ ...task, title: `new ${task.title}` })),
    );
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('accepts exactly TASKS_PER_TREE tasks', () => {
    expect(BASE_TASKS).toHaveLength(TASKS_PER_TREE);
  });
});
