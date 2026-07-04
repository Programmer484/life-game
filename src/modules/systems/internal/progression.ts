// Internal implementation. Deep imports from other modules are blocked by lint.
import { TASKS_PER_TREE, UNLOCK_COSTS } from '../../config/index.ts';
import type { Tree, TreeType } from '../../config/index.ts';
import { isSectionUnlocked, unlockSection } from '../../world/index.ts';
import { isComplete } from './growth.ts';
import type { GameplayState } from './planting.ts';

/** Sections 2..7 carry the cumulative UNLOCK_COSTS thresholds, in id order. */
const LAST_SECTION_ID = UNLOCK_COSTS.length + 1;

/** Number of fully grown (complete) trees — the unlock-trigger currency. */
export function fullyGrownCount(trees: readonly Tree[]): number {
  return trees.filter((tree) => isComplete(tree)).length;
}

/** Lowest locked section id, or undefined when every section is unlocked. */
function nextLockedSectionId(state: GameplayState): number | undefined {
  for (let id = 2; id <= LAST_SECTION_ID; id++) {
    if (!isSectionUnlocked(state.world, id)) return id;
  }
  return undefined;
}

/**
 * XP bar value (§4.5): `(Σ min(tasksDone, 18) / 18) / unlockCost` where
 * `unlockCost` is the next locked section's cost, clamped to [0, 1].
 * Partial trees contribute fractionally; when all sections are unlocked the
 * progress is 1.
 */
export function xpProgress(state: GameplayState): number {
  const next = nextLockedSectionId(state);
  if (next === undefined) return 1;
  const treeUnits = state.trees.reduce(
    (sum, tree) => sum + Math.min(tree.tasksDone, TASKS_PER_TREE) / TASKS_PER_TREE,
    0,
  );
  return Math.min(1, Math.max(0, treeUnits / UNLOCK_COSTS[next - 2]!));
}

/**
 * Unlock every section whose cumulative threshold is now met, strictly in id
 * order (the dev panel can jump multiple at once). Only fully grown trees
 * count. No-op (same reference) when nothing qualifies; idempotent.
 */
export function applyProgression(state: GameplayState): GameplayState {
  const grown = fullyGrownCount(state.trees);
  let world = state.world;
  for (let id = 2; id <= LAST_SECTION_ID; id++) {
    if (isSectionUnlocked(world, id)) continue;
    if (grown < UNLOCK_COSTS[id - 2]!) break; // sections unlock strictly in order
    world = unlockSection(world, id);
  }
  return world === state.world ? state : { ...state, world };
}

/** Type B becomes available once any section beyond the start is unlocked. */
export function availableTreeTypes(state: GameplayState): TreeType[] {
  const beyondStart = state.world.sections.some(
    (section) => !section.unlockedAtStart && isSectionUnlocked(state.world, section.id),
  );
  return beyondStart ? ['A', 'B'] : ['A'];
}
