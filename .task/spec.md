# S7 · Tasks panel + focus switching (UI)

**Module:** `ui` (src/modules/ui) — this slice touches ONLY this module (plus
adding the `happy-dom` devDependency for DOM tests if not present). `ui` is a
DOM-overlay module: plain DOM APIs, NO Pixi, no framework. It reads state via
`systems`/`entities`/`config` public surfaces and pushes user intent out
through callbacks — it never mutates game state itself.

## Behavior

The immediate-tasks panel: always shows the FOCUSED tree's NEXT task only.

### Public surface (`index.ts`)

- `createTasksPanel(deps: { onCompleteTask: (treeId: string, taskIndex: number) => void }): TasksPanel`
- `TasksPanel = { el: HTMLElement; update(state: GameplayState): void }`

### Rules

- `update(state)` renders from `focusedTree(state)` + its goal:
  - a focused active tree ⇒ show the goal name, the next task's title and
    estimated minutes, and an UNCHECKED checkbox;
  - checking the checkbox calls `onCompleteTask(treeId, nextTaskIndex)` —
    the panel does NOT change state; it waits for the next `update(state)`;
  - no focused tree (none planted, unknown, or the focused tree completed) ⇒
    the panel renders an empty/idle body. Complete trees never appear.
- Repeated `update` calls must not stack duplicate DOM or leak listeners
  (re-render the panel body each call).
- Give stable class names / data-testids so tests and later styling can hook
  in (e.g. `data-testid="tasks-panel"`, `"next-task-title"`,
  `"next-task-checkbox"`). Minimal inline styling only — placeholder look.

## Done when

DOM tests written FIRST (vitest + happy-dom via a
`// @vitest-environment happy-dom` pragma in the test file; add `happy-dom`
as a devDependency — it is NOT imported by module code, so allowedExternals
stays untouched):

- shows the focused tree's next task title, minutes, and goal name;
- checking the checkbox calls onCompleteTask with the treeId and the next
  task index, and does not itself alter the rendered task;
- after update with the advanced state, the panel shows the following task;
- shows the idle body when nothing is focused;
- shows the idle body when the focused tree has completed (complete trees
  never appear);
- repeated updates do not duplicate DOM nodes.

`pnpm verify` green (ui is polish-lane — no coverage floor, all other gates
apply).

## Out of scope

XP bar (S8), planting modal (S9), dev panel/reflect (S10), canvas
click-to-focus wiring and mounting into the page (S13), styling polish.
Everything not listed. No changes outside `src/modules/ui/` + package.json
devDep (plus `.task/`).
