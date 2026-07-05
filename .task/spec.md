# S0 · Contracts & config

**Module:** `config` (src/modules/config) — this slice touches ONLY this module.

## Behavior

`config` is the single source for shared contract types and every tunable
number/text in the game. No other module may inline these values.

### Types (exported from `src/modules/config/index.ts`)

- `TileState` = `'fog' | 'dead' | 'vibrant'`
- `TreeType` = `'A' | 'B'`
- `GrowthStage` = `1 | 2 | 3 | 4 | 5`
- `TileCoord` = `{ x: number; y: number }`
- `TaskDef` = `{ title: string; estimatedMinutes: number }`
- `TaskState` = `TaskDef & { done: boolean }`
- `Goal` = `{ id: string; name: string; tasks: TaskState[] }` (ordered, 18 tasks)
- `Tree` = `{ id: string; tile: TileCoord; type: TreeType; goalId: string; tasksDone: number }`
- `TaskCompletedEvent` = `{ type: 'task-completed'; treeId: string; taskIndex: number }`
- `SectionDef` = `{ id: number; unlockedAtStart: boolean; tiles: TileCoord[] }`
- `GoalTemplate` = `{ name: string; tasks: TaskDef[] }` (exactly 18)

### Constants (exported, `as const` where sensible)

- `ACTIVE_TREE_CAP = 3`
- `STAGE_TASKS = [3, 4, 5, 6]` — tasks to advance stage 1→2, 2→3, 3→4, 4→5
- `TASKS_PER_TREE = 18` (must equal the sum of STAGE_TASKS)
- `REVEAL_SIZE = { width: 3, height: 3 }` — the 3×3 dead→vibrant reveal
- `UNLOCK_COSTS = [4, 8, 16, 32, 64, 128]` — fully-grown trees needed to
  unlock sections 2..7
- `ISLAND_LAYOUT: SectionDef[]` — hard-coded jagged floating island: exactly
  **7 sections**, each **36 ± 5 tiles** (31..41), section id 1 has
  `unlockedAtStart: true`, all others false. Tiles are unique integer grid
  coords across the whole island; the overall outline must be jagged (NOT a
  filled rectangle — at minimum, the union of tiles must not form a perfect
  rectangle). Sections must be contiguous and adjacent so the island reads as
  one landmass.
- `STORY_BLOCKS: string[]` — exactly 6 blocks, verbatim text below.
- `GOAL_TEMPLATES: { sleep: GoalTemplate; workout: GoalTemplate }` — verbatim
  below, ranges expanded into individual tasks, exactly 18 each.

### STORY_BLOCKS (verbatim)

1. Long ago, the island was a living jewel — rolling green tiles, groves heavy with fruit, rivers of light. All of it was tended by a goddess who loved the world as a mother loves a newborn, walking the land each day to coax every seed into bloom.
2. But the world was young, and the young grow. As the island learned to hold its own shape, the goddess came less often — a visit each season, then each year, trusting her creation to stand on its own.
3. And in the quiet she left behind, a darkness began to seep in — a cold fog, a creeping sludge. It was temptation; it was the small surrenders and unkept promises that ask for nothing yet take everything.
4. At first it was only a stain at the island's edge, and whenever it spread too far the goddess would return and cleanse the land with her light — and for a while the world remembered how to shine.
5. But her visits grew rarer still, until one day they stopped altogether. With no one to push back the dark, the fog swallowed the groves, the rivers dimmed, and the island slowly withered into silence.
6. So it remained through a long age of night… until you arrive. Where your feet touch the earth, one tree stands green and the tiles around it warm back to color — a single patch of living light in a drowned world. You are the seed of life. The rest is up to you.

### GOAL_TEMPLATES.sleep — "Sleep plan" (18 tasks: title, minutes)

1. Estimate your bed/wake times for the past week — set a baseline (15)
2. Pick your target sleep window and write down your why (15)
3. Set a nightly wind-down alarm 45 min before bed (15)
4. Bedroom audit: blackout fixes, cover/remove light sources (30)
5. Move phone charging outside the bedroom (15)
6. Set a caffeine cutoff (none after 2 pm) + pick a replacement drink (15)
7. Write a 3-step wind-down routine (20)
8. Night 1: follow the wind-down routine + hit your sleep window; log it (15)
9. Night 2: follow the wind-down routine + hit your sleep window; log it (15)
10. Night 3: follow the wind-down routine + hit your sleep window; log it (15)
11. Night 4: follow the wind-down routine + hit your sleep window; log it (15)
12. Night 5: follow the wind-down routine + hit your sleep window; log it (15)
13. Night 6: hit your sleep window; log it (15)
14. Night 7: hit your sleep window; log it (15)
15. Night 8: hit your sleep window; log it (15)
16. Night 9: hit your sleep window; log it (15)
17. Night 10: hit your sleep window; log it (15)
18. Review the log: biggest blocker + one adjustment going forward (20)

### GOAL_TEMPLATES.workout — "Workout plan" (18 tasks: title, minutes)

1. Pick your focus (strength/cardio) + block 3 weekly slots in your calendar (15)
2. Choose a beginner program template (20)
3. Prep gear & space — shoes, mat, gym access (30)
4. Week 1: workout 1 at easy effort (45)
5. Week 1: workout 2 at easy effort (45)
6. Week 1: workout 3 at easy effort (45)
7. Recovery walk + note how the week felt (20)
8. Week 2: workout 4 with small progression (45)
9. Week 2: workout 5 with small progression (45)
10. Week 2: workout 6 with small progression (45)
11. Mobility / stretch session (20)
12. Log numbers + set next week's targets (15)
13. Week 3: workout 7 (45)
14. Week 3: workout 8 (45)
15. Week 3: workout 9 (45)
16. Active recovery session (30)
17. Progress check vs week 1 — reps/weights/pace (15)
18. Plan the next 4 weeks (30)

## Done when

- Everything above is exported from `src/modules/config/index.ts` and
  typechecks.
- Example tests (written FIRST, from this spec) assert: both templates have
  exactly 18 tasks with the expected first/last titles and minutes; STAGE_TASKS
  sums to TASKS_PER_TREE; UNLOCK_COSTS === [4,8,16,32,64,128]; ISLAND_LAYOUT
  has 7 sections, each 31–41 unique tiles, only section 1 unlockedAtStart, no
  duplicate tile coords across sections, and the tile union is not a perfect
  rectangle; STORY_BLOCKS has exactly 6 non-empty blocks.
- `pnpm verify` green.

## Out of scope

Everything not listed: no world/entity/system logic, no rendering, no UI, no
persistence, no changes outside `src/modules/config/` (plus `.task/`).
