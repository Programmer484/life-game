// loadArt is a mechanical URL -> Texture mapping over ART_MANIFEST; mock
// pixi.js Assets.load so the mapping (and its missing-texture guard) is
// exercised without any real loading.
import { describe, it, expect, vi } from 'vitest';

vi.mock('pixi.js', () => ({
  Assets: {
    load: vi.fn(async (urls: string[]) =>
      Object.fromEntries(urls.map((url) => [url, { label: url }])),
    ),
  },
}));

const { loadArt } = await import('../index.ts');
const { ART_MANIFEST } = await import('../index.ts');
const { Assets } = await import('pixi.js');

describe('loadArt', () => {
  it('maps every manifest URL to its loaded texture, keyed like the manifest', async () => {
    const art = await loadArt();
    expect((art.fog as { label?: string }).label).toBe(ART_MANIFEST.fog);
    for (const v of [0, 1, 2, 3] as const) {
      expect((art.tile[v] as { label?: string }).label).toBe(ART_MANIFEST.tile[v]);
    }
    for (const type of ['A', 'B'] as const) {
      for (const stage of [1, 2, 3, 4, 5] as const) {
        expect((art.tree[type][stage] as { label?: string }).label).toBe(
          ART_MANIFEST.tree[type][stage],
        );
      }
    }
  });

  it('throws a named error when a texture is missing from the load result', async () => {
    vi.mocked(Assets.load).mockResolvedValueOnce({});
    await expect(loadArt()).rejects.toThrow(/failed to load/);
  });
});
