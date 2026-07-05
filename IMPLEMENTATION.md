# Life Game v1 — Implementation Overview

What was built, where it lives, and which decisions you'd want to know about
before suggesting changes. Written after the v1 slice stack (PRs #1–#14)
landed. The PRD (§ numbers below) remains the behavior source of truth; this
doc is the map from PRD to code.

## 1. Big picture

- **Modular monolith**, 10 modules under `src/modules/`, boundaries enforced
  by lint rules generated from `module-map.json` (imports only via a module's
  `index.ts`; per-module external-package allowlists).
- **ECS-lite + A-Frame**: all game logic is pure functions over plain data
  (`world`, `entities`, `systems` — no Pixi, no DOM, no I/O). Side effects
  live at the edges: Pixi in `render`/`core-app`/`core-viewport`, DOM in
  `ui`, Supabase in `save` behind a **Nullable gateway**.
- **One headless controller** (`core-app/internal/game.ts`, `createGame`)
  owns the state and the event flow. The Pixi/DOM shell
  (`core-app/internal/app.ts` + `src/main.ts`) is a thin, untested adapter
  that drives the controller and re-renders on its `subscribe` ticks. All
  acceptance tests (PRD §7) run against the controller with null gateways —
  no browser needed.

```
user input (DOM/canvas)
  → ui callbacks / viewport clicks        (intent only, no state changes)
  → createGame methods                    (core-app, headless)
      completeNextTask → applyTaskCompleted → applyProgression
      plantAt          → plantTree        → applyProgression
  → autosaver.schedule(toSave(state))     (debounced persist)
  → notify() → subscribers                (shell redraws world/trees + UI)
```

## 2. Module map (who may import what)

| Module          | Purpose                                                                | Imports                                        | Externals              |
| --------------- | ---------------------------------------------------------------------- | ---------------------------------------------- | ---------------------- |
| `config`        | ALL shared types + every tunable number/text (§5)                      | —                                              | pure                   |
| `world`         | tile states, unlock, 3×3 reveal, transition tiles                      | config                                         | pure                   |
| `entities`      | goal/task/tree factories, ordered task completion                      | config                                         | pure                   |
| `systems`       | growth, planting+cap+focus, XP/progression                             | config, world, entities                        | pure                   |
| `render`        | world/tree → Pixi sprites, iso projection                              | config, entities, world, core-viewport, assets | pixi.js                |
| `ui`            | DOM overlay: tasks panel, XP bar, modal, dev panel, story, auth screen | config, entities, world, systems               | pure                   |
| `save`          | versioned save schema, Nullable Supabase gateways                      | config, world, entities                        | @supabase/supabase-js  |
| `core-viewport` | the ONLY pixi-viewport importer (drag panning)                         | config                                         | pixi.js, pixi-viewport |
| `assets`        | placeholder palette (tile + tree-stage colors)                         | config                                         | pixi.js                |
| `core-app`      | headless game controller + app shell wiring                            | everything                                     | pixi.js                |

(`vitest`/`fast-check` are additionally allowed everywhere for tests.)
To change an edge: edit `module-map.json`, never `eslint.config.js`.

## 3. Where each rule lives (change levers)

Every tunable is in `config` (`src/modules/config/internal/config.ts`) —
nothing is inlined:

- `STAGE_TASKS = [3,4,5,6]`, `TASKS_PER_TREE = 18`, `ACTIVE_TREE_CAP = 3`,
  `REVEAL_SIZE = 3×3`, `UNLOCK_COSTS = [4,8,16,32,64,128]`.
- `ISLAND_LAYOUT`: 7 sections built from offset `rectTiles(...)` blocks
  (six 36-tile, one 40-tile) — section 1 at (0,0)–(5,5), others arranged
  around it so the union is jagged. Reshaping the island = editing this one
  array; `world` derives everything from it.
- `GOAL_TEMPLATES` (Sleep/Workout, 18 tasks each) and `STORY_BLOCKS`
  (6 blocks, verbatim) — content changes are config-only edits.

Logic levers:

- Stage math: `systems/internal/growth.ts` (`stageOf` derives stages
  cumulatively from `STAGE_TASKS`; complete ⇔ `tasksDone ≥ 18` ⇔ stage 5).
- Planting rules: `systems/internal/planting.ts` (`canPlant` reasons:
  `off-island | fogged | occupied | cap`; the cap counts ACTIVE trees only —
  complete trees keep their tile forever but free their slot).
- Unlock/XP: `systems/internal/progression.ts` (see §5 below).
- Land rules: `world/internal/world.ts` — immutable `World` over a
  `ReadonlyMap`; there is deliberately NO function that regresses land
  (vibrant→dead or dead→fog is unrepresentable via the public API).
- Transition (half-dead) tiles are DERIVED, not stored:
  `transitionTiles(world)` = dead tiles with a vibrant 8-neighbour.

## 4. State model

`GameplayState = { world, trees, goals, focusedTreeId? }` (defined in
`systems`). Everything is immutable — every system returns a new state; the
controller holds the current one. Facts derived, never stored: growth stage,
transition tiles, type-B availability (⇔ any section beyond section 1
unlocked), XP progress, fully-grown count. If you add a feature, prefer
deriving over adding state fields — it keeps saves smaller and migrations
rarer.

Tasks complete **strictly in order**: `entities.nextTaskIndex/completeNextTask`
is the only path; there is no complete-arbitrary-task API (matches the
next-task-only panel). Events are `taskCompletedEvent(treeId, taskIndex)`;
`applyTaskCompleted` drops stale/duplicate events (index mismatch), unknown
treeIds, and events on finished goals.

## 5. PRD judgment calls (worth knowing before suggesting changes)

1. **Unlock trigger vs XP formula.** §4.6 gates unlocks on _fully grown_
   trees; §4.5's bar formula counts partial progress. Implementation:
   unlocks fire on `fullyGrownCount ≥ UNLOCK_COSTS[k]` (the game rule, and
   what the property test protects); the bar shows the §4.5 formula verbatim
   (fractional tree-units / next cost, clamped). They coincide exactly when
   no partial trees exist (the dev-panel demo path); with partials the bar
   can read full slightly before the unlock fires.
2. **Unlock costs are CUMULATIVE totals** (4 total fully-grown for section 2,
   8 total for section 3, …). Trees are never removed so the count only
   grows; leftover progress carries (after unlocking section 2, the bar
   starts at 4/8 toward section 3).
3. **Sections unlock strictly in id order**, and `applyProgression` can
   unlock several at once (dev-panel jumps).
4. **Focus semantics** (`systems/internal/planting.ts`): default = most
   recently planted; only ACTIVE trees are focusable; `focusedTree()` returns
   undefined once the focused tree completes (the panel goes idle rather
   than auto-refocusing another tree — a deliberate v1 simplification).
5. **Render knows no game logic.** Tree markers are drawn from
   `TreeViewModel { id, tile, type, stage }` precomputed by the controller,
   so `render` never imports `systems`. If you want richer visuals, extend
   the view model, not render's imports.
6. **`devPlantFullyGrown`** plants through the normal flow, completes all 18
   tasks, then restores the previous focus (a finished tree can't stay
   focused). **`devSkipStage`** loops `completeNextTask` until the stage
   increments or the tree completes.

## 6. Rendering

- Iso projection in `render/internal/iso.ts`: 64×32 (2:1) diamonds,
  `tileToScreen`/`screenToTile` are pure and unit-tested round-trip.
- `drawWorld` = one `Graphics` diamond per tile, colored by state from
  `assets` (`TILE_COLORS`: fog near-black, dead sludge, half-dead mix,
  vibrant green); `updateWorld`/`updateTrees` do FULL redraws — fine at
  ~250 tiles, revisit only if the island grows 10×.
- Tree markers colored by `TREE_STAGE_COLORS[type][stage-1]` (A greens,
  B teals). All "art" is flat colors — swapping in sprites later means
  touching `assets` (textures) + `render` draw calls only.
- Panning: `core-viewport.createViewport` = pixi-viewport 6 with `.drag()`;
  no zoom in v1. Clicks: viewport `clicked` → `screenToTile` → tree? focus :
  plantable? open modal.
- Pixi 8 gotcha: init is async (`await app.init(...)`). Also
  `tsconfig` uses `module: preserve` / `moduleResolution: bundler` because
  pixi-viewport 6's type declarations don't resolve under NodeNext.

## 7. UI (DOM overlay)

All components share one shape: `create*(deps) → { el, update(state) }` —
they render from state and emit intent via callbacks, never mutating state
themselves. Stable `data-testid` hooks throughout. Components: tasks panel
(next task only), XP bar (`data-full` marker when full), planting modal
(disabled chat placeholder → Autofill → two templates; type B appears only
after first unlock), reflect button (inert placeholder), dev panel (always
visible; skip disabled without a focused tree), story screen (6 blocks, one
Next, no skip), auth screen (email/password, sign in + sign up). Tests run
in happy-dom via a per-file pragma (`happy-dom` is a devDependency only).

## 8. Persistence & auth

- **Save format** (`save/internal/schema.ts`): `SaveDataV1 = { version: 1,
storySeen, unlockedSections, trees, goals }`. Focus is NOT persisted.
  `migrateSave(raw)` is the version dispatch — v2 changes go there; invalid
  or unknown payloads hydrate as "no save" → demo state.
- **Hydration** (`fromSave`): rebuild `createWorld()`, re-apply unlocks, then
  `revealAround` at every tree's tile. Vibrancy is therefore _derived from
  trees_ — if a future feature makes land vibrant without a tree, the save
  schema must start persisting tile states.
- **Demo state**: one type-A sapling, Sleep plan, 0 done, at tile (1,1) (the
  first section-1 tile whose 3×3 fits inside the section), 3×3 vibrant,
  storySeen false.
- **Gateways**: `SaveGateway` + `AuthGateway`; `createNullGateways(seed?)`
  (in-memory, all logic tests) and `createSupabaseGateways(url, key)` (thin
  untested shell over `createClient`; table `saves` — one row per user,
  whole save doc in a jsonb `data` column, RLS own-row policies; DDL in
  `src/modules/save/supabase.sql`, already applied to the "Life Game"
  project).
- **Autosaver**: debounced (injectable timers), scheduled on every task
  completion / plant / unlock; `flushSave()` forces a write.
- **Boot** (`core-app/internal/app.ts`): `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_ANON_KEY` present (`.env.local`, gitignored) → real
  gateways, else null gateways (console.info says which). ⚠️ Known gap:
  Supabase "Confirm email" is ON in the dashboard — signup returns no
  session until confirmed; turn it off for the sign-up-and-play flow.

## 9. Testing & gates (v1 prototype tier)

- Coverage floor **40** (all four metrics, aggregate) — `render`/`ui` are
  polish-lane (zero floor, still measured). The ratchet forbids lowering the
  floors vs origin/main; raise-only. Mutation (Stryker) CI job is commented
  out for v1 in `.github/workflows/ci.yml`; config kept ready (break 60).
- Property tests are deliberately limited to the three demo-protecting
  invariants: growth monotonic + never skips a stage + stage 5 exactly at 18
  (`systems/__tests__/growth.property.test.ts`); active cap never exceeded
  (`planting.property.test.ts`); unlock fires exactly at cost
  (`progression.property.test.ts`). Everything else — including the save
  round-trip — is example-based. Keep it that way until the design settles.
- `pnpm verify` = format → lint (boundaries) → typecheck → tests+coverage →
  ratchet → knip; identical locally, pre-commit, and CI. Framework
  self-tests (`test/**`) run separately (`pnpm test:framework`) and now
  derive gate expectations from the repo map/config instead of hard-coding
  them.
- §7 acceptance checks live as 17 headless tests in
  `core-app/__tests__/game.test.ts` — the closest thing to an end-to-end
  suite; extend them first when changing the core loop.

## 10. Repo process state

- v1 shipped as a **stacked PR chain**: #1 (S0, base `main`) → … → #14
  (S13). Each PR shows only its slice; merge in order — each merge
  retargets the next. Don't rebase a slice branch alone; propagate by
  merging the earlier branch forward.
- `pnpm dev` runs the game now (null gateways without `.env.local`).
  `pnpm build` passes (one >500 kB chunk warning from pixi.js — cosmetic;
  fix later with a manual chunk split if it bothers you).
- Not yet built (explicitly out of v1 scope): zoom, animations/tweens, real
  art, browser smoke tests (Playwright), Reflect behavior, the goal-setting
  chatbot behind the modal placeholder, password reset / auth polish,
  debounce/conflict handling beyond last-write-wins on one save row.
