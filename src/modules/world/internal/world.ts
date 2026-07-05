// Internal implementation. Deep imports from other modules are blocked by lint.
import type { SectionDef, TileCoord, TileState, Vibrancy } from '../../config/index.ts';
import {
  ISLAND_LAYOUT,
  REVEAL_SIZE,
  VIBRANCY_CONTRIBUTION,
  VIBRANCY_MAX,
} from '../../config/index.ts';

interface Tile {
  readonly state: TileState;
  readonly sectionId: number;
}

/** The island: sections + per-tile state, built from ISLAND_LAYOUT. */
export interface World {
  readonly sections: readonly SectionDef[];
  readonly tiles: ReadonlyMap<string, Tile>;
}

const key = (coord: TileCoord): string => `${String(coord.x)},${String(coord.y)}`;

export function createWorld(): World {
  const tiles = new Map<string, Tile>();
  for (const section of ISLAND_LAYOUT) {
    const state: TileState = section.unlockedAtStart ? 'dead' : 'fog';
    for (const coord of section.tiles) {
      tiles.set(key(coord), { state, sectionId: section.id });
    }
  }
  return { sections: ISLAND_LAYOUT, tiles };
}

export function tileState(world: World, coord: TileCoord): TileState | undefined {
  return world.tiles.get(key(coord))?.state;
}

export function sectionOf(world: World, coord: TileCoord): number | undefined {
  return world.tiles.get(key(coord))?.sectionId;
}

/** True when the section's tiles are no longer fog. */
export function isSectionUnlocked(world: World, sectionId: number): boolean {
  const section = world.sections.find((s) => s.id === sectionId);
  if (!section) return false;
  return section.tiles.every((coord) => tileState(world, coord) !== 'fog');
}

/** fog → dead for the target section only; already-unlocked is a no-op. */
export function unlockSection(world: World, sectionId: number): World {
  const tiles = new Map(world.tiles);
  let changed = false;
  for (const [k, tile] of tiles) {
    if (tile.sectionId === sectionId && tile.state === 'fog') {
      tiles.set(k, { ...tile, state: 'dead' });
      changed = true;
    }
  }
  return changed ? { ...world, tiles } : world;
}

/**
 * dead → vibrant for the REVEAL_SIZE area centered on `center`. Fog tiles
 * and off-island coords are left untouched.
 */
export function revealAround(world: World, center: TileCoord): World {
  const halfW = Math.floor(REVEAL_SIZE.width / 2);
  const halfH = Math.floor(REVEAL_SIZE.height / 2);
  const tiles = new Map(world.tiles);
  let changed = false;
  for (let dy = -halfH; dy <= halfH; dy++) {
    for (let dx = -halfW; dx <= halfW; dx++) {
      const k = key({ x: center.x + dx, y: center.y + dy });
      const tile = tiles.get(k);
      if (tile && tile.state === 'dead') {
        tiles.set(k, { ...tile, state: 'vibrant' });
        changed = true;
      }
    }
  }
  return changed ? { ...world, tiles } : world;
}

/**
 * Vibrancy of one tile: the sum of every tree's contribution by orthogonal
 * (Manhattan) distance — +3 own tile, +2 one step, +1 two steps (a diagonal
 * neighbour is distance 2) — clamped to VIBRANCY_MAX. Trees are plain coords
 * so world stays free of entity knowledge.
 */
export function vibrancyAt(tile: TileCoord, treeTiles: readonly TileCoord[]): Vibrancy {
  let total = 0;
  for (const tree of treeTiles) {
    const distance = Math.abs(tree.x - tile.x) + Math.abs(tree.y - tile.y);
    total += VIBRANCY_CONTRIBUTION[distance] ?? 0;
  }
  return Math.min(total, VIBRANCY_MAX) as Vibrancy;
}

/** Vibrancy for every island tile, keyed `"x,y"`. Fog cover is render's call. */
export function vibrancyMap(
  world: World,
  treeTiles: readonly TileCoord[],
): ReadonlyMap<string, Vibrancy> {
  const result = new Map<string, Vibrancy>();
  for (const section of world.sections) {
    for (const coord of section.tiles) {
      result.set(key(coord), vibrancyAt(coord, treeTiles));
    }
  }
  return result;
}
