What was built, where it lives, and which decisions you'd want to know about
before suggesting changes. Supersedes the v1 overview: written after the UI
polish pass (PRs #15–#21) which added real sprite art, the vibrancy
mechanic, and the shared DOM design system. The PRD (§ numbers below)
remains the behavior source of truth for the core loop; the vibrancy
mechanic was ordered at the A0 art gate and is specced only here and in
PR #20.

## 1. Big picture (unchanged from v1)

- **Modular monolith**, 10 modules under `src/modules/`, boundaries enforced
  by lint rules generated from `module-map.json` (imports only via a
  module's `index.ts`; per-module external-package allowlists).
- **ECS-lite**: all game logic is pure functions over plain data (`world`,
  `entities`, `systems` — no Pixi, no DOM, no I/O). Side effects live at the
  edges: Pixi in `render`/`core-app`/`core-viewport`, DOM in `ui`, Supabase
  in `save` behind a Nullable gateway.
- **One headless controller** (`core-app/internal/game.ts`, `createGame`)
  owns state and event flow. The Pixi/DOM shell (`core-app/internal/app.ts`
  - `src/main.ts`) is a thin, untested adapter driving the controller and
    re-rendering on `subscribe` ticks. All §7 acceptance tests run against
    the controller with null gateways — no browser needed.

```
user input (DOM/canvas)
  → ui callbacks / viewport clicks       (intent only)
  → createGame methods                   (core-app, headless)
  → autosaver.schedule(toSave(state))    (debounced persist)
  → notify() → subscribers               (shell redraws sprites + UI)
```

## 2. Module map (who may import what)

| Module          | Purpose                                                        | Imports                                        | Externals              |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------- | ---------------------- |
| `config`        | ALL shared types + every tunable (now incl. vibrancy)          | —                                              | pure                   |
| `world`         | tile states, unlock, 3×3 reveal, **vibrancy**                  | config                                         | pure                   |
| `entities`      | goal/task/tree factories, ordered task completion              | config                                         | pure                   |
| `systems`       | growth, planting+cap+focus, XP/progression                     | config, world, entities                        | pure                   |
| `render`        | world/tree → **texture sprites**, iso projection               | config, entities, world, core-viewport, assets | pixi.js                |
| `ui`            | DOM overlay on the **shared `lg-` design system**              | config, entities, world, systems               | pure                   |
| `save`          | versioned save schema, Nullable Supabase gateways              | config, world, entities                        | @supabase/supabase-js  |
| `core-viewport` | the ONLY pixi-viewport importer (drag panning)                 | config                                         | pixi.js, pixi-viewport |
| `assets`        | **art manifest + texture loader** (palette deleted)            | config                                         | pixi.js                |
| `core-app`      | headless controller + app shell wiring (**`await loadArt()`**) | everything                                     | pixi.js                |

To change an edge: edit `module-map.json`, never `eslint.config.js`.

## 3. The vibrancy mechanic (new in v2, PR #20)

Land health is an integer **vibrancy 0–3** per tile, replacing the old
derived half-dead transition tiles (`transitionTiles` is deleted; nothing
half-dead remains anywhere).

- **Rule**: each tree adds **+3 to its own tile, +2 at Manhattan distance
  1, +1 at distance 2** (so a diagonal neighbour gets +1). Contributions
  from all trees are **cumulative**, clamped to 3. 0 = dead land. ALL
  trees count, any stage, forever (trees are never removed).
- **Where**: tunables in `config` (`VIBRANCY_MAX`, `VIBRANCY_CONTRIBUTION = [3, 2, 1]` indexed by distance); pure `vibrancyAt(tile, treeTiles)` /
  `vibrancyMap(world, treeTiles)` in `world/internal/world.ts` (tree
  positions arrive as plain `TileCoord[]` — world still imports only
  config); the controller exposes `game.tileVibrancy(): ReadonlyMap<string, Vibrancy>` keyed `"x,y"`, recomputed per call from
  `state.trees`.
- **Fog is orthogonal**: `TileState` is still `fog | dead | vibrant` and
  reveal logic is untouched. Fog covers unrevealed land; a fogged tile has
  a computed vibrancy but render draws fog by TileState, not the map.
- **Derived, never stored**: vibrancy is a pure function of tree
  positions, so the save format is unaffected. ⚠️ If a future feature
  makes land vibrant without a tree (or removes trees), the save schema
  must start persisting tile state — that is the moment to bump
  `SaveDataV1`.
- ⚠️ **Plantability still keys off `TileState`, not vibrancy** (`canPlant`
  reasons unchanged: `off-island | fogged | occupied | cap`). Whether low
  vibrancy should block planting is an open design question — deciding it
  touches `systems/internal/planting.ts` only.

## 4. Art pipeline (new in v2, PRs #16–#17)

- **15 PNGs in `public/art/`** (served verbatim by Vite; no TS imports, no
  knip entries): 5 tiles at 256×128 (`tile-dead`, `tile-vibrancy-1`,
  `tile-vibrancy-2`, `tile-vibrant`, `tile-fog` — a whole-tile gradient,
  one image per vibrancy level, no orientation variants) and 10 trees at
  256×384 (`tree-{a,b}-stage-{1..5}`; A = broadleaf greens, B = teal
  conifer).
- `assets` exports `ART_MANIFEST` and `loadArt(): Promise<ArtTextures>`
  (one Pixi 8 `Assets.load`), shaped `{ tile: Record<0|1|2|3, T>, fog: T, tree: Record<TreeType, Record<1|2|3|4|5, T>> }` — cast-free lookups by
  vibrancy number or (type, stage). The old `TILE_COLORS` /
  `TREE_STAGE_COLORS` palette is **deleted**.
- ⚠️ **Art files are load-bearing at boot**: `loadArt` throws on any
  missing texture and `app.ts` awaits it — a deleted/renamed PNG is a
  boot failure, not a visual glitch. Adding a vibrancy level or tree
  stage = art file + manifest key + `Vibrancy`/`TreeStage` type, together.
- **Growth ladder is baked into the tree canvases** (content height
  18/38/58/78/97% of 384px by stage). Render uses ONE uniform scale
  (`TREE_SCALE = 0.25` → stage 5 ≈ 2 tiles tall). Never normalize sprite
  height per stage — that erases the arc. Trunk anchor (0.5, 1.0) was
  computed from pixels at generation time.
- Regenerating or extending the set: follow the
  `.claude/skills/game-art-generation` skill (master style prompt is
  recorded in PR #16's description; keep it verbatim, anchor new images
  on existing ones via image-to-image).

## 5. Rendering (rewritten in v2, PR #21)

- Iso projection unchanged: `render/internal/iso.ts`, 64×32 diamonds,
  `tileToScreen`/`screenToTile` pure and round-trip-tested.
  `tileToScreen` returns the diamond CENTER — tile sprites anchor
  (0.5, 0.5), tree sprites anchor (0.5, 1.0), both at that point.
- Tiles: one `Sprite` per tile; the pure, tested mapping is
  `textureKeyForTile(state, vibrancy)` in
  `render/internal/texture-key.ts` (fog wins over vibrancy; 0–3 → the
  four tile textures). Trees: one `Sprite` per
  `TreeViewModel { id, tile, type, stage }`.
- **Depth**: tree layer has `sortableChildren = true`, `zIndex = screenY`
  — trees lower on the island draw in front; tiles live in a lower layer
  so they never occlude trees.
- **Full redraw** on every update, deliberately — fine at ~250 tiles.
  Revisit with diffing only if the island grows ~10×.
- Boot: `app.ts` does one `await loadArt()` and passes `ArtTextures`
  through `drawWorld`/`updateWorld`/`updateTrees` as parameters.

## 6. UI design system (new in v2, PRs #15 + #19)

- One internal file, `ui/internal/styles.ts`: `ensureStyles()` injects a
  single `<style id="lg-styles">` tag (idempotent; every component factory
  calls it first). No CSS files, no CSS packages — `ui` stays pure DOM.
- **Tokens** on `:root`, sampled FROM the art so canvas and overlay read
  as one product: `-lg-accent #64a047` / `-lg-accent-bright #9eca4e`
  (vibrant tile), `-lg-accent-2 #309395` / `-lg-accent-2-deep #185e6b`
  (type-B conifer), `-lg-bg-panel #1e222c` (fog family), `-lg-danger #c0503e`, plus radius/space-1..3/font/shadow. If the art palette ever
  changes, re-sample and update these together.
- **Classes**: `.lg-btn` (+`-primary`/`-ghost`/`-danger`, visibly inert
  disabled state — the dev panel relies on it), `.lg-panel`,
  `.lg-modal-backdrop`/`.lg-modal`, `.lg-input`, `.lg-bar`/`.lg-bar__fill`
  (width transition; `data-full` glow — note the bar sets `data-full` on
  its ROOT, and the sheet has a matching descendant selector),
  `.lg-hud` (fixed overlay container: pointer-events none, children
  absolute + interactive), `.lg-prose` (story text).
- Layout lives at the shell mount point (`app.ts`): tasks panel top-left,
  XP bar top-center, reflect + dev panel bottom-right cluster. Story and
  auth are full-screen `.lg-modal-backdrop` + `.lg-modal`; the planting
  modal deliberately has NO backdrop — one would block canvas clicks
  while it is open.
- `ensureStyles` is intentionally NOT exported from `ui`'s `index.ts`
  (knip: `__tests__/**` count as entries, components import it via the
  module's own internal path).
- All components keep the v1 shape: `create*(deps) → { el, update(state) }`,
  stable `data-testid` hooks, happy-dom tests per-file pragma.

## 7. State model & core loop (unchanged from v1)

`GameplayState = { world, trees, goals, focusedTreeId? }` (in `systems`),
fully immutable. Facts derived, never stored: growth stage, **vibrancy**,
type-B availability, XP progress, fully-grown count. Prefer deriving over
new state fields — smaller saves, rarer migrations. Tasks complete strictly
in order (`entities.completeNextTask` is the only path); `applyTaskCompleted`
drops stale/duplicate/unknown events. Unlock fires on `fullyGrownCount ≥ UNLOCK_COSTS[k]` (cumulative totals, strictly in section order); the XP bar
shows the §4.5 fractional formula, which can read full slightly before the
unlock fires when partial trees exist. Focus: most recently planted; only
active trees focusable; completing the focused tree leaves focus empty.

Change levers (all tunables in `config/internal/config.ts`, nothing
inlined): `STAGE_TASKS`, `TASKS_PER_TREE = 18`, `ACTIVE_TREE_CAP = 3`,
`REVEAL_SIZE`, `UNLOCK_COSTS`, `ISLAND_LAYOUT` (reshape the island by
editing this one array), `GOAL_TEMPLATES`, `STORY_BLOCKS`, and now
`VIBRANCY_MAX` / `VIBRANCY_CONTRIBUTION`. Land never regresses: there is
deliberately no public API for vibrant→dead or dead→fog (but note vibrancy
itself is recomputed, not stored — it would "regress" only if trees could
be removed, which they can't).

## 8. Save & auth (unchanged from v1)

`SaveDataV1 = { version: 1, storySeen, unlockedSections, trees, goals }`;
focus not persisted; `migrateSave(raw)` is the version dispatch. Hydration
rebuilds `createWorld()`, re-applies unlocks, `revealAround`s every tree —
vibrancy then derives from the same trees, so v2 required NO save change.
Gateways: null (in-memory) without `.env.local`, real Supabase with it
(table `saves`, one jsonb row per user, RLS own-row). ⚠️ Still true:
Supabase "Confirm email" is ON in the dashboard — signup returns no session
until confirmed.

## 9. Gates & tests (state after v2)

- Coverage floor **40** all four metrics; `render`/`ui` polish-lane (zero
  floor, still measured); ratchet raise-only vs origin/main. Mutation
  (Stryker) CI job still commented out; property tests still capped at the
  three demo-protecting invariants (growth monotonic/no-skip/18⇔stage-5,
  cap never exceeded, unlock exactly at cost) — vibrancy is covered
  example-based only, deliberately.
- Pure new surfaces are fully tested: `vibrancyAt`/`vibrancyMap` (100%),
  `textureKeyForTile`, `ART_MANIFEST` shape, `ensureStyles` idempotency.
  Pixi-touching draw code stays thin and untested.
- §7 acceptance tests in `core-app/__tests__/game.test.ts` were extended
  with vibrancy assertions (plant → 3/2/1 ring, stacking, clamp,
  completed trees still contribute) and the transition-tile test was
  rewritten to reveal-only. Extend these first when changing the loop.

## 10. Known issues & repo process state

- ⚠️ **Pre-existing shell bug (repros on origin/main, predates v2)**: the
  dev-panel "Plant fully grown tree" button dispatches but never changes
  controller state in the browser — §7 headless tests pass, so the gap is
  in `app.ts` wiring. Needs a follow-up ticket; do not confuse it with a
  v2 regression.
- v2 shipped as **6 draft PRs**; merge in this order (stacked bases):
  **#15** (ui tokens) → **#19** (ui sweep, base #15) → **#16** (art) →
  **#17** (assets manifest, base #16) → **#20** (vibrancy, base main) →
  **#21** (sprite render, base #17, also contains #20's commits until #20
  merges). The #21/#19 overlap in `app.ts` (boot lines vs mount lines)
  auto-merges cleanly — verified locally with a full-stack merge +
  verify + in-browser check.
- `pnpm build`: the >500 kB pixi chunk warning remains cosmetic.
- Meta: `.claude/skills/orchestrate-slices` (PR #22) and
  `.claude/skills/game-art-generation` (PR #23) document how this pass
  was run and how to regenerate art.
- Still not built (unchanged v1 scope cuts): zoom, animations/tweens
  (canvas feel was the optional B3 — not requested), browser smoke tests,
  Reflect behavior, the goal-setting chatbot behind the modal placeholder,
  password reset / auth polish, save conflict handling beyond
  last-write-wins.
