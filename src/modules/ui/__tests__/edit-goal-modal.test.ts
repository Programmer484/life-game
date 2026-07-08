// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { GOAL_TEMPLATES } from '../../config/index.ts';
import type { Goal } from '../../config/index.ts';
import { completeNextTask, createGoal } from '../../entities/index.ts';
import { createEditGoalModal } from '../index.ts';

function goalWithDone(n: number): Goal {
  let goal = createGoal('goal-1', GOAL_TEMPLATES.sleep);
  for (let i = 0; i < n; i++) goal = completeNextTask(goal);
  return goal;
}

function query(el: HTMLElement, testid: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

function queryAll(el: HTMLElement, testid: string): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)];
}

function click(el: HTMLElement | null): void {
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('ui / edit-goal modal', () => {
  it('is hidden initially and opens with the editor locked up to the done count', () => {
    const modal = createEditGoalModal({ onSave: () => {} });
    expect(modal.el.style.display).toBe('none');
    expect(modal.isOpen()).toBe(false);

    modal.open(goalWithDone(3));
    expect(modal.isOpen()).toBe(true);
    expect(query(modal.el, 'task-editor')).not.toBeNull();
    const locked = queryAll(modal.el, 'task-row').filter((row) => row.dataset['locked'] === 'true');
    expect(locked).toHaveLength(3);
  });

  it('Save reports the edited name + task list for the goal id, then closes', () => {
    const onSave = vi.fn<(id: string, name: string, tasks: unknown[]) => void>();
    const modal = createEditGoalModal({ onSave });
    modal.open(goalWithDone(2));

    const name = query(modal.el, 'goal-name-input') as HTMLInputElement;
    name.value = 'Renamed goal';
    name.dispatchEvent(new Event('input', { bubbles: true }));

    const title = queryAll(modal.el, 'task-title')[5] as HTMLInputElement;
    title.value = 'reworked task';
    title.dispatchEvent(new Event('input', { bubbles: true }));

    click(query(modal.el, 'goal-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const [id, savedName, tasks] = onSave.mock.calls[0]!;
    expect(id).toBe('goal-1');
    expect(savedName).toBe('Renamed goal');
    expect(tasks).toHaveLength(18);
    expect((tasks[5] as { title: string }).title).toBe('reworked task');
    expect(modal.isOpen()).toBe(false);
  });

  it('Cancel closes without saving when the draft is untouched', () => {
    const onSave = vi.fn();
    const modal = createEditGoalModal({ onSave });
    modal.open(goalWithDone(0));
    click(query(modal.el, 'modal-cancel'));
    expect(onSave).not.toHaveBeenCalled();
    expect(modal.isOpen()).toBe(false);
  });

  it('re-opening rebuilds the editor without stacking DOM', () => {
    const modal = createEditGoalModal({ onSave: () => {} });
    modal.open(goalWithDone(1));
    modal.close();
    modal.open(goalWithDone(1));
    expect(modal.el.querySelectorAll('[data-testid="task-editor"]')).toHaveLength(1);
  });
});
