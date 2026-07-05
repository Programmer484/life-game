// Internal implementation. Deep imports from other modules are blocked by lint.
import type {
  Goal,
  GoalTemplate,
  TaskCompletedEvent,
  TileCoord,
  Tree,
  TreeType,
} from '../../config/index.ts';

/** Instantiate a goal from a template: all tasks in template order, none done. */
export function createGoal(id: string, template: GoalTemplate): Goal {
  return {
    id,
    name: template.name,
    tasks: template.tasks.map((task) => ({ ...task, done: false })),
  };
}

/** Create a freshly-planted tree with no tasks done. */
export function createTree(id: string, tile: TileCoord, type: TreeType, goalId: string): Tree {
  return { id, tile, type, goalId, tasksDone: 0 };
}

/** Index of the first not-done task; undefined when all are done. */
export function nextTaskIndex(goal: Goal): number | undefined {
  const index = goal.tasks.findIndex((task) => !task.done);
  return index === -1 ? undefined : index;
}

/** Mark the next task done (immutably); a fully-done goal is returned unchanged. */
export function completeNextTask(goal: Goal): Goal {
  const index = nextTaskIndex(goal);
  if (index === undefined) return goal;
  return {
    ...goal,
    tasks: goal.tasks.map((task, i) => (i === index ? { ...task, done: true } : task)),
  };
}

/** Count of done tasks. */
export function tasksDone(goal: Goal): number {
  return goal.tasks.filter((task) => task.done).length;
}

/** Factory for the event systems consume when a task completes. */
export function taskCompletedEvent(treeId: string, taskIndex: number): TaskCompletedEvent {
  return { type: 'task-completed', treeId, taskIndex };
}
