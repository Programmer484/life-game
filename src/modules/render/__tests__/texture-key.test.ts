// Tests deep-import their OWN module's internals (allowed; see TESTING.md).
import { describe, it, expect } from 'vitest';
import { textureKeyForTile } from '../internal/texture-key.ts';

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
