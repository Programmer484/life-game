# S2 · World render + panning

**Modules:** `render`, `core-app`, `core-viewport`, `assets` — plus the app
shell at the repo root (`index.html`, `src/main.ts`, `package.json` scripts,
`knip.json` entry if knip complains). PRD sanctions the 4-module scope for
this slice.

## Behavior

Draw the S1 world as placeholder-art tiles on a pannable 2.5D canvas.

### Dependencies (add as prod deps)

`pixi.js@^8` and `pixi-viewport@^6`. PixiJS 8 init is async:
`const app = new Application(); await app.init({ ... })` — NOT the v7
constructor pattern. `core-viewport` is the ONLY module importing
`pixi-viewport` (already enforced by allowedExternals; add the new packages
to the relevant modules' `allowedExternals` is NOT needed — they are already
listed).

### `assets`

Placeholder art manifest: exported color constants per tile state —
fog (near-black), dead (dark sludge brown), half-dead transition (desaturated
mix), vibrant (living green) — plus tree-stage colors for later slices
(stages 1–5, type A greens / type B teals). No image loading in v1; keep the
loader wrapper trivial.

### `render`

- Pure geometry helper (internal, unit-tested): grid `TileCoord` → screen
  position for a 2.5D look — isometric 2:1 diamonds (tile width 2×height).
- `drawWorld(world): Container` — one Graphics diamond per island tile,
  filled by tile state; tiles in `transitionTiles(world)` get the half-dead
  color. Returns a Pixi Container.
- `updateWorld(container, world)` or redraw-equivalent so later slices can
  re-render after state changes (full redraw is fine at this scale).

### `core-viewport`

`createViewport(app): Viewport` — pixi-viewport with `.drag()` enabled
(click-drag panning). Nothing else in v1 (no zoom requirement, wheel/pinch
optional). Expose what render/core-app need: add content, world size.

### `core-app`

`startApp(canvasHost: HTMLElement)` — async: Pixi 8 `app.init` with
resize-to-window, attach canvas, create viewport, `drawWorld(createWorld())`,
add to viewport, center the island in view.

### App shell (root)

- `index.html` + `src/main.ts` calling `startApp(document.body)` (or a
  #app div).
- `package.json`: add `"dev": "vite"`, `"build": "vite build"`,
  `"preview": "vite preview"`.

## Done when

- `pnpm dev` serves a jagged island: section 1 dead-brown, sections 2–7 under
  near-black fog, and click-drag pans the world. (Verify manually with
  `pnpm build` succeeding; a browser smoke test is NOT part of the gate.)
- Unit tests written FIRST for the pure parts: iso projection math
  (round-trips, 2:1 ratio, distinct coords → distinct positions) and
  state→color mapping incl. transition tiles. Do NOT fight WebGL/jsdom:
  Pixi-touching code stays thin and untested (render is polish-lane;
  core-app/core-viewport thin wrappers are acceptable uncovered — the 40
  floor is aggregate and config+world carry it).
- `pnpm verify` green and `pnpm build` succeeds.

## Out of scope

Trees/sprites for trees, UI overlay, clicks on tiles, zoom polish, story,
persistence. Everything not listed.
