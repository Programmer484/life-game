# Slice B1 — Design tokens + shared classes (module `ui` only)

UI polish pass, slice B1. Polish-lane module: no coverage floor, but lint,
boundaries, typecheck, knip, and format all gate.

## Scope

- New internal file `src/modules/ui/internal/styles.ts` + its tests.
- Do NOT touch any other module or any existing component in this slice
  (wiring `ensureStyles()` into component factories is slice B2).
- Keep every existing `data-testid` untouched.
- `ui` stays pure DOM — no Pixi, no CSS files, no new packages.

## `ensureStyles()`

Injects a single `<style id="lg-styles">` tag into `document.head` exactly
once — idempotent: calling it N times leaves exactly one tag.

Export policy: prefer keeping it internal (tests import from the module's OWN
internal path, which is allowed); only export from `index.ts` if needed by
tests/B2 and knip does not complain.

## CSS custom properties on `:root`

- `--lg-bg-panel` — dark surface, #1e222c family derived from the fog tile
  (#191c23 / #333944)
- `--lg-fg` — near-white warm grey
- `--lg-accent` — living green #64a047, hover-bright #9eca4e
- `--lg-accent-2` — teal #309395, deep #185e6b
- `--lg-danger` — muted warm red fitting a painterly palette (e.g. #c0503e)
- `--lg-radius`, `--lg-space-1`, `--lg-space-2`, `--lg-space-3`
- `--lg-font` — system UI stack
- `--lg-shadow`

## Classes (all namespaced `lg-`)

- `.lg-btn` base + `.lg-btn--primary` (accent bg), `.lg-btn--ghost`
  (transparent bg, subtle border), `.lg-btn--danger`; each with hover/active
  states and a clearly inert disabled state (reduced opacity + not-allowed
  cursor + no hover change).
- `.lg-panel` — bg-panel surface, radius, shadow, padding.
- `.lg-modal-backdrop` — fixed full-screen dimmer; `.lg-modal` — centered
  panel.
- `.lg-input` — dark field, accent focus ring.
- `.lg-bar` (track) + `.lg-bar__fill` (accent fill, `transition: width`) +
  a `[data-full]` rule giving the fill a soft glow/pulse.

## Tests (first, happy-dom, module's existing test pattern)

- Idempotent injection: multiple `ensureStyles()` calls → exactly one
  `#lg-styles` tag.
- Sheet text contains every token name and every class name listed above.
- No pixel/visual assertions.

## Done

- `pnpm verify` AND `pnpm build` green (stop and report after 3 identical
  failures — no hacking around).
- Ship: `pnpm pr "feat(ui): tokens + shared classes"` (draft PR, base main;
  branch `slice/p-b1-ui-tokens` if needed).
