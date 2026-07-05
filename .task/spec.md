# S11 · Intro story (UI)

**Module:** `ui` (src/modules/ui) — this slice touches ONLY this module.
Same rails as S7–S10: plain DOM, no Pixi, happy-dom pragma tests.

## Behavior

The first-run story screen: a full-screen text sequence of the 6 story
blocks, one **Next** button, no visuals, no skip. Whether it shows at all is
decided elsewhere (the persisted story-seen flag arrives with S12/S13 —
this component just plays the sequence when mounted).

### Public surface (additions to `index.ts`)

- `createStoryScreen(deps: { onFinished: () => void }): StoryScreen`
- `StoryScreen = { el: HTMLElement }`

### Rules

- Full-screen overlay (`position: fixed; inset: 0`, opaque background,
  readable centered text). `data-testid="story-screen"`, block text in
  `data-testid="story-block"`, button `data-testid="story-next"`.
- Text comes from `STORY_BLOCKS` (config) — never hard-coded; shown one
  block at a time starting at block 1, rendered verbatim.
- The ONLY control is the Next button. Clicking it advances to the next
  block; after the 6th block's Next, `onFinished()` fires exactly once and
  the screen hides itself (display none or removed content).
- No skip control, no block counter requirement, no keyboard shortcuts.
- Clicks after finish do nothing (no double onFinished).

## Done when

DOM tests written FIRST (happy-dom pragma):

- shows the first STORY_BLOCKS entry verbatim from config on mount;
- Next advances through all 6 blocks in order (verbatim text each step);
- there is no control other than Next (no skip);
- after Next on the 6th block, onFinished fires exactly once and the screen
  is hidden;
- further interaction after finish does not re-fire onFinished.

`pnpm verify` green (ui is polish-lane).

## Out of scope

The story-seen persistence flag and first-run gating (S12/S13), auth, save,
styling polish. Everything not listed. No changes outside `src/modules/ui/`
(plus `.task/`).
