// Internal implementation. Deep imports from other modules are blocked by lint.
import { focusedTree } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import { DEV_TOOLS } from './dev-help-modal.ts';
import { ensureStyles } from './styles.ts';

export interface DevPanelDeps {
  onSkipStage: () => void;
  onCompleteTask: () => void;
  onUnlockSection: () => void;
  onHelp: () => void;
}

export interface DevPanel {
  el: HTMLElement;
  update(state: GameplayState): void;
  /** Consulted by the shell on every plant — replaces the modal's dev toggle. */
  isPlantGrownEnabled(): boolean;
  /** Flip the plant-fully-grown toggle (shortcut `3` and the row button). */
  togglePlantGrown(): void;
  /** Collapse/expand the panel body (shortcut `` ` ``). */
  toggleCollapsed(): void;
}

/**
 * Developer tools panel. Pure DOM overlay — reads state, pushes intent out
 * via callbacks, and never mutates game state itself. One row per `DEV_TOOLS`
 * entry (the same constant drives the help modal, so panel and help cannot
 * drift): shortcut chip + label + control. All DOM is built once; `update`
 * only toggles disabled flags, so repeated updates never duplicate nodes or
 * stack listeners. Collapsible: the header always shows, the rows hide.
 */
export function createDevPanel(deps: DevPanelDeps): DevPanel {
  ensureStyles();
  const el = document.createElement('section');
  el.className = 'dev-panel lg-panel';
  el.dataset['testid'] = 'dev-panel';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.gap = 'var(--lg-space-1)';

  let collapsed = false;
  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'lg-btn lg-btn--ghost';
  header.dataset['testid'] = 'dev-panel-header';

  const body = document.createElement('div');
  body.dataset['testid'] = 'dev-panel-body';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.gap = 'var(--lg-space-1)';

  function applyCollapsed(): void {
    header.textContent = `Dev tools ${collapsed ? '▸' : '▾'}`;
    header.setAttribute('aria-expanded', String(!collapsed));
    body.style.display = collapsed ? 'none' : 'flex';
  }
  function toggleCollapsed(): void {
    collapsed = !collapsed;
    applyCollapsed();
  }
  header.addEventListener('click', toggleCollapsed);
  applyCollapsed();
  el.append(header, body);

  /** One tool row: shortcut chip + label + its control button. */
  function row(key: string, control: HTMLButtonElement): void {
    const tool = DEV_TOOLS.find((candidate) => candidate.key === key)!;
    const line = document.createElement('div');
    line.style.display = 'flex';
    line.style.alignItems = 'center';
    line.style.gap = 'var(--lg-space-2)';
    const chip = document.createElement('span');
    chip.className = 'lg-chip';
    chip.textContent = tool.key;
    const label = document.createElement('span');
    label.textContent = tool.name;
    label.style.flex = '1';
    line.append(chip, label, control);
    body.appendChild(line);
  }

  function control(testid: string, text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lg-btn lg-btn--ghost';
    button.dataset['testid'] = testid;
    button.textContent = text;
    button.addEventListener('click', onClick);
    return button;
  }

  // Actions on the focused tree start disabled until an update says otherwise.
  const skip = control('dev-skip-stage', 'Run', deps.onSkipStage);
  skip.disabled = true;
  const complete = control('dev-complete-task', 'Run', deps.onCompleteTask);
  complete.disabled = true;

  let plantGrown = false;
  const grown = control('dev-plant-grown', 'Off', () => togglePlantGrown());
  function togglePlantGrown(): void {
    plantGrown = !plantGrown;
    grown.textContent = plantGrown ? 'On' : 'Off';
    grown.setAttribute('aria-pressed', String(plantGrown));
  }
  grown.setAttribute('aria-pressed', 'false');

  const unlock = control('dev-unlock-section', 'Run', deps.onUnlockSection);
  const help = control('dev-help', 'Open', deps.onHelp);

  row('1', skip);
  row('2', complete);
  row('3', grown);
  row('4', unlock);
  row('?', help);

  function update(state: GameplayState): void {
    const noFocus = focusedTree(state) === undefined;
    skip.disabled = noFocus;
    complete.disabled = noFocus;
  }

  return {
    el,
    update,
    isPlantGrownEnabled: () => plantGrown,
    togglePlantGrown,
    toggleCollapsed,
  };
}
