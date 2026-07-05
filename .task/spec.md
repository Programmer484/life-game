# S3 · Goals & tasks

**Module:** `entities` (src/modules/entities) — this slice touches ONLY this
module. Types (`Goal`, `Tree`, `TaskState`, `GoalTemplate`,
`TaskCompletedEvent`) and `GOAL_TEMPLATES` come from `config`. Headless, pure.

## Behavior

`entities` owns goal/task/tree data manipulation and template instantiation.
Immutable updates: functions return new objects, never mutate inputs. No ID
generation dependency — IDs are caller-supplied strings.

### Public surface (`index.ts`)

- `createGoal(id: string, template: GoalTemplate): Goal` — name from the
  template, 18 `TaskState`s in template order, all `done: false`.
- `createTree(id: string, tile: TileCoord, type: TreeType, goalId: string): Tree`
  — `tasksDone: 0`.
- `nextTaskIndex(goal): number | undefined` — index of the first not-done
  task; `undefined` when all 18 are done. (Tasks complete strictly in order —
  the UI only ever offers the next task.)
- `completeNextTask(goal): Goal` — marks the next task done; when all tasks
  are already done, returns the goal unchanged.
- `tasksDone(goal): number` — count of done tasks.
- `taskCompletedEvent(treeId: string, taskIndex: number): TaskCompletedEvent`
  — factory for the event systems consume in S4.

## Done when

Tests written FIRST from this spec (names read like the spec):

- createGoal: instantiates the sleep template — 18 tasks, template order,
  titles/minutes match config, none done, name "Sleep plan" (per template).
- createGoal: instantiates the workout template the same way.
- createTree: starts at tasksDone 0 with the given tile/type/goalId.
- nextTaskIndex: 0 on a fresh goal; advances by one after each completion;
  undefined when all done.
- completeNextTask: marks exactly the next task done, does not mutate the
  input goal; on a fully-done goal returns it unchanged.
- tasksDone: 0 fresh, n after n completions, 18 when finished.
- taskCompletedEvent: carries type 'task-completed', treeId, taskIndex.
- `pnpm verify` green.

## Out of scope

Growth stages/XP/unlocks (S4/S6), planting validation (S5), focus handling,
rendering, persistence, demo start state. Everything not listed. No changes
outside `src/modules/entities/` (plus `.task/`).
