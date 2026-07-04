// Internal implementation. Deep imports from other modules are blocked by lint.
import { ACTIVE_TREE_CAP } from '../../config/index.ts';
import type { Goal, TileCoord, Tree, TreeType } from '../../config/index.ts';
import { createTree } from '../../entities/index.ts';
import { revealAround, tileState } from '../../world/index.ts';
import type { World } from '../../world/index.ts';
import { activeTrees, isComplete } from './growth.ts';
import type { GrowthState } from './growth.ts';

/** The full gameplay state: growth state plus the world and the focused tree. */
export type GameplayState = GrowthState & { world: World; focusedTreeId?: string };

export type PlantRejection = 'off-island' | 'fogged' | 'occupied' | 'cap';

export interface PlantRequest {
  id: string;
  tile: TileCoord;
  type: TreeType;
  goal: Goal;
}

/**
 * Validate a plant attempt: the tile must be on the island, unlocked
 * (dead or vibrant), unoccupied by any tree (active or complete), and an
 * active-tree slot must be free (complete trees do not count).
 */
export function canPlant(
  state: GameplayState,
  tile: TileCoord,
): { ok: true } | { ok: false; reason: PlantRejection } {
  const stateOfTile = tileState(state.world, tile);
  if (stateOfTile === undefined) return { ok: false, reason: 'off-island' };
  if (stateOfTile === 'fog') return { ok: false, reason: 'fogged' };
  if (state.trees.some((tree) => tree.tile.x === tile.x && tree.tile.y === tile.y)) {
    return { ok: false, reason: 'occupied' };
  }
  if (activeTrees(state.trees).length >= ACTIVE_TREE_CAP) return { ok: false, reason: 'cap' };
  return { ok: true };
}

/**
 * Plant a tree: on rejection the input state is returned unchanged with the
 * reason; on success the goal is added, the tree created, the 3×3 around the
 * tile revealed (dead → vibrant), and the new tree becomes the focus.
 */
export function plantTree(
  state: GameplayState,
  request: PlantRequest,
): { state: GameplayState; rejected?: PlantRejection } {
  const verdict = canPlant(state, request.tile);
  if (!verdict.ok) return { state, rejected: verdict.reason };

  const tree = createTree(request.id, request.tile, request.type, request.goal.id);
  return {
    state: {
      ...state,
      trees: [...state.trees, tree],
      goals: { ...state.goals, [request.goal.id]: request.goal },
      world: revealAround(state.world, request.tile),
      focusedTreeId: tree.id,
    },
  };
}

/** Focus an ACTIVE tree; focusing a complete or unknown tree is a no-op. */
export function focusTree(state: GameplayState, treeId: string): GameplayState {
  const tree = state.trees.find((candidate) => candidate.id === treeId);
  if (!tree || isComplete(tree)) return state;
  return { ...state, focusedTreeId: treeId };
}

/** The focused tree, or undefined when none is focused or it has completed. */
export function focusedTree(state: GameplayState): Tree | undefined {
  if (state.focusedTreeId === undefined) return undefined;
  const tree = state.trees.find((candidate) => candidate.id === state.focusedTreeId);
  if (!tree || isComplete(tree)) return undefined;
  return tree;
}
