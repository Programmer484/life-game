# UI Polish Pass — Orchestration Brief (Fable)

You are a Fable model orchestrating smaller worker agents through a visual
polish pass on Life Game v1. You orchestrate; workers implement — you never
write feature code directly. Read `IMPLEMENTATION.md` (architecture map) and
`CLAUDE.md` (framework rails) before decomposing. Everything here rides the
existing pipeline: one slice = one `.task/spec.md` = one worker = one
`pnpm verify`-green PR.

**Scope of this pass:** (1) replace every placeholder color with real,
AI-generated image assets; (2) unify the DOM overlay behind shared button /
panel classes. NO game-logic changes — `config`, `world`, `entities`,
`systems`, `save` are out of bounds for every slice in this brief.

---

## 0. Rails that constrain every slice

- `render` and `ui` are **polish-lane** (no coverage floor) but lint,
  boundaries, typecheck, knip, and format all still gate. `assets` is a full
  module but its code stays trivial (manifest + loader wrapper).
- Boundaries: only `assets`, `render`, `core-app`, `core-viewport` may import
  `pixi.js`. `ui` stays pure DOM — no Pixi, no CSS framework packages.
- Workers must `pnpm scope <module>` before editing, and finish with
  `pnpm verify` AND `pnpm build` green. 3 failed verify attempts → stop the
  worker and escalate with the output.
- Existing tests assert behavior through `data-testid` hooks — **workers must
  keep every testid intact**. Style-only changes should not require touching
  behavior tests; the S2-era `tile-color`/palette tests MAY be rewritten when
  colors become textures (they are polish-lane suites — replace, don't
  delete coverage of the pure helpers that survive).
- Serialize slices that touch the same module. Suggested order below is
  dependency order.

---

## 1. Track A — Real image assets (the #1 upgrade)

### A0 · Asset inventory & generation (no code)

Generate the full set with an image-generation model BEFORE any code slice,
so style drift is caught by eye first. Deliverable: PNGs in `public/art/`
(served verbatim by Vite — this deliberately avoids TS image-import
declarations and knip entries) plus a one-page contact sheet the human can
approve.

**The set (14 images):**

| File                         | Content                                              |
| ---------------------------- | ---------------------------------------------------- |
| `tile-vibrant.png`           | living grass tile, lush greens                       |
| `tile-dead.png`              | dead sludge tile, dark browns/greys                  |
| `tile-halfdead.png`          | the transition tile — visibly half sludge, half life |
| `tile-fog.png`               | fogged tile — near-black, soft noise (see note)      |
| `tree-a-stage-1..5.png` (×5) | type A: sprout → sapling → young → mature → grand    |
| `tree-b-stage-1..5.png` (×5) | type B: same growth arc, distinct species/palette    |

**Hard requirements for every image:**

- **Tiles:** isometric 2:1 diamond footprint, transparent background outside
  the diamond, generated at **256×128** (rendered at 64×32 — keep detail
  low-frequency so it survives the downscale). The diamond must FILL the
  canvas edge-to-edge so tiles butt seamlessly; no drop shadows outside the
  diamond.
- **Trees:** transparent background, portrait canvas **256×384**, the trunk
  base centered at bottom-middle (the sprite anchor will be `(0.5, 1.0)`
  placed at tile center). Stages must read as ONE species growing: keep
  silhouette lineage between stages. Type B must be distinguishable at a
  glance (different species/hue, e.g. A = broadleaf greens, B = teal/cyan
  conifer — matching the existing placeholder palette direction in
  `assets`).
