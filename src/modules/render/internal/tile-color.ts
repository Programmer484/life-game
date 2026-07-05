// Pure tile-state → fill-color mapping. No Pixi imports here.
import type { TileState } from '../../config/index.ts';
import { TILE_COLORS } from '../../assets/index.ts';

/** Fill color for a tile; dead tiles on the vibrant border get the half-dead mix. */
export function colorForTile(state: TileState, isTransition: boolean): number {
  if (state === 'dead' && isTransition) return TILE_COLORS.halfDead;
  return TILE_COLORS[state];
}
