// Internal implementation. Deep imports from other modules are blocked by lint.
import type { Goal, TaskDef } from '../../config/index.ts';
import { tasksDone } from '../../entities/index.ts';
import { ensureStyles } from './styles.ts';
import { createTaskEditor } from './task-editor.ts';
import type { TaskEditor } from './task-editor.ts';

export interface EditGoalModalDeps {
  /** Report the edited name + task list for an existing goal; host applies + toasts. */
  onSave: (goalId: string, name: string, tasks: TaskDef[]) => void;
}

export interface EditGoalModal {
  el: HTMLElement;
  open(goal: Goal): void;
  close(): void;
  isOpen(): boolean;
}

function button(testid: string, label: string, variant?: 'primary' | 'ghost'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = variant === undefined ? 'lg-btn' : `lg-btn lg-btn--${variant}`;
  b.dataset['testid'] = testid;
  b.textContent = label;
  return b;
}

/**
 * Edit an already-planted tree's goal: the same task editor as the planting
 * wizard, but with the completed prefix locked (read-only) since history is
 * immutable. Save reports the edited name + full 18-task list via `onSave`; the host applies
 * it through `game.updateGoalTasks` and surfaces any rejection as a toast.
 */
export function createEditGoalModal(deps: EditGoalModalDeps): EditGoalModal {
  ensureStyles();
  const el = document.createElement('div');
  el.className = 'edit-goal-modal lg-modal';
  el.dataset['testid'] = 'edit-goal-modal';
  el.style.display = 'none';

  const body = document.createElement('div');
  el.appendChild(body);

  let openGoalId: string | undefined;
  let editor: TaskEditor | undefined;
  let dirty = false;

  function close(): void {
    el.style.display = 'none';
    openGoalId = undefined;
    editor = undefined;
    dirty = false;
    body.replaceChildren();
  }

  function attemptClose(): void {
    if (dirty && !window.confirm('Discard your goal edits?')) return;
    close();
  }

  function open(goal: Goal): void {
    openGoalId = goal.id;
    dirty = false;
    editor = createTaskEditor({
      draft: {
        name: goal.name,
        tasks: goal.tasks.map((task) => ({
          title: task.title,
          estimatedMinutes: task.estimatedMinutes,
        })),
      },
      lockedUpTo: tasksDone(goal),
      onChange: () => {
        dirty = true;
        save.disabled = !editor?.isValid();
      },
    });

    const cancel = button('modal-cancel', 'Cancel', 'ghost');
    cancel.addEventListener('click', attemptClose);
    const save = button('goal-save', 'Save', 'primary');
    save.disabled = !editor.isValid();
    save.addEventListener('click', () => {
      if (openGoalId === undefined || !editor?.isValid()) return;
      const goalId = openGoalId;
      const { name, tasks } = editor.value();
      close();
      deps.onSave(goalId, name, tasks);
    });

    const footer = document.createElement('div');
    footer.className = 'lg-footer';
    const filler = document.createElement('div');
    filler.className = 'lg-footer__spacer';
    footer.append(cancel, filler, save);

    body.replaceChildren(editor.el, footer);
    el.style.display = 'block';
  }

  el.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      attemptClose();
    }
  });

  return { el, open, close, isOpen: () => openGoalId !== undefined };
}
