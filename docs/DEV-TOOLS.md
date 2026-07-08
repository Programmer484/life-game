# Dev tools

<!-- Source of truth: `DEV_TOOLS` in `src/modules/ui/internal/dev-help-modal.ts`
     (it drives both the dev panel and the in-game help modal). Keep this file
     in sync by hand when that constant changes. -->

Developer tools for exercising the game quickly. They render only in **dev
mode** and never ship to players outside it.

## Enabling dev mode

Dev mode is on when any of these holds:

- The build is a dev build (`import.meta.env.DEV`, i.e. `pnpm dev`).
- The URL contains `?dev=1` — this also persists `lg-dev=1` to localStorage,
  so dev mode survives reloads and navigation.
- `lg-dev=1` is already in localStorage from an earlier `?dev=1` visit.

Visit with `?dev=0` to clear the persisted flag (a dev build stays on).

## The dev panel

Docked bottom-right, above the Reflect button. Press `` ` `` (backtick) to
collapse it to just its header chip, or click the header.

| Shortcut | Tool                | What it does                                                                  |
| -------- | ------------------- | ----------------------------------------------------------------------------- |
| `1`      | Skip stage          | Completes the focused tree's remaining tasks in its current growth stage.     |
| `2`      | Complete next task  | Completes the focused tree's next task, as if checked off in the tasks panel. |
| `3`      | Plant fully grown   | Toggle: while on, every subsequent plant is created with all tasks completed. |
| `4`      | Unlock next section | Unlocks the cheapest locked island section immediately, ignoring its cost.    |
| `?`      | Help                | Opens the in-game help modal (this content).                                  |

Shortcuts are active only in dev mode, and are suppressed while a modal is
open or while typing in an input, textarea, or contenteditable element.
