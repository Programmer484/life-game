// Pure tile → texture-key mapping. No Pixi imports here.
import type { TileState, Vibrancy } from '../../config/index.ts';

/** Semantic pick into ArtTextures: fog cover or the tile art for a vibrancy. */
export type TileTextureKey =
  { readonly kind: 'fog' } | { readonly kind: 'tile'; readonly vibrancy: Vibrancy };

/** Fog covers unrevealed land regardless of vibrancy; otherwise vibrancy picks. */
export function textureKeyForTile(state: TileState, vibrancy: Vibrancy): TileTextureKey {
  if (state === 'fog') return { kind: 'fog' };
  return { kind: 'tile', vibrancy };
}
