// Demo-protecting invariants for the growth system, generic over random
// completion sequences. These three are the ONLY properties for this slice.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { GOAL_TEMPLATES, TASKS_PER_TREE } from '../../config/index.ts';
import { createGoal, createTree, nextTaskIndex, taskCompletedEvent } from '../../entities/index.ts';
import { applyTaskCompleted, stageOf } from '../index.ts';
import type { GrowthState } from '../index.ts';

function freshState(): GrowthState {
  const goal = createGoal('g1', GOAL_TEMPLATES.sleep);
  const tree = createTree('t1', { x: 0, y: 0 }, 'A', 'g1');
  return { trees: [tree], goals: { g1: goal } };
}

/**
 * A random completion sequence: each step is either `null` (send the event
 * for the goal's true next task) or an arbitrary — possibly stale, duplicate,
 * or out-of-range — task index, sometimes aimed at an unknown tree.
 */
const sequenceArb = fc.array(
  fc.record({
    taskIndex: fc.option(fc.integer({ min: -1, max: TASKS_PER_TREE + 1 })),
    treeId: fc.constantFrom('t1', 't1', 't1', 'ghost'),
  }),
  { maxLength: 30 },
);

function stagesOver(steps: Array<{ taskIndex: number | null; treeId: string }>): number[] {
  let state = freshState();
  const stages = [stageOf(state.trees[0]!)];
  for (const step of steps) {
    const index = step.taskIndex ?? nextTaskIndex(state.goals['g1']!) ?? -1;
    state = applyTaskCompleted(state, taskCompletedEvent(step.treeId, index));
    stages.push(stageOf(state.trees[0]!));
  }
  return stages;
}

describe('systems (growth, property-based)', () => {
  it('growth stage is monotonically non-decreasing over any event sequence', () => {
    fc.assert(
      fc.property(sequenceArb, (steps) => {
        const stages = stagesOver(steps);
        for (let i = 1; i < stages.length; i++) {
          expect(stages[i]!).toBeGreaterThanOrEqual(stages[i - 1]!);
        }
      }),
    );
  });

  it('a single task completion never advances the stage by more than one', () => {
    fc.assert(
      fc.property(sequenceArb, (steps) => {
        const stages = stagesOver(steps);
        for (let i = 1; i < stages.length; i++) {
          expect(stages[i]! - stages[i - 1]!).toBeLessThanOrEqual(1);
        }
      }),
    );
  });

  it('stage 5 is reached exactly at 18 tasks done — never before, always at 18', () => {
    fc.assert(
      fc.property(sequenceArb, (steps) => {
        let state = freshState();
        for (const step of steps) {
          const index = step.taskIndex ?? nextTaskIndex(state.goals['g1']!) ?? -1;
          state = applyTaskCompleted(state, taskCompletedEvent(step.treeId, index));
          const tree = state.trees[0]!;
          expect(stageOf(tree) === 5).toBe(tree.tasksDone === TASKS_PER_TREE);
        }
      }),
    );
  });
});
