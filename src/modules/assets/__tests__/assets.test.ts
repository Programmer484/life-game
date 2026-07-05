import { describe, it, expect } from 'vitest';
import { TILE_COLORS, TREE_STAGE_COLORS } from '../index.ts';

function rgb(color: number): { r: number; g: number; b: number } {
  return { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff };
}

describe('assets placeholder palette', () => {
  it('fog is near-black (every channel dim)', () => {
    const { r, g, b } = rgb(TILE_COLORS.fog);
    expect(r).toBeLessThan(0x30);
    expect(g).toBeLessThan(0x30);
    expect(b).toBeLessThan(0x30);
  });

  it('dead is a dark sludge brown (red-leaning, dim, not green)', () => {
    const { r, g, b } = rgb(TILE_COLORS.dead);
    expect(r).toBeGreaterThan(b);
    expect(r).toBeGreaterThanOrEqual(g);
    expect(r).toBeLessThan(0x90); // dark, not a bright orange
  });

  it('vibrant is a living green (green channel dominates)', () => {
    const { r, g, b } = rgb(TILE_COLORS.vibrant);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('half-dead sits between dead and vibrant on the green channel', () => {
    const dead = rgb(TILE_COLORS.dead);
    const half = rgb(TILE_COLORS.halfDead);
    const vibrant = rgb(TILE_COLORS.vibrant);
    expect(half.g).toBeGreaterThan(dead.g);
    expect(half.g).toBeLessThan(vibrant.g);
  });

  it('all four tile colors are distinct', () => {
    const values = Object.values(TILE_COLORS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('provides five stage colors per tree type', () => {
    expect(TREE_STAGE_COLORS.A).toHaveLength(5);
    expect(TREE_STAGE_COLORS.B).toHaveLength(5);
  });

  it('type A stages are greens and type B stages are teals', () => {
    for (const color of TREE_STAGE_COLORS.A) {
      const { r, g, b } = rgb(color);
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
    }
    for (const color of TREE_STAGE_COLORS.B) {
      const { r, g, b } = rgb(color);
      expect(g).toBeGreaterThan(r);
      expect(b).toBeGreaterThan(r);
    }
  });

  it('stage colors are distinct within each type', () => {
    expect(new Set(TREE_STAGE_COLORS.A).size).toBe(5);
    expect(new Set(TREE_STAGE_COLORS.B).size).toBe(5);
  });
});
