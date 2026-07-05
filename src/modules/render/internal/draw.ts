// Pixi-touching drawing code: kept thin and untested (polish lane).
import { Container, Graphics } from 'pixi.js';
import type { TileCoord } from '../../config/index.ts';
import type { World } from '../../world/index.ts';
import { tileState, transitionTiles } from '../../world/index.ts';
import { TILE_WIDTH, TILE_HEIGHT, tileToScreen } from './iso.ts';
import { colorForTile } from './tile-color.ts';

/** One Graphics diamond per island tile, filled by tile state. */
export function drawWorld(world: World): Container {
  const container = new Container();
  redraw(container, world);
  return container;
}

/** Full redraw of an existing world container (fine at this scale). */
export function updateWorld(container: Container, world: World): void {
  container.removeChildren().forEach((child) => child.destroy());
  redraw(container, world);
}

function redraw(container: Container, world: World): void {
  const transitions = new Set(transitionTiles(world).map(key));
  for (const section of world.sections) {
    for (const coord of section.tiles) {
      const state = tileState(world, coord);
      if (!state) continue;
      container.addChild(diamond(coord, colorForTile(state, transitions.has(key(coord)))));
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
