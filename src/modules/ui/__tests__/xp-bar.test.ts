// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { TASKS_PER_TREE, UNLOCK_COST_BY_SECTION } from '../../config/index.ts';
import type { Tree } from '../../config/index.ts';
import { createTree } from '../../entities/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import { createWorld, unlockSection } from '../../world/index.ts';
import { createXpBar } from '../index.ts';

/** `count` fully grown trees (all 18 tasks done), each on its own tile. */
function grownTrees(count: number): Tree[] {
  return Array.from({ length: count }, (_, i) => ({
    ...createTree(`tree-${i}`, { x: i, y: 0 }, 'A', 'goal'),
    tasksDone: TASKS_PER_TREE,
  }));
}

/** A gameplay state with the given trees and the given sections unlocked. */
function stateWith(trees: Tree[], unlockedSections: number[] = []): GameplayState {
  const world = unlockedSections.reduce((acc, id) => unlockSection(acc, id), createWorld());
  return { trees, goals: {}, world };
}

function query(el: HTMLElement, testid: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

describe('ui / xp bar', () => {
  it('renders a 0% fill and no full marker when there are no trees', () => {
    const bar = createXpBar();
    bar.update(stateWith([]));

    expect(bar.el.dataset['testid']).toBe('xp-bar');
    expect(query(bar.el, 'xp-bar-fill')?.style.width).toBe('0%');
    expect(bar.el.hasAttribute('data-full')).toBe(false);
  });

  it('renders an 80% fill for 4 fully grown trees when section 2 is already unlocked', () => {
    // Section 3 costs 5, so 4 fully grown trees fill 4/5 = 80% of the bar.
    const bar = createXpBar();
    bar.update(stateWith(grownTrees(4), [2]));

    expect(query(bar.el, 'xp-bar-fill')?.style.width).toBe('80%');
    expect(bar.el.hasAttribute('data-full')).toBe(false);
  });

  it('marks the bar full exactly when progress reaches 1', () => {
    const bar = createXpBar();

    bar.update(stateWith(grownTrees(3)));
    expect(bar.el.hasAttribute('data-full')).toBe(false);

    bar.update(stateWith(grownTrees(4)));
    expect(bar.el.hasAttribute('data-full')).toBe(true);
    expect(query(bar.el, 'xp-bar-fill')?.style.width).toBe('100%');
  });

  it('clears the full marker when progress drops below 1 again', () => {
    const bar = createXpBar();
    bar.update(stateWith(grownTrees(4)));
    expect(bar.el.hasAttribute('data-full')).toBe(true);

    bar.update(stateWith(grownTrees(4), [2]));
    expect(bar.el.hasAttribute('data-full')).toBe(false);
  });

  it('labels fully-grown count against the next unlock cost', () => {
    const bar = createXpBar();

    bar.update(stateWith([]));
    expect(query(bar.el, 'xp-bar-label')?.textContent).toBe(
      `0 / ${UNLOCK_COST_BY_SECTION[2] ?? NaN}`,
    );

    bar.update(stateWith(grownTrees(4), [2]));
    expect(query(bar.el, 'xp-bar-label')?.textContent).toBe(
      `4 / ${UNLOCK_COST_BY_SECTION[3] ?? NaN}`,
    );
  });

  it('labels MAX when every section is unlocked', () => {
    const bar = createXpBar();
    const allSections = Object.keys(UNLOCK_COST_BY_SECTION).map(Number);
    bar.update(stateWith(grownTrees(1), allSections));

    expect(query(bar.el, 'xp-bar-label')?.textContent).toBe('MAX');
    expect(query(bar.el, 'xp-bar-fill')?.style.width).toBe('100%');
    expect(bar.el.hasAttribute('data-full')).toBe(true);
  });

  it('does not duplicate DOM nodes across repeated updates', () => {
    const bar = createXpBar();
    const state = stateWith(grownTrees(2));
    bar.update(state);
    bar.update(state);
    bar.update(state);

    expect(bar.el.querySelectorAll('[data-testid="xp-bar-fill"]')).toHaveLength(1);
    expect(bar.el.querySelectorAll('[data-testid="xp-bar-label"]')).toHaveLength(1);
  });
});
