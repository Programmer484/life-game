// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { GOAL_TEMPLATES } from '../../config/index.ts';
import { createGoal, createTree, taskCompletedEvent } from '../../entities/index.ts';
import { applyTaskCompleted } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import { createWorld } from '../../world/index.ts';
import { createTasksPanel } from '../index.ts';

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

/** A state with three planted trees (tree-1..3), tree-1 focused by default. */
function stateWithThreeTrees(overrides: Partial<GameplayState> = {}): GameplayState {
  const keys = Object.keys(GOAL_TEMPLATES) as (keyof typeof GOAL_TEMPLATES)[];
  const goals: Record<string, ReturnType<typeof createGoal>> = {};
  const trees = [1, 2, 3].map((n) => {
    const goal = createGoal(`goal-${String(n)}`, GOAL_TEMPLATES[keys[(n - 1) % keys.length]!]);
    goals[goal.id] = goal;
    return createTree(`tree-${String(n)}`, { x: n, y: n }, 'A', goal.id);
  });
  return { trees, goals, world: createWorld(), focusedTreeId: TREE_ID, ...overrides };
}

/** Complete the first `count` tasks of `treeId` via the systems module. */
function advance(state: GameplayState, count: number, treeId = TREE_ID): GameplayState {
  let next = state;
  for (let i = 0; i < count; i++) {
    next = { ...next, ...applyTaskCompleted(next, taskCompletedEvent(treeId, i)) };
  }
  return next;
}

function query(el: HTMLElement, testid: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

function queryAll(el: HTMLElement, testid: string): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)];
}

const noDeps = {
  onCompleteTask: (): void => {},
  onFocusTree: (): void => {},
  onEditGoal: (): void => {},
};

