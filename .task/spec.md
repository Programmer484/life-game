# S4 · Growth system

**Module:** `systems` (src/modules/systems) — this slice touches ONLY this
module. Uses `config` (STAGE_TASKS, TASKS_PER_TREE, types) and `entities`
(goal helpers) via their `index.ts`. Headless, pure, immutable.

## Behavior

Consume task-completed events: advance the tree's goal, sync the tree's
`tasksDone`, derive growth stage, detect completion (complete trees stay
forever and free their active slot).

### Public surface (`index.ts`)

- `GrowthState` = `{ trees: readonly Tree[]; goals: Readonly<Record<string, Goal>> }`
- `applyTaskCompleted(state: GrowthState, event: TaskCompletedEvent): GrowthState`
  — looks up the tree by `event.treeId` and its goal by `tree.goalId`;
  completes the goal's next task (via entities) and sets the tree's
  `tasksDone` to the goal's done count. Guards (return state unchanged):
  unknown treeId; `event.taskIndex !== nextTaskIndex(goal)` (stale/duplicate
  event); goal already fully done.
- `stageOf(tree): GrowthStage` — derived from `tasksDone` and STAGE_TASKS
  cumulatively: stages advance after 3 / 3+4 / 3+4+5 / 3+4+5+6 = 18 tasks
  (0–2 done → stage 1, 3–6 → 2, 7–11 → 3, 12–17 → 4, 18 → 5).
- `isComplete(tree): boolean` — `tasksDone >= TASKS_PER_TREE`. Fully grown
  (stage 5) ⇔ complete.
- `activeTrees(trees): Tree[]` — the non-complete trees (a complete tree
  frees its slot; the cap in S5 counts only these).

## Done when

Tests written FIRST from this spec.

Example tests:

- 3 completed tasks advance a fresh sapling to stage 2 (acceptance check §7).
- 18 completed tasks make the tree complete (stage 5) and it leaves
  activeTrees (slot freed).
- applyTaskCompleted syncs tree.tasksDone with the goal and does not mutate
  the input state.
- Stale event (taskIndex ≠ next), unknown treeId, and event on a finished
  goal each return the state unchanged.

Property tests (fast-check) — the demo-protecting invariants, generic over
random completion sequences (these three are the ONLY properties for this
slice):

- Growth stage is monotonically non-decreasing over any event sequence.
- A single task completion never advances the stage by more than one (no
  stage is ever skipped).
- Stage 5 is reached exactly at 18 tasks done — never before, always at 18.

`pnpm verify` green.

## Out of scope

Planting/cap validation (S5), XP/unlocks (S6), UI, rendering, persistence.
Everything not listed. No changes outside `src/modules/systems/` (plus
`.task/`).
