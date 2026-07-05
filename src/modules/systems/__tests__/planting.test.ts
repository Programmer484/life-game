import { describe, it, expect } from 'vitest';
import { GOAL_TEMPLATES } from '../../config/index.ts';
import type { TileCoord } from '../../config/index.ts';
import { createGoal, taskCompletedEvent } from '../../entities/index.ts';
import { createWorld, tileState, vibrancyAt } from '../../world/index.ts';
import { applyTaskCompleted, canPlant, focusTree, focusedTree, plantTree } from '../index.ts';
import type { GameplayState } from '../index.ts';

function freshGameplay(): GameplayState {
  return { world: createWorld(), trees: [], goals: {} };
}

function plant(state: GameplayState, id: string, tile: TileCoord) {
  return plantTree(state, {
    id,
    tile,
    type: 'A',
    goal: createGoal(`${id}-goal`, GOAL_TEMPLATES.sleep),
  });
}

/** Complete `count` tasks on a tree, preserving the gameplay fields. */
function completeTasks(state: GameplayState, treeId: string, count: number): GameplayState {
  let next = state;
  for (let i = 0; i < count; i++) {
    next = { ...next, ...applyTaskCompleted(next, taskCompletedEvent(treeId, i)) };
  }
  return next;
}

describe('systems (planting)', () => {
  it('allows planting on an unlocked dead tile', () => {
    const state = freshGameplay();
    expect(canPlant(state, { x: 2, y: 2 })).toEqual({ ok: true });
    const { state: after, rejected } = plant(state, 't1', { x: 2, y: 2 });
    expect(rejected).toBeUndefined();
    expect(after.trees).toHaveLength(1);
    expect(after.trees[0]!.tile).toEqual({ x: 2, y: 2 });
    expect(after.goals['t1-goal']).toBeDefined();
  });

  it('allows planting on a vibrant tile', () => {
    const first = plant(freshGameplay(), 't1', { x: 1, y: 1 }).state;
    expect(tileState(first.world, { x: 2, y: 2 })).toBe('vibrant');
    expect(canPlant(first, { x: 2, y: 2 })).toEqual({ ok: true });
    const { state: after, rejected } = plant(first, 't2', { x: 2, y: 2 });
    expect(rejected).toBeUndefined();
    expect(after.trees).toHaveLength(2);
  });

  it("rejects planting on a fogged tile with 'fogged'", () => {
    const state = freshGameplay();
    expect(canPlant(state, { x: 6, y: 0 })).toEqual({ ok: false, reason: 'fogged' });
    const result = plant(state, 't1', { x: 6, y: 0 });
    expect(result.rejected).toBe('fogged');
    expect(result.state).toBe(state);
  });

  it("rejects planting off the island with 'off-island'", () => {
    const state = freshGameplay();
    expect(canPlant(state, { x: 100, y: 100 })).toEqual({ ok: false, reason: 'off-island' });
    expect(plant(state, 't1', { x: 100, y: 100 }).rejected).toBe('off-island');
  });

  it("rejects planting on an occupied tile with 'occupied'", () => {
    const state = plant(freshGameplay(), 't1', { x: 2, y: 2 }).state;
    expect(canPlant(state, { x: 2, y: 2 })).toEqual({ ok: false, reason: 'occupied' });
    const result = plant(state, 't2', { x: 2, y: 2 });
    expect(result.rejected).toBe('occupied');
    expect(result.state).toBe(state);
  });

  it('keeps a tile occupied by a COMPLETE tree occupied', () => {
    let state = plant(freshGameplay(), 't1', { x: 2, y: 2 }).state;
    state = completeTasks(state, 't1', 18);
    expect(canPlant(state, { x: 2, y: 2 })).toEqual({ ok: false, reason: 'occupied' });
  });

  it("rejects a 4th plant while 3 trees are active with 'cap'", () => {
    let state = freshGameplay();
    state = plant(state, 't1', { x: 0, y: 0 }).state;
    state = plant(state, 't2', { x: 2, y: 0 }).state;
    state = plant(state, 't3', { x: 4, y: 0 }).state;
    expect(canPlant(state, { x: 0, y: 4 })).toEqual({ ok: false, reason: 'cap' });
    const result = plant(state, 't4', { x: 0, y: 4 });
    expect(result.rejected).toBe('cap');
    expect(result.state).toBe(state);
  });

  it('frees a slot when a tree completes: a new plant succeeds after 18 tasks', () => {
    let state = freshGameplay();
    state = plant(state, 't1', { x: 0, y: 0 }).state;
    state = plant(state, 't2', { x: 2, y: 0 }).state;
    state = plant(state, 't3', { x: 4, y: 0 }).state;
    state = completeTasks(state, 't1', 18);
    expect(canPlant(state, { x: 0, y: 4 })).toEqual({ ok: true });
    const result = plant(state, 't4', { x: 0, y: 4 });
    expect(result.rejected).toBeUndefined();
    expect(result.state.trees).toHaveLength(4);
  });

  it('converts the 3×3 around a successful plant to vibrant', () => {
    const { state } = plant(freshGameplay(), 't1', { x: 2, y: 2 });
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(tileState(state.world, { x, y })).toBe('vibrant');
      }
    }
  });

  it('yields the +3/+2/+1 vibrancy pattern around a planted tree', () => {
    const { state } = plant(freshGameplay(), 't1', { x: 2, y: 2 });
    const treeTiles = state.trees.map((tree) => tree.tile);
    expect(vibrancyAt({ x: 2, y: 2 }, treeTiles)).toBe(3);
    expect(vibrancyAt({ x: 3, y: 2 }, treeTiles)).toBe(2);
    expect(vibrancyAt({ x: 3, y: 3 }, treeTiles)).toBe(1); // diagonal, d=2
    expect(vibrancyAt({ x: 5, y: 2 }, treeTiles)).toBe(0);
  });

  it('focuses the newly planted tree', () => {
    let state = plant(freshGameplay(), 't1', { x: 0, y: 0 }).state;
    expect(state.focusedTreeId).toBe('t1');
    expect(focusedTree(state)?.id).toBe('t1');
    state = plant(state, 't2', { x: 2, y: 0 }).state;
    expect(focusedTree(state)?.id).toBe('t2');
  });

  it('switches focus between active trees with focusTree', () => {
    let state = plant(freshGameplay(), 't1', { x: 0, y: 0 }).state;
    state = plant(state, 't2', { x: 2, y: 0 }).state;
    state = focusTree(state, 't1');
    expect(focusedTree(state)?.id).toBe('t1');
  });

  it('leaves focus unchanged when focusing a complete or unknown tree', () => {
    let state = plant(freshGameplay(), 't1', { x: 0, y: 0 }).state;
    state = plant(state, 't2', { x: 2, y: 0 }).state;
    state = completeTasks(state, 't1', 18);
    expect(focusTree(state, 't1')).toBe(state);
    expect(focusTree(state, 'ghost')).toBe(state);
    expect(focusedTree(state)?.id).toBe('t2');
  });

  it('presents no focused tree once the focused tree completes', () => {
    let state = plant(freshGameplay(), 't1', { x: 0, y: 0 }).state;
    state = completeTasks(state, 't1', 18);
    expect(focusedTree(state)).toBeUndefined();
  });
});
