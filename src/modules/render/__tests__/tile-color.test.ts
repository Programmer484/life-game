// Tests deep-import their OWN module's internals (allowed; see TESTING.md).
import { describe, it, expect } from 'vitest';
import { TILE_COLORS } from '../../assets/index.ts';
import { colorForTile } from '../internal/tile-color.ts';

describe('render vibrancy→color mapping', () => {
  it('maps fog tiles to the fog color regardless of vibrancy', () => {
    expect(colorForTile('fog', 0)).toBe(TILE_COLORS.fog);
    expect(colorForTile('fog', 3)).toBe(TILE_COLORS.fog);
  });

  it('maps vibrancy 0 to the dead color', () => {
    expect(colorForTile('dead', 0)).toBe(TILE_COLORS.dead);
    expect(colorForTile('vibrant', 0)).toBe(TILE_COLORS.dead);
  });

  it('maps vibrancy 1 and 2 to the half-dead color', () => {
    expect(colorForTile('dead', 1)).toBe(TILE_COLORS.halfDead);
    expect(colorForTile('vibrant', 2)).toBe(TILE_COLORS.halfDead);
  });

  it('maps vibrancy 3 to the vibrant color', () => {
    expect(colorForTile('dead', 3)).toBe(TILE_COLORS.vibrant);
    expect(colorForTile('vibrant', 3)).toBe(TILE_COLORS.vibrant);
  });
});
