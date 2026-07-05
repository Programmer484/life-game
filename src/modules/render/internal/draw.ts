// Pixi-touching drawing code: kept thin and untested (polish lane).
import { Container, Graphics } from 'pixi.js';
import type { GrowthStage, TileCoord, TreeType, Vibrancy } from '../../config/index.ts';
import { TREE_STAGE_COLORS } from '../../assets/index.ts';
import type { World } from '../../world/index.ts';
import { tileState } from '../../world/index.ts';
import { TILE_WIDTH, TILE_HEIGHT, tileToScreen } from './iso.ts';
import { colorForTile } from './tile-color.ts';

/** Per-tile vibrancy precomputed by the controller, keyed `"x,y"`. */
type VibrancyView = ReadonlyMap<string, Vibrancy>;

/** One Graphics diamond per island tile, filled by fog cover + vibrancy. */
export function drawWorld(world: World, vibrancy: VibrancyView): Container {
  const container = new Container();
  redraw(container, world, vibrancy);
  return container;
}

/** Full redraw of an existing world container (fine at this scale). */
export function updateWorld(container: Container, world: World, vibrancy: VibrancyView): void {
  container.removeChildren().forEach((child) => child.destroy());
  redraw(container, world, vibrancy);
}

function redraw(container: Container, world: World, vibrancy: VibrancyView): void {
  for (const section of world.sections) {
    for (const coord of section.tiles) {
      const state = tileState(world, coord);
      if (!state) continue;
      container.addChild(diamond(coord, colorForTile(state, vibrancy.get(key(coord)) ?? 0)));
    }
  }
}

function diamond(coord: TileCoord, color: number): Graphics {
  const { x, y } = tileToScreen(coord);
  return new Graphics()
    .poly([
      x,
      y - TILE_HEIGHT / 2,
      x + TILE_WIDTH / 2,
      y,
      x,
      y + TILE_HEIGHT / 2,
      x - TILE_WIDTH / 2,
      y,
    ])
    .fill(color);
}

function key(coord: TileCoord): string {
  return `${coord.x},${coord.y}`;
}

/** Precomputed marker data — game logic (stage math) stays out of render. */
export interface TreeMarker {
  tile: TileCoord;
  type: TreeType;
  stage: GrowthStage;
}

/** Full redraw of the tree layer: one stage-scaled, stage-colored disc per tree. */
export function updateTrees(container: Container, trees: readonly TreeMarker[]): void {
  container.removeChildren().forEach((child) => child.destroy());
  for (const tree of trees) {
    const { x, y } = tileToScreen(tree.tile);
    const color = TREE_STAGE_COLORS[tree.type][tree.stage - 1] ?? TREE_STAGE_COLORS[tree.type][0];
    const radius = 4 + tree.stage * 2.5;
    container.addChild(
      new Graphics()
        .circle(x, y - TILE_HEIGHT / 4, radius)
        .fill(color)
        .stroke({ color: 0x10131a, width: 1.5 }),
    );
  }
}
