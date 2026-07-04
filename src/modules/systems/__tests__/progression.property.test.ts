// The demo-protecting invariant for the progression system — the ONLY
// property for this slice: the section unlock fires exactly at its configured
// cost, never below it.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TASKS_PER_TREE, UNLOCK_COSTS } from '../../config/index.ts';
import type { Tree } from '../../config/index.ts';
import { createWorld, isSectionUnlocked, unlockSection } from '../../world/index.ts';
import { applyProgression } from '../index.ts';
import type { GameplayState } from '../index.ts';

function fullyGrown(count: number): Tree[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${String(i)}`,
    tile: { x: 0, y: 0 },
    type: 'A' as const,
    goalId: `t${String(i)}-goal`,
    tasksDone: TASKS_PER_TREE,
  }));
}

const maxCost = UNLOCK_COSTS[UNLOCK_COSTS.length - 1]!;

describe('systems (progression, property-based)', () => {
  it('unlocks the next locked section exactly when fully-grown count meets its cost', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: UNLOCK_COSTS.length + 1 }), // next locked section id
        fc.integer({ min: 0, max: maxCost + 10 }), // fully-grown tree count
        (sectionId, grownCount) => {
          // Arrange: sections below sectionId are already unlocked.
          let world = createWorld();
          for (let id = 2; id < sectionId; id++) world = unlockSection(world, id);
          const state: GameplayState = { world, trees: fullyGrown(grownCount), goals: {} };

          const after = applyProgression(state);

          const cost = UNLOCK_COSTS[sectionId - 2]!;
          expect(isSectionUnlocked(after.world, sectionId)).toBe(grownCount >= cost);
        },
      ),
    );
  });
});
