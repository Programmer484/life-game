// Internal implementation. Deep imports from other modules are blocked by lint.
import type { TaskDef } from '../../config/index.ts';
import { nextTaskIndex } from '../../entities/index.ts';
import { focusedTree } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import { ensureStyles } from './styles.ts';

export interface TasksPanelDeps {
  onCompleteTask: (treeId: string, taskIndex: number) => void;
}

export interface TasksPanel {
  el: HTMLElement;
  update(state: GameplayState): void;
}

/**
 * The immediate-tasks panel: always shows the FOCUSED tree's NEXT task only.
 * Pure DOM overlay — reads state, pushes intent out via `onCompleteTask`, and
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
  el.appendChild(body);

  function renderIdle(): void {
    const idle = document.createElement('p');
    idle.className = 'tasks-panel-idle';
    idle.dataset['testid'] = 'tasks-panel-idle';
    idle.textContent = 'No tree in focus. Plant or focus a tree to see its next task.';
    body.appendChild(idle);
  }

  function renderTask(treeId: string, goalName: string, taskIndex: number, task: TaskDef): void {
    const heading = document.createElement('h3');
    heading.className = 'goal-name';
    heading.dataset['testid'] = 'goal-name';
    heading.textContent = goalName;
    heading.style.margin = '0 0 var(--lg-space-2)';

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
    body.append(heading, row);
  }

  function update(state: GameplayState): void {
    // Re-render the body each call: replacing children drops the previous
    // checkbox and its listener, so updates never stack DOM or listeners.
    body.replaceChildren();

    const tree = focusedTree(state);
    if (!tree) {
      renderIdle();
      return;
    }
    const goal = state.goals[tree.goalId];
    const taskIndex = goal === undefined ? undefined : nextTaskIndex(goal);
    const task = goal === undefined || taskIndex === undefined ? undefined : goal.tasks[taskIndex];
    if (goal === undefined || taskIndex === undefined || task === undefined) {
      renderIdle();
      return;
    }
    renderTask(tree.id, goal.name, taskIndex, task);
  }

  return { el, update };
}
