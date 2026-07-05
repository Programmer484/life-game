// Internal implementation. Deep imports from other modules are blocked by lint.
import type { SectionDef, TileCoord, TileState } from '../../config/index.ts';
import { ISLAND_LAYOUT, REVEAL_SIZE } from '../../config/index.ts';

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

/** Dead tiles bordering at least one vibrant tile (8-neighbour adjacency). */
export function transitionTiles(world: World): TileCoord[] {
  const result: TileCoord[] = [];
  for (const section of world.sections) {
    for (const coord of section.tiles) {
      if (tileState(world, coord) !== 'dead') continue;
      if (hasVibrantNeighbour(world, coord)) result.push({ ...coord });
    }
  }
  return result;
}

function hasVibrantNeighbour(world: World, coord: TileCoord): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (tileState(world, { x: coord.x + dx, y: coord.y + dy }) === 'vibrant') return true;
    }
  }
  return false;
}
