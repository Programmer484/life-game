// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { GOAL_TEMPLATES } from '../../config/index.ts';
import { createGoal, createTree, taskCompletedEvent } from '../../entities/index.ts';
import { applyTaskCompleted } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import { createWorld } from '../../world/index.ts';
import { createDevPanel } from '../index.ts';

const GOAL_ID = 'goal-1';
const TREE_ID = 'tree-1';

/** A gameplay state with one planted tree on the sleep goal, focused by default. */
function stateWithTree(overrides: Partial<GameplayState> = {}): GameplayState {
  const goal = createGoal(GOAL_ID, GOAL_TEMPLATES.sleep);
  const tree = createTree(TREE_ID, { x: 2, y: 2 }, 'A', GOAL_ID);
  return {
    trees: [tree],
    goals: { [GOAL_ID]: goal },
    world: createWorld(),
    focusedTreeId: TREE_ID,
    ...overrides,
  };
}

/** Complete the first `count` tasks of the focused tree via the systems module. */
function advance(state: GameplayState, count: number): GameplayState {
  let next = state;
  for (let i = 0; i < count; i++) {
    next = { ...next, ...applyTaskCompleted(next, taskCompletedEvent(TREE_ID, i)) };
  }
  return next;
}

function noDeps(): { onSkipStage: () => void } {
  return { onSkipStage: () => {} };
}

function query(el: HTMLElement, testid: string): HTMLButtonElement | null {
  return el.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`);
}

describe('dev panel', () => {
  it('renders the skip button with its label and no plant button', () => {
    const panel = createDevPanel(noDeps());

    expect(panel.el.dataset['testid']).toBe('dev-panel');
    expect(query(panel.el, 'dev-skip-stage')?.textContent).toBe('Skip to next tree stage');
    expect(query(panel.el, 'dev-plant-grown')).toBeNull();
  });

  it('calls onSkipStage once when the skip button is clicked', () => {
    const onSkipStage = vi.fn();
    const panel = createDevPanel({ ...noDeps(), onSkipStage });
    panel.update(stateWithTree());

    query(panel.el, 'dev-skip-stage')?.click();

    expect(onSkipStage).toHaveBeenCalledTimes(1);
  });

  it('disables skip when no tree is focused (fresh state)', () => {
    const panel = createDevPanel(noDeps());
    panel.update(stateWithTree({ focusedTreeId: undefined }));

    expect(query(panel.el, 'dev-skip-stage')?.disabled).toBe(true);
  });

  it('enables skip when an active tree is focused', () => {
    const panel = createDevPanel(noDeps());
    panel.update(stateWithTree());

    expect(query(panel.el, 'dev-skip-stage')?.disabled).toBe(false);
  });

  it('disables skip again once the focused tree completes', () => {
    const panel = createDevPanel(noDeps());
    const state = stateWithTree();
    panel.update(state);
    panel.update(advance(state, GOAL_TEMPLATES.sleep.tasks.length));

    expect(query(panel.el, 'dev-skip-stage')?.disabled).toBe(true);
  });

  it('does not duplicate DOM nodes or stack listeners across repeated updates', () => {
    const onSkipStage = vi.fn();
    const panel = createDevPanel({ ...noDeps(), onSkipStage });
    const state = stateWithTree();
    panel.update(state);
    panel.update(state);
    panel.update(state);

    expect(panel.el.querySelectorAll('[data-testid="dev-skip-stage"]')).toHaveLength(1);

    query(panel.el, 'dev-skip-stage')?.click();
    expect(onSkipStage).toHaveBeenCalledTimes(1);
  });
});
