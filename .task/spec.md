# S1 · Island data & land logic

**Module:** `world` (src/modules/world) — this slice touches ONLY this module.
Types/constants come from the `config` module (already in allowedImports).
Headless: no Pixi, no DOM, no I/O.

## Behavior

`world` owns the land: which tile is in which section, each tile's state, and
the state transitions. It is pure data + pure functions. Prefer immutable
updates (functions return a new World); never mutate config's ISLAND_LAYOUT.

### Public surface (`index.ts`)

- `World` type — sections + per-tile state, built from `ISLAND_LAYOUT`.
- `createWorld(): World` — every tile of a section with `unlockedAtStart`
  starts `'dead'`; every tile of a locked section starts `'fog'`.
- `tileState(world, coord): TileState | undefined` — undefined for coords not
  on the island.
- `sectionOf(world, coord): number | undefined`
- `isSectionUnlocked(world, sectionId): boolean` — true when its tiles are no
  longer fog.
- `unlockSection(world, sectionId): World` — that section's tiles go
  `fog → dead`. Tiles of other sections are untouched. Unlocking an already
  unlocked section is a no-op.
- `revealAround(world, center: TileCoord): World` — converts the
  `REVEAL_SIZE` (3×3) area centered on `center` from `dead → vibrant`.
  Rules: only `dead` tiles change; `fog` tiles are NOT revealed; coords off
  the island are ignored; `vibrant` stays `vibrant`.
- `transitionTiles(world): TileCoord[]` — the dead tiles that border at least
  one vibrant tile (8-neighbour adjacency: orthogonal + diagonal). These are
  rendered as half-dead later; this slice only derives the set.

### Invariants (enforced by the API shape — no regressing functions exist)

- Land never regresses: no public function turns vibrant → dead or dead → fog.

## Done when

Tests written FIRST from this spec (names read like the spec):

- createWorld: section-1 tiles dead, locked-section tiles fog, off-island
  coords undefined.
- unlockSection: exactly the target section's fog turns dead; other sections
  untouched; idempotent.
- revealAround: full 3×3 turns vibrant on interior dead land; fog neighbours
  are untouched; off-island cells ignored; already-vibrant cells stay; a
  second overlapping reveal only adds.
- transitionTiles: a revealed 3×3 in a dead field yields exactly the ring of
  dead tiles around it (8-adjacency); no transition tiles when nothing is
  vibrant; fog tiles never appear in the result.
- `pnpm verify` green (coverage floor 40 applies to this module).

## Out of scope

Everything not listed: no trees/goals/tasks, no XP/unlock triggers (S6 calls
`unlockSection`), no rendering, no persistence, no demo start state, no
changes outside `src/modules/world/` (plus `.task/`).
