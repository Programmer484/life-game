// Internal implementation. Deep imports from other modules are blocked by lint.
import { GOAL_TEMPLATES } from '../../config/index.ts';
import type { TileCoord, TreeType } from '../../config/index.ts';
import { availableTreeTypes } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';

export interface PlantChoice {
  tile: TileCoord;
  templateKey: 'sleep' | 'workout';
  type: TreeType;
}

export interface PlantingModalDeps {
  onPlant: (choice: PlantChoice) => void;
}

export interface PlantingModal {
  el: HTMLElement;
  open(state: GameplayState, tile: TileCoord): void;
  close(): void;
  isOpen(): boolean;
}

function button(testid: string, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset['testid'] = testid;
  b.textContent = label;
  b.style.margin = '2px';
  return b;
}

/**
 * The planting modal: a placeholder for a future goal-setting chatbot.
 * Shows a disabled chat area plus an Autofill button that reveals the two
 * goal templates from config. Choosing one reports the intent via `onPlant`
 * (tile + template key + selected tree type) and closes — the modal never
 * creates goals or mutates state itself. All DOM is built once at creation;
 * `open` only resets it, so repeated opens never stack nodes or listeners.
 */
export function createPlantingModal(deps: PlantingModalDeps): PlantingModal {
  const el = document.createElement('div');
  el.className = 'planting-modal';
  el.dataset['testid'] = 'planting-modal';
  el.style.display = 'none';
  el.style.position = 'absolute';
  el.style.padding = '12px';
  el.style.border = '1px solid #555';
  el.style.background = '#222';
  el.style.color = '#eee';
  el.style.fontFamily = 'sans-serif';

  const chat = document.createElement('textarea');
  chat.dataset['testid'] = 'chat-placeholder';
  chat.disabled = true;
  chat.placeholder = 'Goal-setting chat coming soon — use Autofill below.';
  chat.style.display = 'block';
  chat.style.width = '240px';
  chat.style.height = '64px';
  el.appendChild(chat);

  // Tree-type selector: A always offered; B only when the state unlocks it.
  const typeRow = document.createElement('div');
  const typeA = button('tree-type-a', 'Tree A');
  const typeB = button('tree-type-b', 'Tree B'); // attached only when offered
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

  const autofill = button('autofill', 'Autofill');
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
    deps.onPlant({ tile, templateKey, type: selectedType });
  }

  autofill.addEventListener('click', () => {
    const sleep = button('template-sleep', GOAL_TEMPLATES.sleep.name);
    const workout = button('template-workout', GOAL_TEMPLATES.workout.name);
    sleep.addEventListener('click', () => pick('sleep'));
    workout.addEventListener('click', () => pick('workout'));
    templates.replaceChildren(sleep, workout);
  });

  const cancel = button('modal-cancel', 'Cancel');
  cancel.addEventListener('click', close);
  el.appendChild(cancel);

  function open(state: GameplayState, tile: TileCoord): void {
    openTile = tile;
    templates.replaceChildren();
    selectType('A');
    if (availableTreeTypes(state).includes('B')) {
      typeRow.appendChild(typeB);
    } else {
      typeB.remove();
    }
    el.style.display = 'block';
  }

  return { el, open, close, isOpen: () => openTile !== undefined };
}
