# S6 · Progression system

**Module:** `systems` (src/modules/systems) — this slice touches ONLY this
module. Headless, pure, immutable. Builds on S5's `GameplayState`.

## Behavior

Fully-grown trees drive XP and section unlocks; the first unlock also makes
tree type B available.

### Rules

- `UNLOCK_COSTS = [4, 8, 16, 32, 64, 128]` are CUMULATIVE totals of fully
  grown (complete) trees required to unlock sections 2..7. Trees are never
  removed, so the count only grows. Sections unlock strictly in id order.
- Unlock trigger (game rule): section k (k=2..7) unlocks when
  `fullyGrownCount >= UNLOCK_COSTS[k-2]` and section k-1 is already unlocked.
- XP bar value (display formula, §4.5 verbatim):
  `progress = (Σ over trees of min(tasksDone, 18) / 18) / unlockCost` where
  `unlockCost` is the next locked section's cost; clamp to [0, 1]. When all
  sections are unlocked, progress is 1.
- Tree type B: available ⇔ at least one section beyond the starting section
  is unlocked (derived, no extra state field).

### Public surface (additions to `index.ts`)

- `fullyGrownCount(trees): number`
- `xpProgress(state): number` — the display formula above.
- `applyProgression(state): GameplayState` — unlocks every section whose
  threshold is now met (in order; the dev panel can jump multiple), lifting
  fog via world's `unlockSection` (tiles become dead/plantable). No-op when
  nothing qualifies. Idempotent.
- `availableTreeTypes(state): TreeType[]` — `['A']` before the first unlock,
  `['A', 'B']` after.

## Done when

Tests written FIRST from this spec.

Example tests (mirror acceptance §7):

- 4 fully grown trees ⇒ xpProgress reaches 1, applyProgression lifts section
  2's fog (its tiles become dead), and type B becomes available;
- 3 fully grown trees ⇒ section 2 stays fogged and only type A is available;
- unlock progress carries: with 4 fully grown and section 2 unlocked, the bar
  shows 4/8 = 0.5 toward section 3;
- partial trees contribute fractionally to xpProgress (e.g. one tree at 9/18
  adds 0.5 tree-units) but do NOT count toward the unlock trigger;
- applyProgression is idempotent and immutable; sections unlock in order.

Property test (fast-check) — the demo-protecting invariant (the ONLY property
for this slice):

- For any fully-grown count n and next locked section with cost c: after
  applyProgression the section is unlocked ⇔ n ≥ c (the unlock fires exactly
  at its configured cost, never below it).

`pnpm verify` green.

## Out of scope

UI (bar rendering), dev panel, story, persistence, wiring events end-to-end
(S13). Everything not listed. No changes outside `src/modules/systems/`
(plus `.task/`).
