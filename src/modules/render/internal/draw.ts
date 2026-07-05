// Pixi-touching drawing code: kept thin and untested (polish lane).
import { Container, Sprite } from 'pixi.js';
import type { ArtTextures } from '../../assets/index.ts';
import type { GrowthStage, TileCoord, TreeType, Vibrancy } from '../../config/index.ts';
import type { World } from '../../world/index.ts';
import { tileState } from '../../world/index.ts';
import { TILE_WIDTH, TILE_HEIGHT, tileToScreen } from './iso.ts';
import { textureKeyForTile, type TileTextureKey } from './texture-key.ts';

/** Per-tile vibrancy precomputed by the controller, keyed `"x,y"`. */
type VibrancyView = ReadonlyMap<string, Vibrancy>;

/** One tile sprite per island tile, art picked by fog cover + vibrancy. */
export function drawWorld(world: World, vibrancy: VibrancyView, textures: ArtTextures): Container {
  const container = new Container();
  redraw(container, world, vibrancy, textures);
  return container;
}

/** Full redraw of an existing world container (fine at this scale). */
export function updateWorld(
  container: Container,
  world: World,
  vibrancy: VibrancyView,
  textures: ArtTextures,
): void {
  container.removeChildren().forEach((child) => child.destroy());
  redraw(container, world, vibrancy, textures);
}

function redraw(
  container: Container,
  world: World,
  vibrancy: VibrancyView,
  textures: ArtTextures,
): void {
  for (const section of world.sections) {
    for (const coord of section.tiles) {
      const state = tileState(world, coord);
      if (!state) continue;
      const key = textureKeyForTile(state, vibrancy.get(coordKey(coord)) ?? 0);
      container.addChild(tileSprite(coord, key, textures));
    }
  }
}

function tileSprite(coord: TileCoord, key: TileTextureKey, textures: ArtTextures): Sprite {
  const sprite = new Sprite(key.kind === 'fog' ? textures.fog : textures.tile[key.vibrancy]);
  sprite.anchor.set(0.5, 0.5);
  sprite.width = TILE_WIDTH;
  sprite.height = TILE_HEIGHT;
  const { x, y } = tileToScreen(coord);
  sprite.position.set(x, y);
  return sprite;
}

function coordKey(coord: TileCoord): string {
  return `${coord.x},${coord.y}`;
}

/** Precomputed marker data — game logic (stage math) stays out of render. */
export interface TreeMarker {
  tile: TileCoord;
  type: TreeType;
  stage: GrowthStage;
}

/**
 * Uniform tree sprite scale: the 384px-tall source canvases carry the growth
 * ladder baked in, so one factor for every stage keeps relative sizes — a
 * stage-5 tree reads about two tiles (~96px) tall on screen.
 */
const TREE_SCALE = 96 / 384;

/** Full redraw of the tree layer: one art sprite per tree, y-sorted for depth. */
export function updateTrees(
  container: Container,
  trees: readonly TreeMarker[],
  textures: ArtTextures,
): void {
  container.sortableChildren = true;
  container.removeChildren().forEach((child) => child.destroy());
  for (const tree of trees) {
    const { x, y } = tileToScreen(tree.tile);
    const sprite = new Sprite(textures.tree[tree.type][tree.stage]);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(TREE_SCALE);
    sprite.position.set(x, y);
    sprite.zIndex = y;
    container.addChild(sprite);
  }
}
