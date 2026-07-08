import { describe, it, expect } from 'vitest';
import {
  ACTIVE_TREE_CAP,
  STAGE_TASKS,
  TASKS_PER_TREE,
  REVEAL_SIZE,
  UNLOCK_COST_BY_SECTION,
  ISLAND_LAYOUT,
  STORY_BLOCKS,
  GOAL_TEMPLATES,
} from '../index.ts';
import type {
  TileState,
  TreeType,
  GrowthStage,
  TileCoord,
  TaskDef,
  TaskState,
  Goal,
  Tree,
  TaskCompletedEvent,
  SectionDef,
  GoalTemplate,
} from '../index.ts';

describe('config · goal templates', () => {
  it('sleep template has exactly 18 tasks with the expected first/last titles and minutes', () => {
    const sleep: GoalTemplate = GOAL_TEMPLATES.sleep;
    expect(sleep.name).toBe('Sleep plan');
    expect(sleep.tasks).toHaveLength(18);
    expect(sleep.tasks[0]).toEqual({
      title: 'Estimate your bed/wake times for the past week — set a baseline',
      estimatedMinutes: 15,
    });
    expect(sleep.tasks[17]).toEqual({
      title: 'Review the log: biggest blocker + one adjustment going forward',
      estimatedMinutes: 20,
    });
  });

  it('workout template has exactly 18 tasks with the expected first/last titles and minutes', () => {
    const workout: GoalTemplate = GOAL_TEMPLATES.workout;
    expect(workout.name).toBe('Workout plan');
    expect(workout.tasks).toHaveLength(18);
    expect(workout.tasks[0]).toEqual({
      title: 'Pick your focus (strength/cardio) + block 3 weekly slots in your calendar',
      estimatedMinutes: 15,
    });
    expect(workout.tasks[17]).toEqual({
      title: 'Plan the next 4 weeks',
      estimatedMinutes: 30,
    });
  });

  it('every template task is a TaskDef with a non-empty title and positive minutes', () => {
    const all: TaskDef[] = [...GOAL_TEMPLATES.sleep.tasks, ...GOAL_TEMPLATES.workout.tasks];
    for (const task of all) {
      expect(task.title.length).toBeGreaterThan(0);
      expect(task.estimatedMinutes).toBeGreaterThan(0);
    }
  });
});

describe('config · tunable numbers', () => {
  it('ACTIVE_TREE_CAP is 3', () => {
    expect(ACTIVE_TREE_CAP).toBe(3);
  });

  it('STAGE_TASKS sums to TASKS_PER_TREE', () => {
    expect(STAGE_TASKS).toEqual([3, 4, 5, 6]);
    const sum = STAGE_TASKS.reduce((a, b) => a + b, 0);
    expect(sum).toBe(TASKS_PER_TREE);
    expect(TASKS_PER_TREE).toBe(18);
  });

  it('REVEAL_SIZE is the 3×3 dead→vibrant reveal', () => {
    expect(REVEAL_SIZE).toEqual({ width: 3, height: 3 });
  });

  it('UNLOCK_COST_BY_SECTION covers every locked section, starting at 4', () => {
    const lockedIds = ISLAND_LAYOUT.filter((s) => !s.unlockedAtStart).map((s) => s.id);
    expect(
      Object.keys(UNLOCK_COST_BY_SECTION)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual(lockedIds.sort((a, b) => a - b));
    expect(UNLOCK_COST_BY_SECTION[2]).toBe(4);
  });

  it('unlock costs are strictly monotonically increasing in layout order', () => {
    const costs = ISLAND_LAYOUT.filter((s) => !s.unlockedAtStart).map(
      (s) => UNLOCK_COST_BY_SECTION[s.id] ?? NaN,
    );
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThan(costs[i - 1] ?? NaN);
    }
  });

  it('UNLOCK_COST_BY_SECTION has no entry for start or unknown section ids', () => {
    expect(UNLOCK_COST_BY_SECTION[1]).toBeUndefined();
    expect(UNLOCK_COST_BY_SECTION[99]).toBeUndefined();
  });
});

