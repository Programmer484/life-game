# V3 implementation overview

What changed, where it lives, and which decisions you'd want to know about
before suggesting changes. Supersedes the v2 overview: this was a **pure
art/visual pass** — no module, logic, save-schema, or gameplay changes. All
of `V2_IMPLEMENTATION.md` §1–§3 and §7–§9 still hold verbatim; only the
pixels (and one camera line) moved. Read v2 for architecture; read this for
what the art pass touched and why.

## 1. Scope of this pass

Six merged PRs (#28–#33), all art except a single camera line:

- **#28–#30 — land tiles** regenerated duller, then darkened twice.
- **#31 — full 10-sprite tree set** regenerated.
- **#32 — tree A** re-regenerated via a spritesheet workflow, plus the **2×
  default map zoom**.
- **#33 — tree A stage-1/2** stem/trunk thickened.

No `module-map.json`, `config`, `systems`, or `save` changes; no new tests.
The renderer contract is untouched (§4). If you're changing behavior,
nothing here applies — go to v2.

## 2. Land tiles — a muted, mid-value band (#28–#30)

The five tile PNGs (256×128, same names/count) were regenerated from the
originals via image-to-image: same painterly style, **desaturated and
value-compressed** so no tile competes with sprites at the value extremes.

- Final mean luminance per level: **vibrant 106 / vibrancy-2 94 /
  vibrancy-1 83 / dead 72** (down from the originals' 144/127/92/64). The
  ordering (vibrant > v2 > v1 > dead) and the fog tile are unchanged.
- ⚠️ **The dead tile at 72 is deliberately pale-ash, not near-black.** The
  old dead tile (~64) swallowed dark trunks. Do not re-darken it below ~65
  or trunks stop reading against it. Brightness was tuned iteratively in
  ~15% **multiplicative** steps (hue preserved) — that gain-only pass is the
  lever if you need to adjust again.

## 3. Trees — regenerated set with a subtle outline (#31–#33)

All 10 tree sprites (256×384, same names/count) were regenerated. Growth
arc per species:

- **A (oak / broadleaf)**: acorn **seed in soil** (stage 1, replacing the
  old ~17px invisible sapling) → sturdy sapling → young → young-adult →
  wide multi-lobed mature.
- **B (teal conifer)**: seed → thick-stemmed seedling → sparse spindly →
  fuller cone → dense spire. (The old B set was a near-identical cone at
  stages 2–5; distinct silhouettes were the whole point.)

Every sprite carries a **subtle dark outline** for readability on grass.

⚠️ **Provenance asymmetry**: tree **A** came from the spritesheet workflow
(§5) with its outline added as an edit; tree **B** is from the earlier
per-stage magenta generations (#31) and has **not** been through the
spritesheet pass. They read consistently today, but if you regenerate
either, run both through the spritesheet workflow so the outline weight and
style stay matched. Tree-B-via-spritesheet is the most likely next art
ticket.

## 4. Renderer contract — unchanged, one camera line added

- Tree canvases are still **256×384**, drawn at the single uniform
  **`TREE_SCALE = 0.25`**, bottom-anchored **(0.5, 1.0)**. The growth ladder
  is still baked as content height per stage — now normalized by the
  processing pipeline to **88 / 152 / 220 / 288 / 340 px** of 384
  (≈23/40/57/75/89%), a clean monotonic ramp that also fixed the old
  stage-4-taller-than-stage-5 inversion. Never height-normalize per stage at
  render time; the ladder lives in the art.
- **2× default zoom (#32)** is the ONLY code change in the whole pass:
  `viewport.setZoom(2)` in `core-app/internal/app.ts`, set before
  `moveCenter`. Drag-pan still works; there is still no zoom UI. Change the
  default by editing that one line.
- `texture-key.ts`, iso projection, depth sort, and the `assets` manifest
  shape are all unchanged. A tile/tree PNG is still **load-bearing at boot**
  (`loadArt` throws on any missing file).

## 5. Art pipeline — how the sprites are made (the reusable part)

Regeneration runs outside the app in a scratch venv (numpy/pillow) with
throwaway PIL scripts, reviewed as PNG contact sheets **on a grass backdrop**
(not by booting the app) before install:

1. **Generate on a flat keyable background** — magenta `#FF00FF`, or any
   uniform far-from-subject color (a pasted external sheet came back on
   hot-pink `#F31F90` and keyed fine).
2. **Chroma-key to alpha**: distance-from-bg feather (~70–150) + edge
   despill `min(R,B)-G`. The model-painted outline gives a crisp silhouette,
   so keying is clean (zero color residue).
3. **Height-normalize** the content to the ladder and **bottom-anchor** in a
   256×384 canvas.

**Trees — the winning method (spritesheet):** generate ALL five stages in
ONE image. Drawing them together forces one consistent style/outline weight
_and_ a natural size ramp. Add the outline as an **edit-in-place**
("reproduce this exactly, change ONLY: add a thin outline"), then slice by
column runs. For a targeted tweak (e.g. #33's thicker stems) rebuild a mini
edit-source from the installed sprites, change only that part, and recombine
with the untouched stages — zero regression on the rest.

## 6. What did NOT work (folded in from the deleted ART-READABILITY.md)

An earlier readability attempt (per-stage render-scale boosts, ground
shadows, baked outlines + rim light, spliced regeneration) was **fully
reverted** — see git history around PR #27. The lessons that shaped the
final approach:

- **Baked / composited outlines fight soft-alpha art** (fringe/halo, a flat
  "2D sticker" look). Fix: have the **model paint the outline**; don't
  composite one onto feathered edges.
- **Two scaling systems fight.** Don't add a render-time per-stage scale on
  top of the baked ladder — fix the ladder heights in the art instead.
- **i2i from a full-tree base collapses small stages** back into full trees
  (saplings balloon). Generating the whole ladder as one **spritesheet**
  solved consistency and progression at once.
- **Splicing new sprites beside old ones drifts.** Regenerate a whole set in
  one style, in one session.

## 7. Repo / process notes

- `ART-READABILITY.md` was **deleted**; its content is summarized in §6.
- Non-art merges in the same window (not part of the visual work):
  scope-guard hardening (out-of-repo Edit/Write targets bypass scope),
  untracking per-task `.task/` state, and gitignoring the mcp-image
  `output/` scratch directory.
- Still not built (unchanged): zoom UI/controls, animations/tweens, and tree
  B via the spritesheet workflow.
