// Internal implementation. Deep imports from other modules are blocked by lint.
import { focusedTree } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';

export interface DevPanelDeps {
  onSkipStage: () => void;
  onPlantFullyGrown: () => void;
}

export interface DevPanel {
  el: HTMLElement;
  update(state: GameplayState): void;
}

/**
 * Developer shortcuts panel. Pure DOM overlay — reads state, pushes intent
 * out via callbacks, and never mutates game state itself. The buttons are
 * created once; `update` only toggles the skip button's disabled flag, so
 * repeated updates never duplicate DOM or stack listeners.
 */
export function createDevPanel(deps: DevPanelDeps): DevPanel {
  const el = document.createElement('section');
  el.className = 'dev-panel';
  el.dataset['testid'] = 'dev-panel';
  el.style.fontFamily = 'sans-serif';

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'dev-skip-stage';
  skip.dataset['testid'] = 'dev-skip-stage';
  skip.textContent = 'Skip to next tree stage';
  skip.disabled = true; // nothing focused until the first update says otherwise
  skip.addEventListener('click', () => {
    deps.onSkipStage();
  });

  const plant = document.createElement('button');
  plant.type = 'button';
  plant.className = 'dev-plant-grown';
  plant.dataset['testid'] = 'dev-plant-grown';
  plant.textContent = 'Plant fully grown tree';
  plant.addEventListener('click', () => {
    deps.onPlantFullyGrown();
  });

  el.append(skip, plant);

  function update(state: GameplayState): void {
    skip.disabled = focusedTree(state) === undefined;
  }

  return { el, update };
}
