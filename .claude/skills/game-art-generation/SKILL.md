---
name: game-art-generation
description: Generate and post-process AI image assets for the game — one-style asset sets (tiles, tree/growth sprites), image-to-image reference anchoring, per-image visual review, chroma-key + mask pipelines, and contact-sheet approval. Use when creating or regenerating anything under public/art/.
---

# Generating game art with an image model

The pipeline that produced the v1 asset set (PR #16). Two principles rule
everything: **style consistency is the whole game**, and **never trust the
model for geometry or alpha — enforce those in post**.

## 1. One master style prompt, verbatim

Write ONE master style clause and reuse it word-for-word for every image
in the set; vary only an appended subject clause. The v1 master:

> cozy painterly isometric video game asset, soft cel shading, top-left
> key light, no outline, rich saturated color, low-frequency painterly
> detail, solid flat pure magenta background (#FF00FF) filling everything
> outside the subject

- Same model, same session, whole set. If one image comes back off-style,
  **regenerate it — never hand-edit style differences in.** Escalate to
  the human only if style won't converge after ~2 regeneration rounds.
- "Low-frequency detail" is load-bearing: assets are generated at 4× the
  render size (tiles 256×128 → rendered 64×32) and high-frequency detail
  turns to noise on downscale.

## 2. The model cannot give you alpha — plan for it

Image models output flat JPEGs. Asking for a "transparent background"
yields a _painted checkerboard_, useless. Two working strategies:

- **Geometric masks (tiles)**: don't rely on the image at all. Prompt a
  diamond that fills the canvas, resize with ~8% overscan so the painted
  shape overfills, center-crop to 256×128, then apply an exact 2:1
  diamond alpha mask (`|dx|/(w/2) + |dy|/(h/2) ≤ 1`). Seamless butting is
  then guaranteed _by construction_ — stronger than anything you can
  prompt.
- **Chroma key (sprites with organic silhouettes)**: prompt a solid pure
  magenta (#FF00FF) background — no game-plausible color is near it.
  In post: key pixels where `r>160 && b>160 && g<130 && min(r,b)-g>60`;
  **despill** kept pixels (`r = min(r, g+40)`, same for b) to kill pink
  fringe; feather a narrow alpha band on mid-scores. PIL is enough; no
  ImageMagick needed.

Aspect ratios: the model's enum rarely has yours (no 2:1). Generate at
the nearest (16:9 for tiles, 2:3 for 256×384 trees) and let the resize
absorb the difference.

## 3. Reference images (image-to-image) — the consistency lever

Text prompts alone drift. Passing an existing image via `inputImagePath`
is a far stronger style anchor than any wording. Two patterns:

- **Style anchor for set-mates**: generate the "hero" image first (e.g.
  the vibrant grass tile), review it, then generate every sibling with
  the hero as input + "Keep the EXACT same painterly style, diamond
  shape, angle and proportions as the input image. Change only the
  content: …". This is how the half-dead → vibrancy-1/2 tiles stayed in
  one family — the first text-only attempt at a sibling visibly drifted
  (flat hard-cel vs painterly); the i2i regeneration matched.
- **Species anchor for stage/variant sequences**: for a growth arc,
  generate the FINAL stage (grand, stage 5) first as the species anchor,
  then derive every younger stage from it: "The input image is stage 5
  of this exact species. Draw the SAME species in the SAME art style at
  stage N of 5: …" with an explicit size cue ("about one third of the
  canvas height, lots of empty magenta space above"). Silhouette lineage
  comes free; anchoring on stage 1 and growing upward does not work as
  well — small sprouts carry too little species information.

## 4. Review every image as you generate — never batch blind

Read (view) each image the moment it lands, before generating dependents:

- **Order matters**: hero first → review → then siblings anchored on it.
  A bad anchor poisons everything downstream; regeneration is cheap,
  re-plumbing is not.
- Check per image: on-style vs the set so far? Correct content read
  (a "half dead" tile must read as such at a glance)? Background clean
  for keying? Composition sane (subject not clipped, anchor point where
  expected)?
- Batch parallel generation ONLY for images that don't depend on each
  other's review (the 4 stage-variants of one species after the anchor
  is approved).
- Review at **render size too**: a tile that looks great at 256px can
  turn to mush at 64px. The contact sheet (§6) covers this.

## 5. Post-process deterministically — same script, whole set

One script, applied identically to every image (`postprocess.py` pattern):
trim to content bbox → scale → pad to exact canvas → alpha. Two hard-won
rules:

- **Don't trust the model for relative scale.** A stage-1 sprout
  generated "small in frame" then naively trim-and-fit-to-canvas becomes
  as tall as the stage-5 tree. Enforce a **deterministic ladder** in
  post: content height = fixed fraction of canvas per stage
  (v1: 18/38/58/78/97%). The renderer then uses ONE uniform sprite scale
  and the baked ladder carries the growth arc — never normalize
  per-stage at render time.
- **Compute the anchor from pixels, not hope.** Trees anchor at
  (0.5, 1.0): find the mean x of opaque pixels in the bottom ~5% of
  content rows (the trunk), and offset the paste so that column lands at
  canvas center-bottom. Prompted "centered" trunks are reliably off.

## 6. Contact sheet — make the review answerable

Before any code consumes the art, build one image that answers every
question a reviewer would ask:

- full-size row of each tile family, labeled;
- **seam test**: each tile as a 3×3 iso-butted grid at true render size
  (neighbors at ±half-width, ±half-height offsets);
- each growth sequence side by side on a shared baseline;
- a **mock scene** at render scale — a small hand-laid island with the
  gradient laid out and a few trees pasted in z-order — the closest
  cheap preview of the real game.

Present it, get the gate decision, and expect the review to change the
_design_, not just approve it (v1's review replaced the divide tile with
a vibrancy gradient). Regenerate → rebuild sheet → re-review; the sheet
script makes iteration nearly free.

## 7. Feed the palette forward

Sample dominant colors from the approved art (PIL `quantize` on each key
asset, ignore the transparent-black bucket) and hand the hexes to the UI
token slice — canvas and DOM overlay must read as one product. v1:
accent green #64a047/#9eca4e (vibrant tile), teal #309395/#185e6b
(type-B conifer), panel #191c23/#333944 (fog tile).

## 8. Repo mechanics

- Final PNGs go to `public/art/` (served verbatim by Vite — no TS image
  imports, no knip entries). Raw generations land in `output/` —
  **never commit raws**; commit only the processed PNGs
  (`git add public/art`), as an art-only PR.
- Scripts live in the job tmp dir, not the repo. `pnpm scope --add
'public/art/**' 'output/**'` (globs — bare dir args crash the scope
  script) before writing.
- Removing an asset (design change) = delete the PNG AND drop its
  manifest key in `assets` in the consuming slice; never ship a dead
  file.
