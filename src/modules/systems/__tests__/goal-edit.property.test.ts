import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  GOAL_TEMPLATES,
  TASK_MINUTES_MAX,
  TASK_MINUTES_MIN,
  TASKS_PER_TREE,
} from '../../config/index.ts';
import type { Goal, TaskDef } from '../../config/index.ts';
import { completeNextTask, createGoal } from '../../entities/index.ts';
import { createWorld } from '../../world/index.ts';
import { updateGoalTasks } from '../index.ts';
import type { GameplayState } from '../index.ts';

const BASE = GOAL_TEMPLATES.sleep.tasks.map((task) => ({ ...task }));
const NAME = GOAL_TEMPLATES.sleep.name;

function stateWith(goal: Goal): GameplayState {
  return { world: createWorld(), trees: [], goals: { [goal.id]: goal } };
}

function completeN(goal: Goal, n: number): Goal {
  let g = goal;
  for (let i = 0; i < n; i++) g = completeNextTask(g);
  return g;
}

describe('systems / updateGoalTasks — properties', () => {
  it('editing only the upcoming (unlocked) tasks always succeeds and preserves the done prefix', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: TASKS_PER_TREE - 1 }),
        fc.array(fc.integer({ min: TASK_MINUTES_MIN, max: TASK_MINUTES_MAX }), {
          minLength: TASKS_PER_TREE,
          maxLength: TASKS_PER_TREE,
        }),
        (done, minutesByRow) => {
          const goal = completeN(createGoal('g', GOAL_TEMPLATES.sleep), done);
          const next: TaskDef[] = BASE.map((task, i) =>
            i < done ? task : { title: `edited ${String(i)}`, estimatedMinutes: minutesByRow[i]! },
          );
          const result = updateGoalTasks(stateWith(goal), 'g', NAME, next);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          const tasks = result.state.goals['g']!.tasks;
          for (let i = 0; i < done; i++) {
            expect(tasks[i]!.done).toBe(true);
            expect(tasks[i]!.title).toBe(BASE[i]!.title);
          }
        },
      ),
    );
  });

  it('changing any completed task is always rejected as locked-changed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: TASKS_PER_TREE }), (done) => {
        const goal = completeN(createGoal('g', GOAL_TEMPLATES.sleep), done);
        // Rewrite the last completed row's title.
        const lockedRow = done - 1;
        const next = BASE.map((task, i) =>
          i === lockedRow ? { ...task, title: `${task.title}!!` } : task,
        );
        expect(updateGoalTasks(stateWith(goal), 'g', NAME, next)).toEqual({
          ok: false,
          reason: 'locked-changed',
        });
      }),
    );
  });
});
