# Slice V1 — Tile vibrancy 0–3 from tree proximity

Owner mechanic (verbatim): "We can have a simple mechanic measuring vibrancy
of a tile. Each tree adds +3 to its own tile, +2 to tiles 1 orthogonal step
away and +1 to tiles 2 orthogonal steps away. And the effect is cumulative.
a tile of 3 vibrancy is the highest. 0 defaults to dead land. Fog simply
covers land that hasn't been revealed yet."

## Scope

1. `config`: `VIBRANCY_MAX = 3`, `VIBRANCY_CONTRIBUTION = [3, 2, 1]` (indexed
   by Manhattan distance 0/1/2), shared `Vibrancy` type (0|1|2|3).
2. `world` (pure, imports config only): `vibrancyAt(tile, treeTiles)` and
   `vibrancyMap(world, treeTiles)` — trees as plain `TileCoord[]` data.
   Manhattan distance; sum over ALL trees; clamp to 3. REMOVE
   `transitionTiles` + the half-dead concept. Reveal/unlock/plantability
   rules unchanged.
3. `core-app`: controller exposes precomputed per-tile vibrancy to render
   (like `treeViewModels`). ALL trees count, any stage, forever. Update §7
   acceptance tests that referenced transition tiles; add vibrancy
   acceptance coverage (own tile 3, diagonal 1, stacking).
4. `render`: interim color mapping only — fog→fog, 0→dead, 1–2→halfDead,
   3→vibrant. No sprites. Rewrite tile-color tests for the new mapping.
5. Tests example-based; no new property invariants.
6. Untouched: assets, ui, save, entities. systems only if a
   transitionTiles import forces it (its planting test does — report).

Finish: `pnpm verify` + `pnpm build` green. Ship:
`pnpm pr "feat(world): tile vibrancy 0-3 from tree proximity"`.