- **Style consistency is the whole game.** Write ONE master style prompt and
  reuse it verbatim for all 14 (e.g. "cozy painterly isometric game asset,
  soft cel shading, top-left key light, no outline, transparent
  background…"). Generate variations per image by appending only the subject
  clause. Same session/model for the whole set. If any image comes back
  off-style, regenerate it — do not hand-edit style differences in.
- Post-process every image identically: trim, pad to the exact canvas size,
  verify transparency (ImageMagick:
  `convert in.png -trim -resize 256x128 -background none -gravity center -extent 256x128 out.png`
  for tiles; the 384-tall equivalent for trees).
- **Fog note:** the fog tile may stay procedural (a dark diamond +
  translucent overlay) if generated fog looks noisy when tiled — worker's
  call; if procedural, drop `tile-fog.png` from the manifest rather than
  shipping a dead file.

**Checkpoint (human):** approve the contact sheet before A1 starts.
Regeneration is cheap; re-plumbing code twice is not.

### A1 · Asset manifest + loader (`assets`)

Replace the color-constant palette with a texture manifest, keeping the
module's public shape small:

- `ART_MANIFEST`: typed map from semantic keys (`tile.vibrant`, `tile.dead`,
  `tile.halfDead`, `tile.fog`, `tree.A.1`…`tree.B.5`) to `public/art/` URLs.
- `loadArt(): Promise<ArtTextures>` — one `Assets.load` call over the
  manifest (Pixi 8 `Assets` API); returns keyed `Texture`s.
- KEEP the existing color constants exported for now if `render`'s pure
  helpers still use them (delete in A2 if nothing does — knip will tell).
- Tests (example-based): manifest covers exactly the expected keys ×
  states/stages, URLs are distinct, stage keys 1–5 for both types. Do not
  test Pixi loading itself.

### A2 · Render swap: Graphics → Sprites (`render`)

- Tiles: replace per-tile `Graphics` diamonds with `Sprite`s from
  `ArtTextures`, width 64 / height 32, positioned by the existing
  `tileToScreen`. Tile state → texture key mapping is the pure, tested part
  (it replaces `colorForTile` — same shape, returns a key not a color).
- Trees: `Sprite` per `TreeViewModel`, texture `tree.{type}.{stage}`, anchor
  `(0.5, 1)`, positioned at tile center. Enable `sortableChildren` and set
  `zIndex = screenY` on trees (and any tile that should occlude) so trees
  lower on the island draw in front — the 2.5D read.
- `drawWorld`/`updateWorld`/`updateTrees` keep their signatures but now take
  (or close over) the loaded `ArtTextures`; `core-app/internal/app.ts` gains
  one `await loadArt()` during boot (this is the ONLY core-app line this
  track may touch).
- Full-redraw strategy stays — do not introduce diffing in this pass.
- Verify + build green; manual check via `pnpm dev`: seams invisible,
  transition tiles read as a shoreline, stage-5 trees clearly grander than
  stage-1, type A vs B distinguishable.

---

## 2. Track B — DOM overlay polish (shared classes)

### B1 · Design tokens + shared classes (`ui`)

One new internal file, `ui/internal/styles.ts`:

- `ensureStyles()`: injects a single `<style id="lg-styles">` tag once
  (idempotent — every component factory calls it; testable in happy-dom by
  asserting the tag exists exactly once after multiple creates). No CSS
  files, no CSS packages — `ui` stays pure and framework-free.
- **Tokens** as CSS custom properties on `:root`: `--lg-bg-panel`,
  `--lg-fg`, `--lg-accent` (living green, match the vibrant tile art),
  `--lg-accent-2` (type-B teal), `--lg-danger`, `--lg-radius`,
  `--lg-space-1..3`, `--lg-font`, `--lg-shadow`. Derive the palette FROM the
  approved art (sample the generated tiles) so canvas and overlay feel like
  one product.
- **Common classes** (the point of this slice — every component reuses
  these, no per-component one-off styling):
  - `.lg-btn` base + modifiers `.lg-btn--primary`, `.lg-btn--ghost`,
    `.lg-btn--danger`; hover/active/disabled states (disabled must be
    visibly inert — the dev panel relies on it).
  - `.lg-panel` (surface, radius, shadow, padding) — tasks panel, dev
    panel, modal body.
  - `.lg-modal-backdrop`, `.lg-modal` — planting modal, auth screen, story
    screen share these.
  - `.lg-input` — auth inputs, future chat box.
  - `.lg-bar`, `.lg-bar__fill` — XP bar (fill animates width via CSS
    transition; the `data-full` hook gets a glow/pulse rule).
- Tests: idempotent injection; tokens/classes present in the sheet text.

### B2 · Apply classes across components (`ui`)

Sweep every component to the shared classes, deleting inline styling except
truly per-instance positioning: tasks panel, XP bar, planting modal, reflect
button, dev panel, story screen, auth screen. Rules:

- Zero behavior changes; all `data-testid`s and callback wiring untouched;
  existing DOM tests must pass unmodified (they assert behavior, not style).
- Layout: overlay components get consistent placement (tasks panel top-left,
  XP bar top-center, reflect + dev panel bottom-right corner cluster) via a
  `.lg-hud` fixed-position container. Positioning lives at the shell mount
  point — if that requires touching `core-app/internal/app.ts`, keep it to
  container/mount lines only.
- Story and auth screens: use the modal classes full-screen; story text gets
  generous line-height and a max-width column — it is the first thing a
  player reads.
- Buttons audit: Next (story), Autofill, template choices, tree-type
  choices, Cancel, Sign in / Sign up, dev buttons, Reflect → every one gets
  `.lg-btn` + the right modifier (primary for the main action per surface,
  ghost for cancels/dev).

### B3 (optional, only if the human asks) · Canvas feel

Hover highlight on plantable tiles, click feedback, gentle tree "pop" on
stage change — `render`-only, tween-free (Pixi ticker lerp), no new deps.

---

## 3. Suggested slice/PR plan

| Slice | Modules                        | Depends on | PR title                          |
| ----- | ------------------------------ | ---------- | --------------------------------- |
| A0    | `public/art/` only (no code)   | —          | art: generated asset set v1       |
| A1    | `assets`                       | A0 approve | feat(assets): art manifest+loader |
| A2    | `render` (+2 lines `core-app`) | A1         | feat(render): sprite art          |
| B1    | `ui`                           | —          | feat(ui): tokens + shared classes |
| B2    | `ui` (+mount lines `core-app`) | B1         | feat(ui): apply shared classes    |

A-track and B-track are disjoint until the final `core-app` touches — they
may run in parallel only if workers get isolated checkouts (worktrees);
otherwise serialize A then B. Base branches on wherever the v1 stack
currently sits (tip of the merged stack, or `slice/s13-integration` if
unmerged — check `gh pr list` first and keep the stacking convention from
`IMPLEMENTATION.md` §10).

## 4. Worker prompt checklist (copy into every worker brief)

1. Repo path, slice name, "spec is in `.task/spec.md`, do not invent beyond
   it".
2. Branch-from + PR-base instructions (stacking).
3. `pnpm scope <modules>` before editing; scope additions
   (`pnpm scope --add`) for `public/art/` and any shell mount lines.
4. Tests first where a pure surface exists (manifest shape, texture-key
   mapping, style injection); no jsdom-WebGL fights — Pixi-touching code
   stays thin and untested.
5. `pnpm verify` + `pnpm build`, 3-strike escalation rule.
6. Keep every `data-testid`; keep module boundaries; commit message
   convention + draft PR ending with the standard footers.

## 5. Escalate to the human when

- The generated set can't hold one style after ~2 regeneration rounds
  (style direction is a human call).
- Any slice seems to need a game-logic change (it doesn't — re-read the
  brief; if it still does, stop).
- A new dependency looks tempting (CSS framework, tween lib, spritesheet
  packer). Default answer is no for this pass.
- Contact-sheet approval (A0) and a final `pnpm dev` visual review after A2
  and B2 — request a human look at both gates.
