// Tests deep-import their OWN module's internals (allowed; see TESTING.md).
import { describe, it, expect } from 'vitest';
import { sameTileKey, textureKeyForTile } from '../internal/texture-key.ts';

describe('render tile → texture key mapping', () => {
  it('fog wins over vibrancy: fog tiles always pick the fog texture', () => {
    expect(textureKeyForTile('fog', 0)).toEqual({ kind: 'fog' });
    expect(textureKeyForTile('fog', 3)).toEqual({ kind: 'fog' });
  });

  it('maps each vibrancy 0..3 to the matching tile texture', () => {
    for (const vibrancy of [0, 1, 2, 3] as const) {
      expect(textureKeyForTile('dead', vibrancy)).toEqual({ kind: 'tile', vibrancy });
      expect(textureKeyForTile('vibrant', vibrancy)).toEqual({ kind: 'tile', vibrancy });
    }
  });
});

describe('render texture key equality (retexture diff)', () => {
  it('fog equals fog and differs from any tile key', () => {
    expect(sameTileKey({ kind: 'fog' }, { kind: 'fog' })).toBe(true);
    expect(sameTileKey({ kind: 'fog' }, { kind: 'tile', vibrancy: 0 })).toBe(false);
    expect(sameTileKey({ kind: 'tile', vibrancy: 3 }, { kind: 'fog' })).toBe(false);
  });

  it('tile keys compare by vibrancy', () => {
    expect(sameTileKey({ kind: 'tile', vibrancy: 2 }, { kind: 'tile', vibrancy: 2 })).toBe(true);
    expect(sameTileKey({ kind: 'tile', vibrancy: 1 }, { kind: 'tile', vibrancy: 2 })).toBe(false);
  });
});
