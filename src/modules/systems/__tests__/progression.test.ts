import { describe, it, expect } from 'vitest';
import { TASKS_PER_TREE, UNLOCK_COSTS } from '../../config/index.ts';
import type { Tree } from '../../config/index.ts';
import { createWorld, isSectionUnlocked, tileState } from '../../world/index.ts';
import { applyProgression, availableTreeTypes, fullyGrownCount, xpProgress } from '../index.ts';
import type { GameplayState } from '../index.ts';

function tree(id: string, tasksDone: number): Tree {
  return { id, tile: { x: 0, y: 0 }, type: 'A', goalId: `${id}-goal`, tasksDone };
}

/** Gameplay state with `grown` fully grown trees plus optional partial trees. */
function stateWith(grown: number, partials: number[] = []): GameplayState {
  const trees = [
    ...Array.from({ length: grown }, (_, i) => tree(`g${String(i)}`, TASKS_PER_TREE)),
    ...partials.map((done, i) => tree(`p${String(i)}`, done)),
  ];
  return { world: createWorld(), trees, goals: {} };
}

describe('systems (progression)', () => {
  it('counts only fully grown trees', () => {
    const state = stateWith(2, [9, 17]);
    expect(fullyGrownCount(state.trees)).toBe(2);
  });

  it('unlocks section 2 and makes type B available at 4 fully grown trees', () => {
    const state = stateWith(4);
    expect(xpProgress(state)).toBe(1);
    const after = applyProgression(state);
    expect(isSectionUnlocked(after.world, 2)).toBe(true);
    expect(tileState(after.world, { x: 6, y: 0 })).toBe('dead');
    expect(availableTreeTypes(after)).toEqual(['A', 'B']);
  });

  it('keeps section 2 fogged and only type A available at 3 fully grown trees', () => {
    const after = applyProgression(stateWith(3));
    expect(isSectionUnlocked(after.world, 2)).toBe(false);
    expect(tileState(after.world, { x: 6, y: 0 })).toBe('fog');
    expect(availableTreeTypes(after)).toEqual(['A']);
  });

  it('carries unlock progress: 4 fully grown with section 2 unlocked shows 4/8 toward section 3', () => {
    const after = applyProgression(stateWith(4));
    expect(xpProgress(after)).toBe(0.5);
  });

  it('counts partial trees fractionally in xpProgress but not toward the unlock trigger', () => {
    const state = stateWith(0, [9]);
    expect(xpProgress(state)).toBe(0.5 / UNLOCK_COSTS[0]);
    expect(fullyGrownCount(state.trees)).toBe(0);
    const state2 = stateWith(3, [TASKS_PER_TREE - 1]);
    const after = applyProgression(state2);
    expect(isSectionUnlocked(after.world, 2)).toBe(false);
  });

  it('unlocks multiple sections in order when several thresholds are met at once', () => {
    const after = applyProgression(stateWith(8));
    expect(isSectionUnlocked(after.world, 2)).toBe(true);
    expect(isSectionUnlocked(after.world, 3)).toBe(true);
    expect(isSectionUnlocked(after.world, 4)).toBe(false);
  });

  it('is idempotent and immutable, and a no-op when nothing qualifies', () => {
    const state = stateWith(4);
    const once = applyProgression(state);
    expect(once).not.toBe(state);
    expect(isSectionUnlocked(state.world, 2)).toBe(false); // input untouched
    const twice = applyProgression(once);
    expect(twice).toBe(once); // idempotent no-op returns the same reference
  });

  it('returns the same state when no threshold is met', () => {
    const state = stateWith(0);
    expect(applyProgression(state)).toBe(state);
  });

  it('ignores a locked section with no cost entry instead of throwing', () => {
    const base = stateWith(1000);
    const world = {
      ...base.world,
      sections: [...base.world.sections, { id: 99, unlockedAtStart: false, tiles: [] }],
    };
    const state = { ...base, world };
    const after = applyProgression(state); // must not throw on the costless id
    expect(xpProgress(after)).toBe(1);
  });

  it('reports progress 1 when every section is unlocked', () => {
    const state = stateWith(UNLOCK_COSTS[UNLOCK_COSTS.length - 1]!);
    const after = applyProgression(state);
    for (const section of after.world.sections) {
      expect(isSectionUnlocked(after.world, section.id)).toBe(true);
    }
    expect(xpProgress(after)).toBe(1);
  });
});
