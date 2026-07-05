// Internal implementation. Deep imports from other modules are blocked by lint.
import { GOAL_TEMPLATES } from '../../config/index.ts';
import type { TileCoord, TreeType } from '../../config/index.ts';
import { availableTreeTypes } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import type { ChatPanel, ChatSession } from './chat-panel.ts';
import { createChatPanel } from './chat-panel.ts';
import { ensureStyles } from './styles.ts';

export interface PlantChoice {
  tile: TileCoord;
  templateKey: 'sleep' | 'workout';
  type: TreeType;
  /** Dev shortcut: plant the tree already fully grown. */
  grown: boolean;
}

export interface PlantingModalDeps {
  onPlant: (choice: PlantChoice) => void;
  /** Fresh goal-setting conversation per open; absent = no API key configured. */
  createGoalChat?: () => ChatSession;
}

export interface PlantingModal {
  el: HTMLElement;
  open(state: GameplayState, tile: TileCoord): void;
  close(): void;
  isOpen(): boolean;
}

function button(testid: string, label: string, variant?: 'primary' | 'ghost'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = variant === undefined ? 'lg-btn' : `lg-btn lg-btn--${variant}`;
  b.dataset['testid'] = testid;
  b.textContent = label;
  b.style.margin = '2px';
  return b;
}

/**
 * The planting modal: a goal-setting chat plus an Autofill button that
 * reveals the two goal templates from config. Each open starts a fresh chat
 * (or the offline notice without a session factory). Choosing a template
 * reports the intent via `onPlant` (tile + template key + selected tree
 * type) and closes — the modal never creates goals or mutates state itself.
 * All DOM is built once at creation; `open` only resets it, so repeated
 * opens never stack nodes or listeners.
 */
export function createPlantingModal(deps: PlantingModalDeps): PlantingModal {
  ensureStyles();
  const el = document.createElement('div');
  el.className = 'planting-modal lg-modal';
  el.dataset['testid'] = 'planting-modal';
  el.style.display = 'none';

  const panel: ChatPanel = createChatPanel();
  el.appendChild(panel.el);

  // Tree-type selector: A always offered; B only when the state unlocks it.
  const typeRow = document.createElement('div');
  const typeA = button('tree-type-a', 'Tree A', 'ghost');
  const typeB = button('tree-type-b', 'Tree B', 'ghost'); // attached only when offered
  typeRow.append(typeA);
  el.appendChild(typeRow);

  let selectedType: TreeType = 'A';
  function selectType(type: TreeType): void {
    selectedType = type;
    typeA.setAttribute('aria-pressed', String(type === 'A'));
    typeB.setAttribute('aria-pressed', String(type === 'B'));
  }
  typeA.addEventListener('click', () => selectType('A'));
  typeB.addEventListener('click', () => selectType('B'));

  // Dev shortcut: when toggled on, the chosen plant is created fully grown.
  const grownToggle = button('plant-grown-toggle', 'Fully grown (dev)');
  el.appendChild(grownToggle);

  let plantGrown = false;
  function setGrown(value: boolean): void {
    plantGrown = value;
    grownToggle.setAttribute('aria-pressed', String(value));
  }
  grownToggle.addEventListener('click', () => setGrown(!plantGrown));

  const autofill = button('autofill', 'Autofill', 'primary');
  el.appendChild(autofill);

  // Template options live here; emptied on every open/close, filled by Autofill.
  const templates = document.createElement('div');
  el.appendChild(templates);

  let openTile: TileCoord | undefined;

  function close(): void {
    el.style.display = 'none';
    openTile = undefined;
    templates.replaceChildren();
  }

  function pick(templateKey: 'sleep' | 'workout'): void {
    const tile = openTile!;
    close();
    deps.onPlant({ tile, templateKey, type: selectedType, grown: plantGrown });
  }

  autofill.addEventListener('click', () => {
    const sleep = button('template-sleep', GOAL_TEMPLATES.sleep.name);
    const workout = button('template-workout', GOAL_TEMPLATES.workout.name);
    sleep.addEventListener('click', () => pick('sleep'));
    workout.addEventListener('click', () => pick('workout'));
    templates.replaceChildren(sleep, workout);
  });

  const cancel = button('modal-cancel', 'Cancel', 'ghost');
  cancel.addEventListener('click', close);
  el.appendChild(cancel);

  function open(state: GameplayState, tile: TileCoord): void {
    openTile = tile;
    panel.start(deps.createGoalChat?.());
    templates.replaceChildren();
    selectType('A');
    setGrown(false);
    if (availableTreeTypes(state).includes('B')) {
      typeRow.appendChild(typeB);
    } else {
      typeB.remove();
    }
    el.style.display = 'block';
  }

  return { el, open, close, isOpen: () => openTile !== undefined };
}
