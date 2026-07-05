# S10 · Reflect placeholder + dev panel (UI)

**Module:** `ui` (src/modules/ui) — this slice touches ONLY this module.
Same rails as S7–S9: plain DOM, no Pixi, happy-dom pragma tests, intent out
via callbacks only.

## Behavior

Two small overlay pieces:

### Reflect button

- `createReflectButton(): { el: HTMLElement }` — a visible button labeled
  "Reflect". It does NOTHING yet (placeholder): clicking must not throw and
  must not emit anything. `data-testid="reflect-button"`.

### Dev panel (always visible in v1)

- `createDevPanel(deps: { onSkipStage: () => void; onPlantFullyGrown: () => void }): DevPanel`
- `DevPanel = { el: HTMLElement; update(state: GameplayState): void }`
- Two buttons:
  - **"Skip to next tree stage"** (`data-testid="dev-skip-stage"`) — emits
    `onSkipStage()`; S13 wires it to auto-complete the focused tree's
    remaining tasks in its CURRENT stage. Disabled (HTML `disabled`) when
    `focusedTree(state)` is undefined — there is nothing to skip.
  - **"Plant fully grown tree"** (`data-testid="dev-plant-grown"`) — emits
    `onPlantFullyGrown()`; S13 wires it to the normal modal flow producing an
    18/18 complete tree. Always enabled.
- The panel itself never mutates state. `data-testid="dev-panel"`. Minimal
  inline placeholder styling; repeated updates don't duplicate DOM.

## Done when

DOM tests written FIRST (happy-dom pragma):

- reflect button renders, is visible, and clicking it does nothing (no
  throw, no callback surface at all);
- dev panel renders both buttons with their labels;
- clicking skip calls onSkipStage once; clicking plant calls
  onPlantFullyGrown once;
- skip is disabled when no tree is focused (fresh state) and enabled when an
  active tree is focused; it becomes disabled again once the focused tree
  completes;
- repeated updates do not duplicate DOM.

`pnpm verify` green (ui is polish-lane).

## Out of scope

The actual skip/plant logic (S13 wiring), styling, hiding the dev panel
behind a flag (it is always visible in v1). Everything not listed. No changes
outside `src/modules/ui/` (plus `.task/`).
