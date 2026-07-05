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

/** Complete the first `count` tasks of the focused tree via the systems module. */
function advance(state: GameplayState, count: number): GameplayState {
  let next = state;
  for (let i = 0; i < count; i++) {
    next = { ...next, ...applyTaskCompleted(next, taskCompletedEvent(TREE_ID, i)) };
  }
  return next;
}

function query(el: HTMLElement, testid: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

describe('tasks panel', () => {
  it('shows the focused tree’s goal name, next task title, and estimated minutes', () => {
    const panel = createTasksPanel({ onCompleteTask: () => {} });
    panel.update(stateWithTree());

    const firstTask = GOAL_TEMPLATES.sleep.tasks[0]!;
    expect(panel.el.dataset['testid']).toBe('tasks-panel');
    expect(query(panel.el, 'goal-name')?.textContent).toBe(GOAL_TEMPLATES.sleep.name);
    expect(query(panel.el, 'next-task-title')?.textContent).toBe(firstTask.title);
    expect(query(panel.el, 'next-task-minutes')?.textContent).toContain(
      String(firstTask.estimatedMinutes),
    );
    const checkbox = query(panel.el, 'next-task-checkbox') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
  });

  it('calls onCompleteTask with the treeId and next task index when the checkbox is checked', () => {
    const onCompleteTask = vi.fn();
    const panel = createTasksPanel({ onCompleteTask });
    const state = advance(stateWithTree(), 2);
    panel.update(state);

    const checkbox = query(panel.el, 'next-task-checkbox') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    expect(onCompleteTask).toHaveBeenCalledTimes(1);
    expect(onCompleteTask).toHaveBeenCalledWith(TREE_ID, 2);
  });

  it('does not change the rendered task on its own after the checkbox is checked', () => {
    const panel = createTasksPanel({ onCompleteTask: () => {} });
    panel.update(stateWithTree());

    const checkbox = query(panel.el, 'next-task-checkbox') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    const firstTask = GOAL_TEMPLATES.sleep.tasks[0]!;
    expect(query(panel.el, 'next-task-title')?.textContent).toBe(firstTask.title);
  });

  it('shows the following task after update with the advanced state', () => {
    const panel = createTasksPanel({ onCompleteTask: () => {} });
    const state = stateWithTree();
    panel.update(state);
    panel.update(advance(state, 1));

    const secondTask = GOAL_TEMPLATES.sleep.tasks[1]!;
    expect(query(panel.el, 'next-task-title')?.textContent).toBe(secondTask.title);
    const checkbox = query(panel.el, 'next-task-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('shows the idle body when nothing is focused', () => {
    const panel = createTasksPanel({ onCompleteTask: () => {} });
    panel.update(stateWithTree({ focusedTreeId: undefined }));

    expect(query(panel.el, 'tasks-panel-idle')).not.toBeNull();
    expect(query(panel.el, 'next-task-checkbox')).toBeNull();
    expect(query(panel.el, 'next-task-title')).toBeNull();
  });

  it('shows the idle body when the focused tree id is unknown', () => {
    const panel = createTasksPanel({ onCompleteTask: () => {} });
    panel.update(stateWithTree({ focusedTreeId: 'no-such-tree' }));

    expect(query(panel.el, 'tasks-panel-idle')).not.toBeNull();
    expect(query(panel.el, 'next-task-checkbox')).toBeNull();
  });

  it('shows the idle body when the focused tree has completed', () => {
    const panel = createTasksPanel({ onCompleteTask: () => {} });
    const state = advance(stateWithTree(), GOAL_TEMPLATES.sleep.tasks.length);
    panel.update(state);

    expect(query(panel.el, 'tasks-panel-idle')).not.toBeNull();
    expect(query(panel.el, 'next-task-checkbox')).toBeNull();
  });

  it('does not duplicate DOM nodes or stack listeners across repeated updates', () => {
    const onCompleteTask = vi.fn();
    const panel = createTasksPanel({ onCompleteTask });
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
