// Tests written FIRST from the S1 spec (Island data & land logic).
// Layout facts used below (from config's ISLAND_LAYOUT):
//   section 1 (unlockedAtStart) = x 0..5, y 0..5
//   section 2 (locked)          = x 6..11, y 0..5
//   section 3 (locked)          = x 0..5,  y 6..11
//   section 6 (locked)          = x 1..8,  y -5..-1
import { describe, it, expect } from 'vitest';
import type { TileCoord } from '../../config/index.ts';
import {
  createWorld,
  tileState,
  sectionOf,
  isSectionUnlocked,
  unlockSection,
  revealAround,
  vibrancyAt,
  vibrancyMap,
} from '../index.ts';

describe('world · createWorld', () => {
  it('starts every tile of section 1 (unlockedAtStart) as dead', () => {
    const world = createWorld();
    expect(tileState(world, { x: 0, y: 0 })).toBe('dead');
    expect(tileState(world, { x: 5, y: 5 })).toBe('dead');
    expect(tileState(world, { x: 3, y: 2 })).toBe('dead');
  });

  it('starts every tile of a locked section as fog', () => {
    const world = createWorld();
    expect(tileState(world, { x: 6, y: 0 })).toBe('fog'); // section 2
    expect(tileState(world, { x: 0, y: 6 })).toBe('fog'); // section 3
    expect(tileState(world, { x: 1, y: -1 })).toBe('fog'); // section 6
  });

  it('returns undefined tile state and section for coords not on the island', () => {
    const world = createWorld();
    expect(tileState(world, { x: 100, y: 100 })).toBeUndefined();
    expect(tileState(world, { x: -13, y: 0 })).toBeUndefined();
    expect(sectionOf(world, { x: 100, y: 100 })).toBeUndefined();
  });

  it('maps each tile to its section', () => {
    const world = createWorld();
    expect(sectionOf(world, { x: 0, y: 0 })).toBe(1);
    expect(sectionOf(world, { x: 6, y: 0 })).toBe(2);
    expect(sectionOf(world, { x: 0, y: 6 })).toBe(3);
  });

  it('reports section 1 unlocked and locked sections not unlocked at start', () => {
    const world = createWorld();
    expect(isSectionUnlocked(world, 1)).toBe(true);
    expect(isSectionUnlocked(world, 2)).toBe(false);
    expect(isSectionUnlocked(world, 7)).toBe(false);
  });
});

describe('world · unlockSection', () => {
  it("turns exactly the target section's fog tiles dead, other sections untouched", () => {
    const world = unlockSection(createWorld(), 2);
    expect(tileState(world, { x: 6, y: 0 })).toBe('dead'); // section 2
    expect(tileState(world, { x: 11, y: 5 })).toBe('dead'); // section 2
    expect(isSectionUnlocked(world, 2)).toBe(true);
    expect(tileState(world, { x: 0, y: 6 })).toBe('fog'); // section 3 untouched
    expect(tileState(world, { x: 0, y: 0 })).toBe('dead'); // section 1 untouched
  });

  it('is idempotent: unlocking an already unlocked section is a no-op', () => {
    const once = unlockSection(createWorld(), 2);
    const twice = unlockSection(once, 2);
    expect(tileState(twice, { x: 6, y: 0 })).toBe('dead');
    expect(tileState(twice, { x: 0, y: 6 })).toBe('fog');
    // Unlocking the start section changes nothing either.
    const start = unlockSection(createWorld(), 1);
    expect(tileState(start, { x: 0, y: 0 })).toBe('dead');
    expect(tileState(start, { x: 6, y: 0 })).toBe('fog');
  });

  it('does not regress revealed vibrant tiles', () => {
    const world = unlockSection(revealAround(createWorld(), { x: 2, y: 2 }), 1);
    expect(tileState(world, { x: 2, y: 2 })).toBe('vibrant');
  });
});

