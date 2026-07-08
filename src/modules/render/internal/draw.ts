// Pixi-touching drawing code: kept thin and untested (polish lane).
import { Container, Sprite } from 'pixi.js';
import type { ArtTextures } from '../../assets/index.ts';
import type { GrowthStage, TileCoord, TreeType, Vibrancy } from '../../config/index.ts';
import type { World } from '../../world/index.ts';
import { tileState } from '../../world/index.ts';
import { TILE_WIDTH, TILE_HEIGHT, tileToScreen } from './iso.ts';
import { sameTileKey, textureKeyForTile, type TileTextureKey } from './texture-key.ts';

/** Per-tile vibrancy precomputed by the controller, keyed `"x,y"`. */
type VibrancyView = ReadonlyMap<string, Vibrancy>;

/** Persistent per-tile sprite plus the texture key it was last drawn with. */
interface TileEntry {
  sprite: Sprite;
  key: TileTextureKey;
}

/**
 * Persistent sprite state per world container. Tiles never move and the
 * layout never grows mid-run, so each tile gets one sprite for the
 * container's lifetime; updates only swap textures on key changes.
 */
const tileEntries = new WeakMap<Container, Map<string, TileEntry>>();

/** One tile sprite per island tile, art picked by fog cover + vibrancy. */
export function drawWorld(world: World, vibrancy: VibrancyView, textures: ArtTextures): Container {
  const container = new Container();
  const entries = new Map<string, TileEntry>();
  tileEntries.set(container, entries);
  for (const section of world.sections) {
    for (const coord of section.tiles) {
      const state = tileState(world, coord);
      if (!state) continue;
      const key = textureKeyForTile(state, vibrancy.get(coordKey(coord)) ?? 0);
      const sprite = tileSprite(coord, key, textures);
      entries.set(coordKey(coord), { sprite, key });
      container.addChild(sprite);
    }
  }
  return container;
}

/** Diff update: retexture changed tiles in place; sprites persist. */
export function updateWorld(
  container: Container,
  world: World,
  vibrancy: VibrancyView,
  textures: ArtTextures,
): void {
  const entries = tileEntries.get(container);
  if (!entries) return; // Container not created by drawWorld — nothing to update.
  for (const section of world.sections) {
    for (const coord of section.tiles) {
      const state = tileState(world, coord);
      if (!state) continue;
      const key = textureKeyForTile(state, vibrancy.get(coordKey(coord)) ?? 0);
      const entry = entries.get(coordKey(coord));
      if (!entry || sameTileKey(entry.key, key)) continue;
      entry.sprite.texture = key.kind === 'fog' ? textures.fog : textures.tile[key.vibrancy];
      entry.key = key;
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

/** Persistent per-tree sprite plus the marker it was last drawn with. */
interface TreeEntry {
  sprite: Sprite;
  type: TreeType;
  stage: GrowthStage;
}

/**
 * Persistent tree sprites per container, keyed by tile coord (one tree per
 * tile; trees never move). Updates add/remove/retexture diffs only. zIndex
 * is derived from the fixed screen y at creation, so Pixi's sortable
 * children stay correctly y-sorted as trees come and go.
 */
const treeEntries = new WeakMap<Container, Map<string, TreeEntry>>();

/** Diff update of the tree layer: one art sprite per tree, y-sorted for depth. */
export function updateTrees(
  container: Container,
  trees: readonly TreeMarker[],
  textures: ArtTextures,
): void {
  container.sortableChildren = true;
  let entries = treeEntries.get(container);
  if (!entries) {
    entries = new Map();
    treeEntries.set(container, entries);
  }
  const seen = new Set<string>();
  for (const tree of trees) {
    const key = coordKey(tree.tile);
    seen.add(key);
    const entry = entries.get(key);
    if (entry) {
      if (entry.type !== tree.type || entry.stage !== tree.stage) {
        entry.sprite.texture = textures.tree[tree.type][tree.stage];
        entry.type = tree.type;
        entry.stage = tree.stage;
      }
      continue;
    }
    const { x, y } = tileToScreen(tree.tile);
    const sprite = new Sprite(textures.tree[tree.type][tree.stage]);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(TREE_SCALE);
    sprite.position.set(x, y);
    sprite.zIndex = y;
    container.addChild(sprite);
    entries.set(key, { sprite, type: tree.type, stage: tree.stage });
  }
  for (const [key, entry] of entries) {
    if (seen.has(key)) continue;
    container.removeChild(entry.sprite);
    entry.sprite.destroy();
    entries.delete(key);
  }
}
