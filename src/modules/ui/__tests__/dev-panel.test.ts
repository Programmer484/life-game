// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { GOAL_TEMPLATES } from '../../config/index.ts';
import { createGoal, createTree, taskCompletedEvent } from '../../entities/index.ts';
import { applyTaskCompleted } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import { createWorld } from '../../world/index.ts';
import { createDevPanel } from '../index.ts';
import type { DevPanelDeps } from '../index.ts';
import { DEV_TOOLS } from '../internal/dev-help-modal.ts';

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

function noDeps(): DevPanelDeps {
  return {
    onSkipStage: () => {},
    onCompleteTask: () => {},
    onUnlockSection: () => {},
    onHelp: () => {},
  };
}

function query(el: HTMLElement, testid: string): HTMLButtonElement | null {
  return el.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`);
}

describe('dev panel', () => {
  it('renders one row per DEV_TOOLS entry — shortcut chip and name from the shared constant', () => {
    const panel = createDevPanel(noDeps());

    expect(panel.el.dataset['testid']).toBe('dev-panel');
    const text = panel.el.textContent!;
    for (const tool of DEV_TOOLS) {
      expect(text).toContain(tool.key);
      expect(text).toContain(tool.name);
    }
  });

  it('wires every action control to its callback', () => {
    const deps = {
      onSkipStage: vi.fn(),
      onCompleteTask: vi.fn(),
      onUnlockSection: vi.fn(),
      onHelp: vi.fn(),
    };
    const panel = createDevPanel(deps);
    panel.update(stateWithTree());

    query(panel.el, 'dev-skip-stage')?.click();
    query(panel.el, 'dev-complete-task')?.click();
    query(panel.el, 'dev-unlock-section')?.click();
    query(panel.el, 'dev-help')?.click();

    expect(deps.onSkipStage).toHaveBeenCalledTimes(1);
    expect(deps.onCompleteTask).toHaveBeenCalledTimes(1);
    expect(deps.onUnlockSection).toHaveBeenCalledTimes(1);
    expect(deps.onHelp).toHaveBeenCalledTimes(1);
  });

  it('starts with plant-grown off; the row button and togglePlantGrown() both flip it', () => {
    const panel = createDevPanel(noDeps());
    expect(panel.isPlantGrownEnabled()).toBe(false);
    expect(query(panel.el, 'dev-plant-grown')?.getAttribute('aria-pressed')).toBe('false');

    query(panel.el, 'dev-plant-grown')?.click();
    expect(panel.isPlantGrownEnabled()).toBe(true);
    expect(query(panel.el, 'dev-plant-grown')?.getAttribute('aria-pressed')).toBe('true');

    panel.togglePlantGrown();
    expect(panel.isPlantGrownEnabled()).toBe(false);
    expect(query(panel.el, 'dev-plant-grown')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('collapses to just the header and expands back', () => {
    const panel = createDevPanel(noDeps());
    const body = query(panel.el, 'dev-panel-body')!;
    expect(body.style.display).not.toBe('none');

    panel.toggleCollapsed();
    expect(body.style.display).toBe('none');
    expect(query(panel.el, 'dev-panel-header')?.getAttribute('aria-expanded')).toBe('false');

    query(panel.el, 'dev-panel-header')?.click(); // header click expands again
    expect(body.style.display).not.toBe('none');
    expect(query(panel.el, 'dev-panel-header')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('disables focused-tree actions when no tree is focused (fresh state)', () => {
    const panel = createDevPanel(noDeps());
    panel.update(stateWithTree({ focusedTreeId: undefined }));

    expect(query(panel.el, 'dev-skip-stage')?.disabled).toBe(true);
    expect(query(panel.el, 'dev-complete-task')?.disabled).toBe(true);
  });

  it('enables focused-tree actions when an active tree is focused', () => {
    const panel = createDevPanel(noDeps());
    panel.update(stateWithTree());

    expect(query(panel.el, 'dev-skip-stage')?.disabled).toBe(false);
    expect(query(panel.el, 'dev-complete-task')?.disabled).toBe(false);
  });

  it('disables focused-tree actions again once the focused tree completes', () => {
    const panel = createDevPanel(noDeps());
    const state = stateWithTree();
    panel.update(state);
    panel.update(advance(state, GOAL_TEMPLATES.sleep.tasks.length));

    expect(query(panel.el, 'dev-skip-stage')?.disabled).toBe(true);
    expect(query(panel.el, 'dev-complete-task')?.disabled).toBe(true);
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
