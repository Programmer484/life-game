import { describe, it, expect } from 'vitest';
import { GOAL_TEMPLATES } from '../../config/index.ts';
import { createGoal, createTree, taskCompletedEvent } from '../../entities/index.ts';
import { activeTrees, applyTaskCompleted, isComplete, stageOf } from '../index.ts';
import type { GrowthState } from '../index.ts';

function freshState(): GrowthState {
  const goal = createGoal('g1', GOAL_TEMPLATES.sleep);
  const tree = createTree('t1', { x: 0, y: 0 }, 'A', 'g1');
  return { trees: [tree], goals: { g1: goal } };
}

function completeTasks(state: GrowthState, count: number): GrowthState {
  let next = state;
  for (let i = 0; i < count; i++) {
    next = applyTaskCompleted(next, taskCompletedEvent('t1', i));
  }
  return next;
}

describe('systems (growth)', () => {
  it('advances a fresh sapling to stage 2 after 3 completed tasks', () => {
    const state = completeTasks(freshState(), 3);
    const tree = state.trees[0]!;
    expect(tree.tasksDone).toBe(3);
    expect(stageOf(tree)).toBe(2);
  });

  it('completes the tree at 18 tasks (stage 5) and frees its active slot', () => {
    const state = completeTasks(freshState(), 18);
    const tree = state.trees[0]!;
    expect(tree.tasksDone).toBe(18);
    expect(stageOf(tree)).toBe(5);
    expect(isComplete(tree)).toBe(true);
    expect(activeTrees(state.trees)).toEqual([]);
  });

  it('syncs tree.tasksDone with the goal and does not mutate the input state', () => {
    const before = freshState();
    const after = applyTaskCompleted(before, taskCompletedEvent('t1', 0));
    expect(after.trees[0]!.tasksDone).toBe(1);
    expect(after.goals['g1']!.tasks[0]!.done).toBe(true);
    // input state untouched
    expect(before.trees[0]!.tasksDone).toBe(0);
    expect(before.goals['g1']!.tasks[0]!.done).toBe(false);
    expect(after).not.toBe(before);
  });

  it('returns the state unchanged for a stale event (taskIndex not next)', () => {
    const state = completeTasks(freshState(), 2);
    expect(applyTaskCompleted(state, taskCompletedEvent('t1', 0))).toBe(state);
    expect(applyTaskCompleted(state, taskCompletedEvent('t1', 5))).toBe(state);
  });

  it('returns the state unchanged for an unknown treeId', () => {
    const state = freshState();
    expect(applyTaskCompleted(state, taskCompletedEvent('nope', 0))).toBe(state);
  });

  it('returns the state unchanged for an event on a finished goal', () => {
    const state = completeTasks(freshState(), 18);
    expect(applyTaskCompleted(state, taskCompletedEvent('t1', 17))).toBe(state);
  });

  it('keeps a non-complete tree in activeTrees', () => {
    const state = completeTasks(freshState(), 17);
    const tree = state.trees[0]!;
    expect(isComplete(tree)).toBe(false);
    expect(activeTrees(state.trees)).toEqual([tree]);
  });

  it('derives stages cumulatively from STAGE_TASKS boundaries', () => {
    const tree = createTree('t1', { x: 0, y: 0 }, 'A', 'g1');
    const expectations: Array<[number, number]> = [
      [0, 1],
      [2, 1],
      [3, 2],
      [6, 2],
      [7, 3],
      [11, 3],
      [12, 4],
      [17, 4],
      [18, 5],
    ];
    for (const [tasksDone, stage] of expectations) {
      expect(stageOf({ ...tree, tasksDone })).toBe(stage);
    }
  });
});
