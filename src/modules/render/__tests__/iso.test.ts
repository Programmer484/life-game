// Tests deep-import their OWN module's internals (allowed; see TESTING.md).
import { describe, it, expect } from 'vitest';
import { TILE_WIDTH, TILE_HEIGHT, tileToScreen, screenToTile } from '../internal/iso.ts';

describe('render iso projection', () => {
  it('uses 2:1 isometric diamonds (tile width is twice tile height)', () => {
    expect(TILE_WIDTH).toBe(2 * TILE_HEIGHT);
    expect(TILE_HEIGHT).toBeGreaterThan(0);
  });

  it('projects the origin tile to the screen origin', () => {
    expect(tileToScreen({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('steps +x right-and-down, +y left-and-down (2.5D look)', () => {
    const px = tileToScreen({ x: 1, y: 0 });
    expect(px.x).toBeGreaterThan(0);
    expect(px.y).toBeGreaterThan(0);

    const py = tileToScreen({ x: 0, y: 1 });
    expect(py.x).toBeLessThan(0);
    expect(py.y).toBeGreaterThan(0);
  });

  it('same-diagonal neighbours share a row: +x and +y move down by half a tile height', () => {
    expect(tileToScreen({ x: 1, y: 0 }).y).toBe(TILE_HEIGHT / 2);
    expect(tileToScreen({ x: 0, y: 1 }).y).toBe(TILE_HEIGHT / 2);
    expect(tileToScreen({ x: 1, y: 0 }).x).toBe(TILE_WIDTH / 2);
    expect(tileToScreen({ x: 0, y: 1 }).x).toBe(-TILE_WIDTH / 2);
  });

  it('round-trips every grid coord through screen space', () => {
    for (let x = -8; x <= 8; x++) {
      for (let y = -8; y <= 8; y++) {
        expect(screenToTile(tileToScreen({ x, y }))).toEqual({ x, y });
      }
    }
  });

  it('maps distinct tile coords to distinct screen positions', () => {
    const seen = new Set<string>();
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const p = tileToScreen({ x, y });
        seen.add(`${p.x},${p.y}`);
      }
    }
    expect(seen.size).toBe(16 * 16);
  });
});
