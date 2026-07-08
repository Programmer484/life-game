// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { GOAL_TEMPLATES, STAGE_TASKS, TASKS_PER_TREE } from '../../config/index.ts';
import type { GoalTemplate } from '../../config/index.ts';
import { createTaskEditor } from '../internal/task-editor.ts';

function draft(): GoalTemplate {
  return {
    name: GOAL_TEMPLATES.sleep.name,
    tasks: GOAL_TEMPLATES.sleep.tasks.map((task) => ({ ...task })),
  };
}

function queryAll(el: HTMLElement, testid: string): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)];
}

function query(el: HTMLElement, testid: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

function setValue(input: HTMLElement, value: string): void {
  (input as HTMLInputElement).value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ui / task editor', () => {
  it('renders 18 rows under four stage headers and starts valid', () => {
    const editor = createTaskEditor({ draft: draft() });
    expect(queryAll(editor.el, 'task-row')).toHaveLength(TASKS_PER_TREE);
    const headers = queryAll(editor.el, 'stage-header');
    expect(headers).toHaveLength(STAGE_TASKS.length);
    expect(headers[0]!.textContent).toBe('Stage 1 · 3 tasks');
    expect(editor.isValid()).toBe(true);
    expect(editor.value().tasks).toHaveLength(TASKS_PER_TREE);
  });

  it('marks an empty title invalid and disables validity, then recovers', () => {
    const onChange = vi.fn();
    const editor = createTaskEditor({ draft: draft(), onChange });
    const title = queryAll(editor.el, 'task-title')[0] as HTMLInputElement;
    setValue(title, '   ');
    expect(onChange).toHaveBeenCalled();
    expect(title.classList.contains('lg-input--error')).toBe(true);
    expect(editor.isValid()).toBe(false);
    setValue(title, 'A real task');
    expect(editor.isValid()).toBe(true);
    expect(editor.value().tasks[0]!.title).toBe('A real task');
  });

  it('marks out-of-range minutes invalid', () => {
    const editor = createTaskEditor({ draft: draft() });
    const minutes = queryAll(editor.el, 'task-minutes')[0] as HTMLInputElement;
    setValue(minutes, '500');
    expect(minutes.classList.contains('lg-input--error')).toBe(true);
    expect(editor.isValid()).toBe(false);
    setValue(minutes, '30');
    expect(editor.isValid()).toBe(true);
    expect(editor.value().tasks[0]!.estimatedMinutes).toBe(30);
  });

  it('reorders a task down and back up, changing value() order', () => {
    const editor = createTaskEditor({ draft: draft() });
    const first = editor.value().tasks[0]!.title;
    const second = editor.value().tasks[1]!.title;

    query(queryAll(editor.el, 'task-row')[0]!, 'task-down')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(editor.value().tasks[0]!.title).toBe(second);
    expect(editor.value().tasks[1]!.title).toBe(first);

    query(queryAll(editor.el, 'task-row')[1]!, 'task-up')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(editor.value().tasks[0]!.title).toBe(first);
  });

  it('locks the first lockedUpTo rows: read-only, checked, no reorder buttons', () => {
    const editor = createTaskEditor({ draft: draft(), lockedUpTo: 2 });
    const rows = queryAll(editor.el, 'task-row');
    expect(rows[0]!.dataset['locked']).toBe('true');
    expect((query(rows[0]!, 'task-title') as HTMLInputElement).disabled).toBe(true);
    expect(query(rows[0]!, 'task-locked')).not.toBeNull();
    expect(query(rows[0]!, 'task-up')).toBeNull();
    // The first UNLOCKED row cannot move up into the locked prefix.
    expect((query(rows[2]!, 'task-up') as HTMLButtonElement).disabled).toBe(true);
    // Reordering an unlocked row down still works and keeps the locked prefix.
    const lockedTitles = [rows[0], rows[1]].map(
      (r) => (query(r!, 'task-title') as HTMLInputElement).value,
    );
    query(rows[2]!, 'task-down')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(
      editor
        .value()
        .tasks.slice(0, 2)
        .map((t) => t.title),
    ).toEqual(lockedTitles);
  });
});