describe('world · revealAround', () => {
  it('turns the full 3×3 around the center vibrant on interior dead land', () => {
    const world = revealAround(createWorld(), { x: 2, y: 2 });
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(tileState(world, { x, y })).toBe('vibrant');
      }
    }
    // Just outside the 3×3 stays dead.
    expect(tileState(world, { x: 0, y: 0 })).toBe('dead');
    expect(tileState(world, { x: 4, y: 2 })).toBe('dead');
  });

  it('does not reveal fog neighbours of the 3×3', () => {
    // {5,5} is the section-1 corner; its 3×3 spills into locked sections 2/3/4.
    const world = revealAround(createWorld(), { x: 5, y: 5 });
    expect(tileState(world, { x: 5, y: 5 })).toBe('vibrant');
    expect(tileState(world, { x: 4, y: 4 })).toBe('vibrant');
    expect(tileState(world, { x: 6, y: 5 })).toBe('fog'); // section 2
    expect(tileState(world, { x: 5, y: 6 })).toBe('fog'); // section 3
    expect(tileState(world, { x: 6, y: 6 })).toBe('fog'); // section 4
  });

  it('ignores coords off the island', () => {
    // {0,0}'s 3×3 covers locked-section coords; a corner reveal at the outer
    // coastline ({-12,-4}, section 21) covers true off-island coords.
    const world = revealAround(createWorld(), { x: 0, y: 0 });
    expect(tileState(world, { x: 0, y: 0 })).toBe('vibrant');
    expect(tileState(world, { x: 1, y: 1 })).toBe('vibrant');
    expect(tileState(world, { x: -1, y: 0 })).toBe('fog'); // section 13 stays fog
    expect(tileState(world, { x: 1, y: -1 })).toBe('fog'); // section 6 stays fog
    const coast = revealAround(world, { x: -12, y: -4 });
    expect(tileState(coast, { x: -13, y: -4 })).toBeUndefined();
    expect(tileState(coast, { x: -13, y: -5 })).toBeUndefined();
  });

  it('keeps already-vibrant tiles vibrant and a second overlapping reveal only adds', () => {
    const first = revealAround(createWorld(), { x: 2, y: 2 });
    const second = revealAround(first, { x: 3, y: 3 });
    // Everything from the first reveal is still vibrant…
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(tileState(second, { x, y })).toBe('vibrant');
      }
    }
    // …and the second reveal added its own area.
    expect(tileState(second, { x: 4, y: 4 })).toBe('vibrant');
    expect(tileState(second, { x: 4, y: 2 })).toBe('vibrant');
    // Untouched land is still dead.
    expect(tileState(second, { x: 0, y: 0 })).toBe('dead');
  });
});

describe('world · vibrancyAt', () => {
  it('returns 0 everywhere with no trees', () => {
    expect(vibrancyAt({ x: 0, y: 0 }, [])).toBe(0);
    expect(vibrancyAt({ x: 3, y: 3 }, [])).toBe(0);
  });

  it('gives a single tree the +3/+2/+1 Manhattan-distance pattern', () => {
    const trees: TileCoord[] = [{ x: 3, y: 3 }];
    expect(vibrancyAt({ x: 3, y: 3 }, trees)).toBe(3); // d=0 own tile
    expect(vibrancyAt({ x: 4, y: 3 }, trees)).toBe(2); // d=1 orthogonal
    expect(vibrancyAt({ x: 3, y: 2 }, trees)).toBe(2); // d=1 orthogonal
    expect(vibrancyAt({ x: 5, y: 3 }, trees)).toBe(1); // d=2 straight
    expect(vibrancyAt({ x: 4, y: 4 }, trees)).toBe(1); // d=2 diagonal neighbour
    expect(vibrancyAt({ x: 2, y: 2 }, trees)).toBe(1); // d=2 diagonal neighbour
    expect(vibrancyAt({ x: 6, y: 3 }, trees)).toBe(0); // d=3 out of range
    expect(vibrancyAt({ x: 5, y: 4 }, trees)).toBe(0); // d=3 out of range
  });

  it('stacks contributions from multiple trees cumulatively', () => {
    const trees: TileCoord[] = [
      { x: 2, y: 2 },
      { x: 6, y: 2 },
    ];
    // (4,2) is d=2 from both trees: 1 + 1 = 2 — more than either alone.
    expect(vibrancyAt({ x: 4, y: 2 }, trees)).toBe(2);
    // (3,2) is d=1 from one tree, d=3 from the other: just 2.
    expect(vibrancyAt({ x: 3, y: 2 }, trees)).toBe(2);
  });

  it('clamps the cumulative total at 3', () => {
    const trees: TileCoord[] = [
      { x: 2, y: 2 },
      { x: 4, y: 2 },
    ];
    expect(vibrancyAt({ x: 3, y: 2 }, trees)).toBe(3); // 2 + 2 = 4 → 3
    expect(vibrancyAt({ x: 2, y: 2 }, trees)).toBe(3); // 3 + 1 = 4 → 3
  });
});

describe('world · vibrancyMap', () => {
  it('covers every island tile, keyed "x,y", matching vibrancyAt', () => {
    const world = createWorld();
    const trees: TileCoord[] = [{ x: 1, y: 1 }];
    const map = vibrancyMap(world, trees);
    let tileCount = 0;
    for (const section of world.sections) tileCount += section.tiles.length;
    expect(map.size).toBe(tileCount);
    expect(map.get('1,1')).toBe(3);
    expect(map.get('2,1')).toBe(2);
    expect(map.get('2,2')).toBe(1);
    expect(map.get('4,4')).toBe(0);
  });

  it('is all zeros with no trees', () => {
    const map = vibrancyMap(createWorld(), []);
    for (const value of map.values()) expect(value).toBe(0);
  });
});
