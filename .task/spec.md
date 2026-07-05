# S8 · XP bar (UI)

**Module:** `ui` (src/modules/ui) — this slice touches ONLY this module.
Same rails as S7: plain DOM, no Pixi, reads state via public surfaces,
happy-dom pragma tests.

## Behavior

A horizontal XP bar showing progress toward the next section unlock.

### Public surface (additions to `index.ts`)

- `createXpBar(): XpBar` with
  `XpBar = { el: HTMLElement; update(state: GameplayState): void }`

### Rules

- `update(state)` sets the bar's fill fraction from `xpProgress(state)`
  (systems): fill width `${progress * 100}%`, clamped [0,100].
- Bar full (progress ≥ 1) ⇔ the unlock condition is met — add a `data-full`
  attribute (or `is-full` class) when full so S13/styling can react.
- Show a small numeric label: fully-grown count vs next cost (e.g. `4 / 8`)
  from `fullyGrownCount(state.trees)` and the next locked section's cost from
  `UNLOCK_COSTS`; when everything is unlocked, label reads `MAX`.
- Repeated updates re-render without duplicating DOM or leaking listeners.
- Stable hooks: `data-testid="xp-bar"`, `"xp-bar-fill"`, `"xp-bar-label"`.
  Minimal inline placeholder styling.

## Done when

DOM tests written FIRST (happy-dom pragma):

- fill width reflects xpProgress (0 for no trees; 50% for 4 fully grown with
  section 2 already unlocked — 4/8 toward section 3);
- the full marker appears exactly when progress reaches 1 (4 fully grown,
  nothing unlocked yet) and is absent below it;
- the label shows fully-grown count vs next cost, and MAX when all sections
  are unlocked;
- repeated updates do not duplicate DOM nodes.

`pnpm verify` green (ui is polish-lane).

## Out of scope

Triggering the unlock (systems/S13 wiring), animations, planting modal, dev
panel, styling polish. Everything not listed. No changes outside
`src/modules/ui/` (plus `.task/`).
