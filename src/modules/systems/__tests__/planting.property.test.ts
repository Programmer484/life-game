// The demo-protecting invariant for the planting system — the ONLY property
// for this slice: the active-tree cap can never be exceeded.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ACTIVE_TREE_CAP, GOAL_TEMPLATES } from '../../config/index.ts';
import { createGoal, nextTaskIndex, taskCompletedEvent } from '../../entities/index.ts';
import { createWorld } from '../../world/index.ts';
import { activeTrees, applyTaskCompleted, plantTree } from '../index.ts';
import type { GameplayState } from '../index.ts';

type Step = { op: 'plant'; x: number; y: number } | { op: 'complete'; pick: number };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.record({
    op: fc.constant('plant' as const),
    x: fc.integer({ min: -1, max: 6 }),
    y: fc.integer({ min: -1, max: 6 }),
  }),
  fc.record({ op: fc.constant('complete' as const), pick: fc.nat({ max: 9 }) }),
);

function applyStep(state: GameplayState, step: Step, plantCount: number): GameplayState {
  if (step.op === 'plant') {
    const id = `t${String(plantCount)}`;
    return plantTree(state, {
      id,
      tile: { x: step.x, y: step.y },
      type: 'A',
      goal: createGoal(`${id}-goal`, GOAL_TEMPLATES.sleep),
    }).state;
  }
  if (state.trees.length === 0) return state;
  const tree = state.trees[step.pick % state.trees.length]!;
  const goal = state.goals[tree.goalId]!;
  const index = nextTaskIndex(goal);
  if (index === undefined) return state;
  return { ...state, ...applyTaskCompleted(state, taskCompletedEvent(tree.id, index)) };
}

describe('systems (planting, property-based)', () => {
  it('active trees never exceed ACTIVE_TREE_CAP over any plant/completion sequence', () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 60 }), (steps) => {
        let state: GameplayState = { world: createWorld(), trees: [], goals: {} };
        let plantCount = 0;
        for (const step of steps) {
          if (step.op === 'plant') plantCount++;
          state = applyStep(state, step, plantCount);
          expect(activeTrees(state.trees).length).toBeLessThanOrEqual(ACTIVE_TREE_CAP);
        }
      }),
    );
  });
});
