// Internal implementation. Deep imports from other modules are blocked by lint.
import { STAGE_TASKS, TASK_MINUTES_MAX, TASK_MINUTES_MIN } from '../../config/index.ts';
import type { GoalTemplate, TaskDef } from '../../config/index.ts';
import { ensureStyles } from './styles.ts';

interface TaskEditorDeps {
  /** Initial goal name + its 18 tasks. Copied in; never mutated. */
  draft: GoalTemplate;
  /** Rows [0, lockedUpTo) render read-only with a check (done tasks). */
  lockedUpTo?: number;
  /** Fired after any user edit or reorder. */
  onChange?: () => void;
}

export interface TaskEditor {
  el: HTMLElement;
  /** Current name + tasks (fresh copies). */
  value(): GoalTemplate;
  /** True when the name and every task title/minutes are valid. */
  isValid(): boolean;
}

function titleValid(title: string): boolean {
  return title.trim() !== '';
}

function minutesValid(minutes: number): boolean {
  return Number.isFinite(minutes) && minutes >= TASK_MINUTES_MIN && minutes <= TASK_MINUTES_MAX;
}

/**
 * The reusable 18-task editor: an editable goal-name field plus rows grouped
 * under stage headers (3 · 4 · 5 · 6 per STAGE_TASKS). Each row edits a title
 * and minutes and can move up/down within the whole list; the count is fixed
 * at 18 (no add/delete). The first `lockedUpTo` rows are read-only (completed
 * tasks) and cannot be edited, moved, or moved into. Invalid rows get the
 * `.lg-input--error` state; `isValid()` drives the host's Continue/Save.
 */
export function createTaskEditor(deps: TaskEditorDeps): TaskEditor {
  ensureStyles();
  const lockedUpTo = Math.max(0, Math.min(deps.lockedUpTo ?? 0, deps.draft.tasks.length));
  // Working copy — the source of truth for value()/reorder; never aliases input.
  const tasks: TaskDef[] = deps.draft.tasks.map((task) => ({ ...task }));
  let name = deps.draft.name;

  const el = document.createElement('div');
  el.className = 'lg-editor';
  el.dataset['testid'] = 'task-editor';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'lg-input';
  nameInput.dataset['testid'] = 'goal-name-input';
  nameInput.placeholder = 'Goal name';
  nameInput.value = name;

  const rows = document.createElement('div');

  function changed(): void {
    deps.onChange?.();
  }

  nameInput.addEventListener('input', () => {
    name = nameInput.value;
    nameInput.classList.toggle('lg-input--error', !titleValid(name));
    changed();
  });

  /** Swap two rows if both lie in the editable region, then re-render. */
  function move(from: number, to: number): void {
    if (to < lockedUpTo || to < 0 || to >= tasks.length) return;
    if (from < lockedUpTo) return;
    const a = tasks[from];
    const b = tasks[to];
    if (a === undefined || b === undefined) return;
    tasks[from] = b;
    tasks[to] = a;
    render();
    changed();
  }

  function renderRow(index: number): HTMLElement {
    const task = tasks[index]!;
    const locked = index < lockedUpTo;
    const row = document.createElement('div');
    row.className = 'lg-editor__row';
    row.dataset['testid'] = 'task-row';
    if (locked) row.dataset['locked'] = 'true';

    const idx = document.createElement('span');
    idx.className = 'lg-editor__index';
    idx.textContent = String(index + 1);

    const title = document.createElement('input');
    title.type = 'text';
    title.className = 'lg-input lg-editor__title';
    title.dataset['testid'] = 'task-title';
    title.value = task.title;
    title.disabled = locked;
    if (!titleValid(task.title)) title.classList.add('lg-input--error');
    title.addEventListener('input', () => {
      task.title = title.value;
      title.classList.toggle('lg-input--error', !titleValid(task.title));
      changed();
    });

    const minutes = document.createElement('input');
    minutes.type = 'number';
    minutes.className = 'lg-input lg-editor__minutes';
    minutes.dataset['testid'] = 'task-minutes';
    minutes.min = String(TASK_MINUTES_MIN);
    minutes.max = String(TASK_MINUTES_MAX);
    minutes.value = String(task.estimatedMinutes);
    minutes.disabled = locked;
    if (!minutesValid(task.estimatedMinutes)) minutes.classList.add('lg-input--error');
    minutes.addEventListener('input', () => {
      task.estimatedMinutes = minutes.value === '' ? Number.NaN : Number(minutes.value);
      minutes.classList.toggle('lg-input--error', !minutesValid(task.estimatedMinutes));
      changed();
    });

    row.append(idx, title, minutes);

    if (locked) {
      const check = document.createElement('span');
      check.className = 'lg-editor__lock';
      check.dataset['testid'] = 'task-locked';
      check.textContent = '✓';
      row.appendChild(check);
    } else {
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'lg-btn lg-btn--ghost';
      up.dataset['testid'] = 'task-up';
      up.textContent = '↑';
      up.disabled = index <= lockedUpTo;
      up.addEventListener('click', () => {
        move(index, index - 1);
      });

      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'lg-btn lg-btn--ghost';
      down.dataset['testid'] = 'task-down';
      down.textContent = '↓';
      down.disabled = index >= tasks.length - 1;
      down.addEventListener('click', () => {
        move(index, index + 1);
      });

      row.append(up, down);
    }
    return row;
  }

  function render(): void {
    rows.replaceChildren();
    let cursor = 0;
    STAGE_TASKS.forEach((count, stage) => {
      const header = document.createElement('div');
      header.className = 'lg-editor__stage';
      header.dataset['testid'] = 'stage-header';
      header.textContent = `Stage ${String(stage + 1)} · ${String(count)} tasks`;
      rows.appendChild(header);
      for (let i = 0; i < count && cursor < tasks.length; i++, cursor++) {
        rows.appendChild(renderRow(cursor));
      }
    });
  }

  render();
  el.append(nameInput, rows);

  return {
    el,
    value: () => ({ name, tasks: tasks.map((task) => ({ ...task })) }),
    isValid: () =>
      titleValid(name) &&
      tasks.every((task) => titleValid(task.title) && minutesValid(task.estimatedMinutes)),
  };
}
