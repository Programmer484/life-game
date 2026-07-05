import { describe, it, expect } from 'vitest';
import { ART_MANIFEST } from '../index.ts';

describe('art manifest', () => {
  const allUrls = [
    ...Object.values(ART_MANIFEST.tile),
    ART_MANIFEST.fog,
    ...Object.values(ART_MANIFEST.tree).flatMap((stages) => Object.values(stages)),
  ];

  it('covers exactly the expected keys (4 vibrancy levels + fog + 2 types x 5 stages)', () => {
    expect(Object.keys(ART_MANIFEST.tile).sort()).toEqual(['0', '1', '2', '3']);
    expect(typeof ART_MANIFEST.fog).toBe('string');
    expect(Object.keys(ART_MANIFEST.tree).sort()).toEqual(['A', 'B']);
    expect(allUrls).toHaveLength(15);
  });

  it('has stages 1-5 for both tree types', () => {
    for (const type of ['A', 'B'] as const) {
      expect(Object.keys(ART_MANIFEST.tree[type]).sort()).toEqual(['1', '2', '3', '4', '5']);
    }
  });

  it('all URLs are distinct', () => {
    expect(new Set(allUrls).size).toBe(allUrls.length);
  });

  it('all URLs start with /art/ and end with .png', () => {
    for (const url of allUrls) {
      expect(url).toMatch(/^\/art\/[\w-]+\.png$/);
    }
  });

  it('maps vibrancy 0 to the dead tile and 3 to the vibrant tile', () => {
    expect(ART_MANIFEST.tile[0]).toBe('/art/tile-dead.png');
    expect(ART_MANIFEST.tile[1]).toBe('/art/tile-vibrancy-1.png');
    expect(ART_MANIFEST.tile[2]).toBe('/art/tile-vibrancy-2.png');
    expect(ART_MANIFEST.tile[3]).toBe('/art/tile-vibrant.png');
    expect(ART_MANIFEST.fog).toBe('/art/tile-fog.png');
  });

  it('tree URLs encode type and stage', () => {
    for (const type of ['A', 'B'] as const) {
      for (const stage of [1, 2, 3, 4, 5] as const) {
        expect(ART_MANIFEST.tree[type][stage]).toBe(
          `/art/tree-${type.toLowerCase()}-stage-${stage}.png`,
        );
      }
    }
  });
});
