// Pure tile → fill-color mapping. No Pixi imports here.
import type { TileState, Vibrancy } from '../../config/index.ts';
import { TILE_COLORS } from '../../assets/index.ts';

/**
 * Interim v1 palette by vibrancy: fog covers unrevealed land regardless of
 * vibrancy; 0 → dead, 1–2 → the half-dead mix, 3 → vibrant.
 */
export function colorForTile(state: TileState, vibrancy: Vibrancy): number {
  if (state === 'fog') return TILE_COLORS.fog;
  if (vibrancy === 0) return TILE_COLORS.dead;
  if (vibrancy === 3) return TILE_COLORS.vibrant;
  return TILE_COLORS.halfDead;
}
