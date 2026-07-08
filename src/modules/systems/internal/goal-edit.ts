// Internal implementation. Deep imports from other modules are blocked by lint.
import { TASK_MINUTES_MAX, TASK_MINUTES_MIN, TASKS_PER_TREE } from '../../config/index.ts';
import type { TaskDef } from '../../config/index.ts';
import { tasksDone } from '../../entities/index.ts';
import type { GameplayState } from './planting.ts';

/**
 * Why an edit to a goal's task list was refused. `unknown-goal`: no goal with
 * that id. `wrong-count`: not exactly 18 tasks. `invalid-task`: a task has an
 * empty title or minutes outside the allowed range. `locked-changed`: the
 * title or minutes of an already-completed (locked) task was altered.
 */
export type GoalEditRejection = 'unknown-goal' | 'wrong-count' | 'invalid-task' | 'locked-changed';

function validTask(task: TaskDef): boolean {
  if (task.title.trim() === '') return false;
  const { estimatedMinutes } = task;
  return (
    Number.isFinite(estimatedMinutes) &&
    estimatedMinutes >= TASK_MINUTES_MIN &&
    estimatedMinutes <= TASK_MINUTES_MAX
  );
}

/**
 * Replace a goal's task list. The new list must hold EXACTLY 18 valid tasks,
 * and the already-completed prefix (tasks done, which are always the leading
 * rows) must be unchanged in title and minutes — a player may re-plan the
 * work ahead but not rewrite history. Done flags are preserved positionally.
 * Returns the updated state or a typed rejection; the input state is never
 * mutated.
 */
export function updateGoalTasks(
  state: GameplayState,
  goalId: string,
  tasks: readonly TaskDef[],
): { ok: true; state: GameplayState } | { ok: false; reason: GoalEditRejection } {
  const goal = state.goals[goalId];
  if (goal === undefined) return { ok: false, reason: 'unknown-goal' };
  if (tasks.length !== TASKS_PER_TREE) return { ok: false, reason: 'wrong-count' };
  if (!tasks.every(validTask)) return { ok: false, reason: 'invalid-task' };

  const doneCount = tasksDone(goal);
  for (let i = 0; i < doneCount; i++) {
    const before = goal.tasks[i];
    const after = tasks[i];
    if (before === undefined || after === undefined) continue;
    if (before.title !== after.title || before.estimatedMinutes !== after.estimatedMinutes) {
      return { ok: false, reason: 'locked-changed' };
    }
  }

  const nextTasks = tasks.map((task, i) => ({
    title: task.title,
    estimatedMinutes: task.estimatedMinutes,
    done: goal.tasks[i]?.done ?? false,
  }));
  return {
    ok: true,
    state: { ...state, goals: { ...state.goals, [goalId]: { ...goal, tasks: nextTasks } } },
  };
}
