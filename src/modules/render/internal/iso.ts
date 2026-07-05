// Pure isometric projection math for the 2.5D look. No Pixi imports here.
import type { TileCoord } from '../../config/index.ts';

/** On-screen size of one tile diamond: 2:1 width-to-height. */
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

interface ScreenPoint {
  x: number;
  y: number;
}

/** Grid coord → screen position of the diamond's center. */
export function tileToScreen(coord: TileCoord): ScreenPoint {
  return {
    x: (coord.x - coord.y) * (TILE_WIDTH / 2),
    y: (coord.x + coord.y) * (TILE_HEIGHT / 2),
  };
}

/** Screen position → nearest grid coord (exact inverse on tile centers). */
export function screenToTile(point: ScreenPoint): TileCoord {
  const a = point.x / (TILE_WIDTH / 2);
  const b = point.y / (TILE_HEIGHT / 2);
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}
