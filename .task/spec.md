# S9 · Planting modal + Autofill (UI)

**Module:** `ui` (src/modules/ui) — this slice touches ONLY this module.
Same rails as S7/S8: plain DOM, no Pixi, happy-dom pragma tests, state read
via public surfaces, intent out via callbacks.

## Behavior

The modal that opens when the player plants on a tile. It is a placeholder
for a future goal-setting chatbot: a DISABLED chat area + an **Autofill**
button offering the two goal templates.

### Public surface (additions to `index.ts`)

- `createPlantingModal(deps: { onPlant: (choice: PlantChoice) => void }): PlantingModal`
- `PlantChoice = { tile: TileCoord; templateKey: 'sleep' | 'workout'; type: TreeType }`
- `PlantingModal = { el: HTMLElement; open(state: GameplayState, tile: TileCoord): void; close(): void; isOpen(): boolean }`

### Rules

- Hidden until `open(state, tile)`; `close()` hides it again.
- Contents when open:
  - a visibly disabled chat area (`textarea` or similar with `disabled`,
    placeholder text hinting at the future chatbot);
  - a tree-type selector: type A always offered; type B offered ONLY when
    `availableTreeTypes(state)` includes `'B'` (defaults to A);
  - an **Autofill** button; activating it reveals the two template options —
    **Sleep plan** / **Workout plan** (names from `GOAL_TEMPLATES` in config,
    not hard-coded);
  - choosing a template calls `onPlant({ tile, templateKey, type })` with the
    tile passed to `open` and the selected type, then closes the modal —
    the modal does NOT create goals or mutate state (S13 wires `onPlant` to
    the systems planting flow);
  - a Cancel control that closes without calling `onPlant`.
- Re-opening resets the modal (no leftover template list / stale selection);
  repeated opens don't duplicate DOM or leak listeners.
- Stable hooks: `data-testid="planting-modal"`, `"chat-placeholder"`,
  `"autofill"`, `"template-sleep"`, `"template-workout"`, `"tree-type-a"`,
  `"tree-type-b"`, `"modal-cancel"`. Minimal inline placeholder styling.

## Done when

DOM tests written FIRST (happy-dom pragma):

- hidden initially; open() shows it with the disabled chat placeholder;
- Autofill reveals the Sleep plan and Workout plan options with names from
  config;
- choosing Sleep plan calls onPlant with the opened tile, 'sleep', and the
  selected type, and closes the modal;
- type B is not offered before the first section unlock and is offered after
  (state with a second section unlocked); default selection is A;
- Cancel closes without calling onPlant;
- re-opening resets the modal and repeated opens do not duplicate DOM.

`pnpm verify` green (ui is polish-lane).

## Out of scope

Tile-click detection, actually planting (systems), dev panel, story,
persistence. Everything not listed. No changes outside `src/modules/ui/`
(plus `.task/`).
