// Internal implementation. Deep imports from other modules are blocked by lint.
import { ensureStyles } from './styles.ts';

/** One dev tool's help entry: keyboard shortcut, name, what it mutates. */
interface DevToolInfo {
  key: string;
  name: string;
  desc: string;
}

/**
 * The single source of truth for dev-tool content: this array drives BOTH the
 * dev panel's rows and the help modal's list, so they can never drift.
 * `docs/DEV-TOOLS.md` mirrors it by hand — update both together.
 */
export const DEV_TOOLS: readonly DevToolInfo[] = [
  {
    key: '1',
    name: 'Skip stage',
    desc: "Completes the focused tree's remaining tasks in its current growth stage.",
  },
  {
    key: '2',
    name: 'Complete next task',
    desc: "Completes the focused tree's next task, as if checked off in the tasks panel.",
  },
  {
    key: '3',
    name: 'Plant fully grown',
    desc: 'Toggle: while on, every subsequent plant is created with all tasks completed.',
  },
  {
    key: '4',
    name: 'Unlock next section',
    desc: 'Unlocks the cheapest locked island section immediately, ignoring its cost.',
  },
  { key: '?', name: 'Help', desc: 'Opens this help modal.' },
];

const DEV_MODE_NOTE =
  'Dev mode is on in dev builds, or after visiting with ?dev=1 in the URL ' +
  '(persisted across reloads); ?dev=0 turns the persisted flag off. ' +
  'Press ` (backtick) to collapse or expand the dev panel.';

export interface DevHelpModal {
  el: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
}

/**
 * The dev-tools help modal: one row per `DEV_TOOLS` entry (shortcut, name,
 * description) plus the dev-mode enable/disable note. Pure DOM, built once at
 * creation; open/close only toggle visibility.
 */
export function createDevHelpModal(): DevHelpModal {
  ensureStyles();
  const el = document.createElement('div');
  el.className = 'dev-help-modal lg-modal lg-prose';
  el.dataset['testid'] = 'dev-help-modal';
  el.style.display = 'none';

  const title = document.createElement('h2');
  title.textContent = 'Dev tools';
  el.appendChild(title);

  const list = document.createElement('dl');
  for (const tool of DEV_TOOLS) {
    const term = document.createElement('dt');
    const chip = document.createElement('span');
    chip.className = 'lg-chip';
    chip.textContent = tool.key;
    term.append(chip, ` ${tool.name}`);
    const detail = document.createElement('dd');
    detail.textContent = tool.desc;
    list.append(term, detail);
  }
  el.appendChild(list);

  const note = document.createElement('p');
  note.dataset['testid'] = 'dev-help-mode-note';
  note.textContent = DEV_MODE_NOTE;
  el.appendChild(note);

  let openState = false;
  const close = (): void => {
    openState = false;
    el.style.display = 'none';
  };

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'lg-btn lg-btn--ghost';
  closeButton.dataset['testid'] = 'dev-help-close';
  closeButton.textContent = 'Close';
  closeButton.addEventListener('click', close);
  el.appendChild(closeButton);

  return {
    el,
    open() {
      openState = true;
      el.style.display = 'block';
    },
    close,
    isOpen: () => openState,
  };
}
