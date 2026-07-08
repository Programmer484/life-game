// Internal implementation. Deep imports from other modules are blocked by lint.
import type { TaskDef, Tree } from '../../config/index.ts';
import { nextTaskIndex, tasksDone } from '../../entities/index.ts';
import { activeTrees } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import { ensureStyles } from './styles.ts';

export interface TasksPanelDeps {
  onCompleteTask: (treeId: string, taskIndex: number) => void;
  onFocusTree: (treeId: string) => void;
}

export interface TasksPanel {
  el: HTMLElement;
  update(state: GameplayState): void;
}

/**
 * The task list: one card per ACTIVE tree (focused first, then plant order),
 * each showing the goal, its progress, and the next task. Pure DOM overlay —
 * reads state, pushes intent out via `onCompleteTask` / `onFocusTree`, and
 * never mutates game state itself; it waits for the next `update(state)`.
 */
export function createTasksPanel(deps: TasksPanelDeps): TasksPanel {
  ensureStyles();
  const el = document.createElement('section');
  el.className = 'tasks-panel lg-panel';
  el.dataset['testid'] = 'tasks-panel';

  const body = document.createElement('div');
  body.className = 'tasks-panel-body';
  body.dataset['testid'] = 'tasks-panel-body';
  body.style.maxHeight = '60vh';
  body.style.overflowY = 'auto';
  el.appendChild(body);

  function renderIdle(): void {
    const idle = document.createElement('p');
    idle.className = 'tasks-panel-idle';
    idle.dataset['testid'] = 'tasks-panel-idle';
    idle.textContent = 'Plant a tree to get your first task.';
    body.appendChild(idle);
  }

  function renderTaskRow(treeId: string, taskIndex: number, task: TaskDef): HTMLElement {
    const row = document.createElement('label');
    row.className = 'next-task';
    row.dataset['testid'] = 'next-task';
    row.style.display = 'flex';
    row.style.gap = '0.5em';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'next-task-checkbox';
    checkbox.dataset['testid'] = 'next-task-checkbox';
    checkbox.checked = false;
    checkbox.addEventListener('change', () => {
      deps.onCompleteTask(treeId, taskIndex);
    });

    const title = document.createElement('span');
    title.className = 'next-task-title';
    title.dataset['testid'] = 'next-task-title';
    title.textContent = task.title;

    const minutes = document.createElement('span');
    minutes.className = 'next-task-minutes';
    minutes.dataset['testid'] = 'next-task-minutes';
    minutes.textContent = `~${String(task.estimatedMinutes)} min`;

    row.append(checkbox, title, minutes);
    return row;
  }

  function renderCard(state: GameplayState, tree: Tree, focused: boolean): void {
    const goal = state.goals[tree.goalId];
    if (goal === undefined) return;
    const taskIndex = nextTaskIndex(goal);
    const task = taskIndex === undefined ? undefined : goal.tasks[taskIndex];
    if (taskIndex === undefined || task === undefined) return;

    const card = document.createElement('article');
    card.className = focused ? 'lg-task-card lg-task-card--focused' : 'lg-task-card';
    card.dataset['testid'] = 'task-card';
    card.dataset['treeId'] = tree.id;
    if (focused) card.dataset['focused'] = 'true';

    const heading = document.createElement('h3');
    heading.className = 'goal-name';
    heading.dataset['testid'] = 'goal-name';
    heading.textContent = goal.name;
    heading.style.margin = '0 0 var(--lg-space-1)';
    heading.style.fontSize = '14px';

    const progress = document.createElement('span');
    progress.className = 'goal-progress';
    progress.dataset['testid'] = 'goal-progress';
    progress.textContent = `${String(tasksDone(goal))}/${String(goal.tasks.length)}`;
    progress.style.marginLeft = 'var(--lg-space-2)';
    progress.style.fontSize = '12px';
    progress.style.opacity = '0.7';
    heading.appendChild(progress);

    const bar = document.createElement('div');
    bar.className = 'lg-bar';
    bar.style.height = '4px';
    bar.style.marginBottom = 'var(--lg-space-2)';
    const fill = document.createElement('div');
    fill.className = 'lg-bar__fill';
    fill.style.width = `${String((tasksDone(goal) / goal.tasks.length) * 100)}%`;
    bar.appendChild(fill);

    card.append(heading, bar, renderTaskRow(tree.id, taskIndex, task));

    if (!focused) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', (event) => {
        // The checkbox completes the task; don't also steal focus from it.
        if (event.target instanceof HTMLInputElement) return;
        deps.onFocusTree(tree.id);
      });
    }
    body.appendChild(card);
  }

  function update(state: GameplayState): void {
    // Re-render the body each call: replacing children drops the previous
    // checkboxes and their listeners, so updates never stack DOM or listeners.
    body.replaceChildren();

    const active = activeTrees(state.trees);
    if (active.length === 0) {
      renderIdle();
      return;
    }
    // Focused card first; the rest keep plant order (state.trees order).
    const ordered = [
      ...active.filter((tree) => tree.id === state.focusedTreeId),
      ...active.filter((tree) => tree.id !== state.focusedTreeId),
    ];
    for (const tree of ordered) renderCard(state, tree, tree.id === state.focusedTreeId);
    if (body.childElementCount === 0) renderIdle();
  }

  return { el, update };
}
