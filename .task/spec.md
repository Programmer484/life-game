# S5 · Planting system

**Module:** `systems` (src/modules/systems) — this slice touches ONLY this
module (it already imports `world`, `entities`, `config`). Headless, pure,
immutable.

## Behavior

Planting validation and execution, plus tree focus. Extends S4's state:

- `GameplayState` = `GrowthState & { world: World; focusedTreeId?: string }`
  (keep `GrowthState` as-is; S4 functions keep working on the subset).

### Public surface (additions to `index.ts`)

- `canPlant(state, tile): { ok: true } | { ok: false; reason: PlantRejection }`
  with `PlantRejection = 'off-island' | 'fogged' | 'occupied' | 'cap'`:
  - tile must be on the island and its state `dead` or `vibrant`
    (fog = locked section → `'fogged'`; not on island → `'off-island'`);
  - no tree (active OR complete) already on that tile → `'occupied'`;
  - `activeTrees(state.trees).length < ACTIVE_TREE_CAP` → else `'cap'`
    (complete trees free their slot and do not count).
- `plantTree(state, { id, tile, type, goal }): { state: GameplayState; rejected?: PlantRejection }`
  — validates with `canPlant`; on rejection returns the input state unchanged
  plus the reason. On success: adds the goal, creates the tree (entities
  factories), applies `revealAround(world, tile)` (the 3×3 dead→vibrant
  conversion), and sets `focusedTreeId` to the new tree (most recently
  planted = default focus).
- `focusTree(state, treeId): GameplayState` — focuses an ACTIVE tree;
  focusing a complete or unknown tree returns the state unchanged.
- `focusedTree(state): Tree | undefined` — the focused tree, or undefined if
  none / it has completed (complete trees are never presented as focused).

## Done when

Tests written FIRST from this spec.

Example tests (mirror acceptance §7):

- planting is allowed on an unlocked dead tile and on a vibrant tile;
- planting is blocked on a fogged tile and on an occupied tile (with the
  matching rejection reasons);
- a 4th plant while 3 trees are active is rejected with 'cap';
- completing a tree frees its slot: after one of 3 active trees reaches 18
  tasks, a new plant succeeds;
- a successful plant converts the 3×3 around the tile to vibrant and the
  surrounding dead ring shows up in transitionTiles;
- a successful plant focuses the new tree; focusTree switches focus between
  active trees; focusing a complete tree leaves focus unchanged; focusedTree
  is undefined when the focused tree completes.

Property test (fast-check) — the demo-protecting invariant (the ONLY property
for this slice):

- Over any random sequence of plant attempts and task-completion events, the
  number of active trees never exceeds ACTIVE_TREE_CAP (3).

`pnpm verify` green.

## Out of scope

XP/section unlocks/type-B availability (S6), UI/modal, rendering,
persistence. Everything not listed. No changes outside `src/modules/systems/`
(plus `.task/`).