describe('tasks panel', () => {
  it('shows the focused tree’s goal name, next task title, and estimated minutes', () => {
    const panel = createTasksPanel(noDeps);
    panel.update(stateWithTree());

    const firstTask = GOAL_TEMPLATES.sleep.tasks[0]!;
    expect(panel.el.dataset['testid']).toBe('tasks-panel');
    expect(query(panel.el, 'goal-name')?.textContent).toContain(GOAL_TEMPLATES.sleep.name);
    expect(query(panel.el, 'next-task-title')?.textContent).toBe(firstTask.title);
    expect(query(panel.el, 'next-task-minutes')?.textContent).toContain(
      String(firstTask.estimatedMinutes),
    );
    const checkbox = query(panel.el, 'next-task-checkbox') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
  });

  it('renders one card per active tree, focused first then plant order', () => {
    const panel = createTasksPanel(noDeps);
    panel.update(stateWithThreeTrees({ focusedTreeId: 'tree-2' }));

    const cards = queryAll(panel.el, 'task-card');
    expect(cards.map((card) => card.dataset['treeId'])).toEqual(['tree-2', 'tree-1', 'tree-3']);
    expect(cards[0]!.dataset['focused']).toBe('true');
    expect(cards[0]!.className).toContain('lg-task-card--focused');
    expect(cards[1]!.className).not.toContain('lg-task-card--focused');
  });

  it('shows per-card progress text and a proportional bar fill', () => {
    const panel = createTasksPanel(noDeps);
    const state = advance(stateWithTree(), 2);
    panel.update(state);

    const total = GOAL_TEMPLATES.sleep.tasks.length;
    expect(query(panel.el, 'goal-progress')?.textContent).toBe(`2/${String(total)}`);
    const fill = panel.el.querySelector<HTMLElement>('.lg-bar__fill')!;
    expect(fill.style.width).toBe(`${String((2 / total) * 100)}%`);
  });

  it('excludes completed trees and calls onCompleteTask with the card’s tree', () => {
    const onCompleteTask = vi.fn();
    const panel = createTasksPanel({ ...noDeps, onCompleteTask });
    let state = stateWithThreeTrees();
    state = advance(state, GOAL_TEMPLATES.sleep.tasks.length, 'tree-1'); // tree-1 done
    state = advance(state, 2, 'tree-2');
    panel.update({ ...state, focusedTreeId: undefined });

    const cards = queryAll(panel.el, 'task-card');
    expect(cards.map((card) => card.dataset['treeId'])).toEqual(['tree-2', 'tree-3']);

    const checkbox = query(cards[0]!, 'next-task-checkbox') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onCompleteTask).toHaveBeenCalledTimes(1);
    expect(onCompleteTask).toHaveBeenCalledWith('tree-2', 2);
  });

  it('clicking a non-focused card calls onFocusTree; the focused card does not', () => {
    const onFocusTree = vi.fn();
    const panel = createTasksPanel({ ...noDeps, onFocusTree });
    panel.update(stateWithThreeTrees());

    const cards = queryAll(panel.el, 'task-card');
    cards[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onFocusTree).toHaveBeenCalledTimes(1);
    expect(onFocusTree).toHaveBeenCalledWith('tree-2');

    cards[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onFocusTree).toHaveBeenCalledTimes(1);
  });

  it('each card has an Edit tasks button that calls onEditGoal with the goal id, not focus', () => {
    const onEditGoal = vi.fn();
    const onFocusTree = vi.fn();
    const panel = createTasksPanel({ ...noDeps, onEditGoal, onFocusTree });
    panel.update(stateWithThreeTrees({ focusedTreeId: 'tree-2' }));

    const cards = queryAll(panel.el, 'task-card');
    const edit = query(cards[1]!, 'edit-goal'); // a non-focused card
    edit!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onEditGoal).toHaveBeenCalledTimes(1);
    expect(onEditGoal).toHaveBeenCalledWith('goal-1');
    expect(onFocusTree).not.toHaveBeenCalled();
  });

  it('checking a non-focused card’s checkbox completes without stealing focus', () => {
    const onCompleteTask = vi.fn();
    const onFocusTree = vi.fn();
    const panel = createTasksPanel({ onCompleteTask, onFocusTree, onEditGoal: () => {} });
    panel.update(stateWithThreeTrees());

    const cards = queryAll(panel.el, 'task-card');
    const checkbox = query(cards[1]!, 'next-task-checkbox') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onCompleteTask).toHaveBeenCalledWith('tree-2', 0);
    expect(onFocusTree).not.toHaveBeenCalled();
  });

  it('does not change the rendered task on its own after the checkbox is checked', () => {
    const panel = createTasksPanel(noDeps);
    panel.update(stateWithTree());

    const checkbox = query(panel.el, 'next-task-checkbox') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    const firstTask = GOAL_TEMPLATES.sleep.tasks[0]!;
    expect(query(panel.el, 'next-task-title')?.textContent).toBe(firstTask.title);
  });

  it('shows the following task after update with the advanced state', () => {
    const panel = createTasksPanel(noDeps);
    const state = stateWithTree();
    panel.update(state);
    panel.update(advance(state, 1));

    const secondTask = GOAL_TEMPLATES.sleep.tasks[1]!;
    expect(query(panel.el, 'next-task-title')?.textContent).toBe(secondTask.title);
    const checkbox = query(panel.el, 'next-task-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('still lists active trees when nothing is focused', () => {
    const panel = createTasksPanel(noDeps);
    panel.update(stateWithTree({ focusedTreeId: undefined }));

    expect(queryAll(panel.el, 'task-card')).toHaveLength(1);
    expect(query(panel.el, 'tasks-panel-idle')).toBeNull();
  });

  it('shows the idle body when there are no trees', () => {
    const panel = createTasksPanel(noDeps);
    panel.update(stateWithTree({ trees: [], focusedTreeId: undefined }));

    expect(query(panel.el, 'tasks-panel-idle')).not.toBeNull();
    expect(query(panel.el, 'next-task-checkbox')).toBeNull();
  });

  it('shows the idle body when every tree has completed', () => {
    const panel = createTasksPanel(noDeps);
    const state = advance(stateWithTree(), GOAL_TEMPLATES.sleep.tasks.length);
    panel.update(state);

    expect(query(panel.el, 'tasks-panel-idle')).not.toBeNull();
    expect(query(panel.el, 'next-task-checkbox')).toBeNull();
  });

  it('does not duplicate DOM nodes or stack listeners across repeated updates', () => {
    const onCompleteTask = vi.fn();
    const panel = createTasksPanel({ ...noDeps, onCompleteTask });
    const state = stateWithTree();
    panel.update(state);
    panel.update(state);
    panel.update(state);

    expect(panel.el.querySelectorAll('[data-testid="next-task-title"]')).toHaveLength(1);
    expect(panel.el.querySelectorAll('[data-testid="next-task-checkbox"]')).toHaveLength(1);

    const checkbox = query(panel.el, 'next-task-checkbox') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(onCompleteTask).toHaveBeenCalledTimes(1);
  });
});
