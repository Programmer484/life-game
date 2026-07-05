// Internal implementation. Deep imports from other modules are blocked by lint.
import { STAGE_TASKS, TASKS_PER_TREE } from '../../config/index.ts';
import type { Goal, GrowthStage, TaskCompletedEvent, Tree } from '../../config/index.ts';
import { completeNextTask, nextTaskIndex, tasksDone } from '../../entities/index.ts';

/** The headless growth state: every tree plus the goal each tree points at. */
export interface GrowthState {
  trees: readonly Tree[];
  goals: Readonly<Record<string, Goal>>;
}

/** Cumulative task counts at which the stage advances: 3, 7, 12, 18. */
const STAGE_THRESHOLDS: readonly number[] = STAGE_TASKS.reduce<number[]>(
  (sums, step) => [...sums, (sums[sums.length - 1] ?? 0) + step],
  [],
);

/** Growth stage derived cumulatively from tasksDone and STAGE_TASKS. */
export function stageOf(tree: Tree): GrowthStage {
  const passed = STAGE_THRESHOLDS.filter((threshold) => tree.tasksDone >= threshold).length;
  return (1 + passed) as GrowthStage;
}

/** A tree is complete once all of its goal's tasks are done. */
export function isComplete(tree: Tree): boolean {
  return tree.tasksDone >= TASKS_PER_TREE;
}

/** Non-complete trees — a complete tree stays forever but frees its slot. */
export function activeTrees(trees: readonly Tree[]): Tree[] {
  return trees.filter((tree) => !isComplete(tree));
}

/**
 * Consume a task-completed event: complete the goal's next task and sync the
 * tree's tasksDone. Guards (state returned unchanged): unknown treeId, stale
 * or duplicate taskIndex, goal already fully done.
 */
export function applyTaskCompleted(state: GrowthState, event: TaskCompletedEvent): GrowthState {
  const tree = state.trees.find((candidate) => candidate.id === event.treeId);
  if (!tree) return state;

  const goal = state.goals[tree.goalId];
  if (!goal) return state;

  const next = nextTaskIndex(goal);
  if (next === undefined || event.taskIndex !== next) return state;

  const updatedGoal = completeNextTask(goal);
  const updatedTree: Tree = { ...tree, tasksDone: tasksDone(updatedGoal) };
  return {
    trees: state.trees.map((candidate) => (candidate.id === tree.id ? updatedTree : candidate)),
    goals: { ...state.goals, [goal.id]: updatedGoal },
  };
}