describe('config · ISLAND_LAYOUT', () => {
  const keyOf = (t: TileCoord): string => `${String(t.x)},${String(t.y)}`;

  it('has exactly 25 sections with unique ids', () => {
    expect(ISLAND_LAYOUT).toHaveLength(25);
    expect(new Set(ISLAND_LAYOUT.map((s) => s.id)).size).toBe(25);
  });

  it('section 1 keeps its original coords (save/demo compatibility)', () => {
    const start = ISLAND_LAYOUT.find((s) => s.id === 1);
    const expected = new Set<string>();
    for (let y = 0; y <= 5; y++) for (let x = 0; x <= 5; x++) expected.add(`${x},${y}`);
    expect(new Set(start?.tiles.map(keyOf))).toEqual(expected);
  });

  it('each section has 25–42 unique tiles', () => {
    for (const section of ISLAND_LAYOUT) {
      expect(section.tiles.length).toBeGreaterThanOrEqual(25);
      expect(section.tiles.length).toBeLessThanOrEqual(42);
      const unique = new Set(section.tiles.map(keyOf));
      expect(unique.size).toBe(section.tiles.length);
    }
  });

  it('every section is edge-reachable from section 1', () => {
    // Flood-fill over section adjacency: two sections are adjacent when any
    // of their tiles share an orthogonal edge.
    const tileSets = new Map(ISLAND_LAYOUT.map((s) => [s.id, new Set(s.tiles.map(keyOf))]));
    const touches = (a: number, b: number): boolean => {
      const other = tileSets.get(b);
      const own = ISLAND_LAYOUT.find((s) => s.id === a)?.tiles ?? [];
      return own.some(
        (t) =>
          other?.has(`${t.x + 1},${t.y}`) ||
          other?.has(`${t.x - 1},${t.y}`) ||
          other?.has(`${t.x},${t.y + 1}`) ||
          other?.has(`${t.x},${t.y - 1}`),
      );
    };
    const reached = new Set([1]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of ISLAND_LAYOUT) {
        if (reached.has(s.id)) continue;
        if ([...reached].some((id) => touches(s.id, id))) {
          reached.add(s.id);
          grew = true;
        }
      }
    }
    expect([...reached].sort((a, b) => a - b)).toEqual(
      ISLAND_LAYOUT.map((s) => s.id).sort((a, b) => a - b),
    );
  });

  it('only section 1 is unlockedAtStart', () => {
    const unlocked: SectionDef[] = ISLAND_LAYOUT.filter((s) => s.unlockedAtStart);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0]?.id).toBe(1);
  });

  it('has no duplicate tile coords across sections', () => {
    const allTiles = ISLAND_LAYOUT.flatMap((s) => s.tiles);
    const unique = new Set(allTiles.map(keyOf));
    expect(unique.size).toBe(allTiles.length);
  });

  it('tile union is not a perfect rectangle', () => {
    const allTiles = ISLAND_LAYOUT.flatMap((s) => s.tiles);
    const xs = allTiles.map((t) => t.x);
    const ys = allTiles.map((t) => t.y);
    const width = Math.max(...xs) - Math.min(...xs) + 1;
    const height = Math.max(...ys) - Math.min(...ys) + 1;
    expect(allTiles.length).toBeLessThan(width * height);
  });

  it('tile coords are integers', () => {
    for (const section of ISLAND_LAYOUT) {
      for (const tile of section.tiles) {
        expect(Number.isInteger(tile.x)).toBe(true);
        expect(Number.isInteger(tile.y)).toBe(true);
      }
    }
  });
});

describe('config · STORY_BLOCKS', () => {
  it('has exactly 6 non-empty blocks', () => {
    expect(STORY_BLOCKS).toHaveLength(6);
    for (const block of STORY_BLOCKS) {
      expect(block.trim().length).toBeGreaterThan(0);
    }
  });

  it('opens with the living island and ends with the player as the seed of life', () => {
    expect(STORY_BLOCKS[0]).toContain('the island was a living jewel');
    expect(STORY_BLOCKS[5]).toContain('You are the seed of life. The rest is up to you.');
  });
});

describe('config · contract types', () => {
  it('shared contract types compose as specified', () => {
    const state: TileState = 'vibrant';
    const type: TreeType = 'A';
    const stage: GrowthStage = 5;
    const coord: TileCoord = { x: 0, y: 0 };
    const def: TaskDef = { title: 't', estimatedMinutes: 5 };
    const taskState: TaskState = { ...def, done: false };
    const goal: Goal = { id: 'g1', name: 'Goal', tasks: [taskState] };
    const tree: Tree = { id: 't1', tile: coord, type, goalId: goal.id, tasksDone: 0 };
    const event: TaskCompletedEvent = {
      type: 'task-completed',
      treeId: tree.id,
      taskIndex: 0,
    };

    expect(state).toBe('vibrant');
    expect(stage).toBe(5);
    expect(event.type).toBe('task-completed');
    expect(goal.tasks[0]?.done).toBe(false);
  });
});
