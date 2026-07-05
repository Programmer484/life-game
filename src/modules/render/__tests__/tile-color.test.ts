// Tests deep-import their OWN module's internals (allowed; see TESTING.md).
import { describe, it, expect } from 'vitest';
import { TILE_COLORS } from '../../assets/index.ts';
import { colorForTile } from '../internal/tile-color.ts';

describe('render state→color mapping', () => {
  it('maps fog tiles to the fog color', () => {
    expect(colorForTile('fog', false)).toBe(TILE_COLORS.fog);
  });

  it('maps dead tiles to the dead color', () => {
    expect(colorForTile('dead', false)).toBe(TILE_COLORS.dead);
  });

  it('maps vibrant tiles to the vibrant color', () => {
    expect(colorForTile('vibrant', false)).toBe(TILE_COLORS.vibrant);
  });

  it('maps dead transition tiles to the half-dead color', () => {
    expect(colorForTile('dead', true)).toBe(TILE_COLORS.halfDead);
  });

  it('ignores the transition flag for non-dead tiles', () => {
    expect(colorForTile('fog', true)).toBe(TILE_COLORS.fog);
    expect(colorForTile('vibrant', true)).toBe(TILE_COLORS.vibrant);
  });
});
