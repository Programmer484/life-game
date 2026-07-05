// Placeholder art manifest for v1: flat colors, no image loading.
import type { TreeType } from '../../config/index.ts';

/** Tile fill colors per state, plus the half-dead transition mix. */
export const TILE_COLORS = {
  /** Near-black fog of the still-locked sections. */
  fog: 0x0d0d12,
  /** Dark sludge brown of unlocked-but-dead land. */
  dead: 0x4a3826,
  /** Desaturated dead/vibrant mix for transition tiles. */
  halfDead: 0x5d6b3a,
  /** Living green of revealed land. */
  vibrant: 0x3f9e4d,
} as const;

/**
 * Tree colors per growth stage (index = stage - 1), for later slices.
 * Type A trees are greens; type B trees are teals.
 */
export const TREE_STAGE_COLORS: Record<
  TreeType,
  readonly [number, number, number, number, number]
> = {
  A: [0x2e5d2e, 0x387539, 0x428f45, 0x4daa52, 0x59c661],
  B: [0x1f5c5a, 0x27726f, 0x2f8a86, 0x38a49e, 0x42bfb7],
};
