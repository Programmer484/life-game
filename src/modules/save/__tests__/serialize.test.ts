import { describe, it, expect } from 'vitest';
import type { TileCoord } from '../../config/index.ts';
import { GOAL_TEMPLATES, ISLAND_LAYOUT, TASKS_PER_TREE } from '../../config/index.ts';
import type { World } from '../../world/index.ts';
import { revealAround, tileState, unlockSection } from '../../world/index.ts';
import { completeNextTask, createGoal, createTree } from '../../entities/index.ts';
import { createDemoState, fromSave, toSave } from '../index.ts';

/** Snapshot every on-island tile's state for whole-world comparison. */
function tileStates(world: World): Record<string, string> {
  const states: Record<string, string> = {};
  for (const section of ISLAND_LAYOUT) {
    for (const coord of section.tiles) {
      states[`${String(coord.x)},${String(coord.y)}`] = tileState(world, coord) ?? 'missing';
    }
  }
  return states;
}

describe('save · round-trip', () => {
  it('reproduces the demo state exactly (tiles, trees, goals, storySeen)', () => {
    const demo = createDemoState();

    const restored = fromSave(toSave(demo));

    expect(tileStates(restored.world)).toEqual(tileStates(demo.world));
    expect(restored.trees).toEqual(demo.trees);
    expect(restored.goals).toEqual(demo.goals);
    expect(restored.storySeen).toBe(demo.storySeen);
    expect(restored.coach).toEqual(demo.coach);
  });

  it('reproduces a richer state: section 2 unlocked, one complete and one mid-progress tree', () => {
    const demo = createDemoState();
    let world = unlockSection(demo.world, 2);

    // A complete tree (all tasks done) on a section-2 tile.
    const doneTile: TileCoord = { x: 7, y: 2 };
    let doneGoal = createGoal('goal-done', GOAL_TEMPLATES.workout);
    for (let i = 0; i < TASKS_PER_TREE; i++) doneGoal = completeNextTask(doneGoal);
    const doneTree = { ...createTree('tree-done', doneTile, 'B', doneGoal.id), tasksDone: 18 };
    world = revealAround(world, doneTile);

    // A mid-progress tree (5 tasks done) elsewhere in section 1.
    const midTile: TileCoord = { x: 4, y: 4 };
    let midGoal = createGoal('goal-mid', GOAL_TEMPLATES.sleep);
    for (let i = 0; i < 5; i++) midGoal = completeNextTask(midGoal);
    const midTree = { ...createTree('tree-mid', midTile, 'A', midGoal.id), tasksDone: 5 };
    world = revealAround(world, midTile);

    const state = {
      world,
      trees: [...demo.trees, doneTree, midTree],
      goals: { ...demo.goals, [doneGoal.id]: doneGoal, [midGoal.id]: midGoal },
      storySeen: true,
      coach: {
        memory: { facts: ['Night owl', 'Prefers small steps'] },
        config: { tone: 'gentle' as const, customInstructions: 'Keep it short' },
      },
    };

    const restored = fromSave(toSave(state));

    expect(tileStates(restored.world)).toEqual(tileStates(state.world));
    expect(restored.trees).toEqual(state.trees);
    expect(restored.goals).toEqual(state.goals);
    expect(restored.storySeen).toBe(true);
    expect(restored.coach).toEqual(state.coach);
    // Deep copy, not aliasing: the restored coach is a distinct object graph.
    expect(restored.coach.memory.facts).not.toBe(state.coach.memory.facts);
  });

  it('does not persist focus: toSave carries only version, storySeen, sections, trees, goals, coach', () => {
    const data = toSave(createDemoState());

    expect(Object.keys(data).sort()).toEqual([
      'coach',
      'goals',
      'storySeen',
      'trees',
      'unlockedSections',
      'version',
    ]);
    expect(data.version).toBe(2);
  });
});

describe('save · demo state', () => {
  it('has exactly one type-A tree with the Sleep plan goal and 0 tasks done', () => {
    const demo = createDemoState();

    expect(demo.trees).toHaveLength(1);
    const tree = demo.trees[0];
    if (!tree) throw new Error('demo tree missing');
    expect(tree.type).toBe('A');
    expect(tree.tasksDone).toBe(0);
    const goal = demo.goals[tree.goalId];
    expect(goal?.name).toBe(GOAL_TEMPLATES.sleep.name);
    expect(goal?.tasks.every((t) => !t.done)).toBe(true);
    expect(Object.keys(demo.goals)).toHaveLength(1);
  });

  it('plants on the first section-1 tile whose 3×3 lies inside section 1, already vibrant', () => {
    const demo = createDemoState();
    const tree = demo.trees[0];
    if (!tree) throw new Error('demo tree missing');

    // First tile in ISLAND_LAYOUT order with its full 3×3 inside section 1.
    expect(tree.tile).toEqual({ x: 1, y: 1 });

    const section1 = ISLAND_LAYOUT.find((s) => s.id === 1);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const coord = { x: tree.tile.x + dx, y: tree.tile.y + dy };
        expect(section1?.tiles).toContainEqual(coord);
        expect(tileState(demo.world, coord)).toBe('vibrant');
      }
    }
  });

  it('starts with storySeen false and a fresh coach', () => {
    const demo = createDemoState();
    expect(demo.storySeen).toBe(false);
    expect(demo.coach).toEqual({ memory: { facts: [] }, config: {} });
  });
});
