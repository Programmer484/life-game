// Tests written FIRST from .task/spec.md (S1 · Island data & land logic).
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
  transitionTiles,
} from '../index.ts';

const sortCoords = (coords: TileCoord[]): TileCoord[] =>
  [...coords].sort((a, b) => a.y - b.y || a.x - b.x);

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
    expect(tileState(world, { x: -1, y: 0 })).toBeUndefined();
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
    // {0,0}'s 3×3 covers off-island coords like {-1,0} and {-1,-1}.
    const world = revealAround(createWorld(), { x: 0, y: 0 });
    expect(tileState(world, { x: 0, y: 0 })).toBe('vibrant');
    expect(tileState(world, { x: 1, y: 1 })).toBe('vibrant');
    expect(tileState(world, { x: -1, y: 0 })).toBeUndefined();
    expect(tileState(world, { x: -1, y: -1 })).toBeUndefined();
    expect(tileState(world, { x: 1, y: -1 })).toBe('fog'); // section 6 stays fog
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

describe('world · transitionTiles', () => {
  it('yields exactly the 8-adjacent ring of dead tiles around a revealed 3×3 in a dead field', () => {
    const world = revealAround(createWorld(), { x: 2, y: 2 });
    // Vibrant block is (1..3)², so the ring is the border of (0..4)² — 16 tiles,
    // all inside section 1 and dead.
    const expected: TileCoord[] = [];
    for (let y = 0; y <= 4; y++) {
      for (let x = 0; x <= 4; x++) {
        if (x === 0 || x === 4 || y === 0 || y === 4) expected.push({ x, y });
      }
    }
    expect(sortCoords(transitionTiles(world))).toEqual(sortCoords(expected));
  });

  it('yields no transition tiles when nothing is vibrant', () => {
    expect(transitionTiles(createWorld())).toEqual([]);
    expect(transitionTiles(unlockSection(createWorld(), 2))).toEqual([]);
  });

  it('never includes fog tiles in the result', () => {
    // Reveal at the section-1 corner: vibrant (3..5)² borders fog in
    // sections 2/3/4; only the dead section-1 tiles may appear.
    const world = revealAround(createWorld(), { x: 4, y: 4 });
    const result = transitionTiles(world);
    for (const coord of result) {
      expect(tileState(world, coord)).toBe('dead');
    }
    expect(sortCoords(result)).toEqual(
      sortCoords([
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 4, y: 2 },
        { x: 5, y: 2 },
        { x: 2, y: 3 },
        { x: 2, y: 4 },
        { x: 2, y: 5 },
      ]),
    );
  });
});
