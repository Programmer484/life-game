// Internal implementation. Deep imports from other modules are blocked by lint.
import { focusedTree } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import { ensureStyles } from './styles.ts';

export interface DevPanelDeps {
  onSkipStage: () => void;
}

export interface DevPanel {
  el: HTMLElement;
  update(state: GameplayState): void;
}

/**
 * Developer shortcuts panel. Pure DOM overlay — reads state, pushes intent
 * out via callbacks, and never mutates game state itself. The button is
 * created once; `update` only toggles its disabled flag, so repeated
 * updates never duplicate DOM or stack listeners. (Planting fully grown
 * lives in the planting modal's dev toggle, not here.)
 */
export function createDevPanel(deps: DevPanelDeps): DevPanel {
  ensureStyles();
  const el = document.createElement('section');
  el.className = 'dev-panel lg-panel';
  el.dataset['testid'] = 'dev-panel';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.gap = 'var(--lg-space-1)';

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'dev-skip-stage lg-btn lg-btn--ghost';
  skip.dataset['testid'] = 'dev-skip-stage';
  skip.textContent = 'Skip to next tree stage';
  skip.disabled = true; // nothing focused until the first update says otherwise
  skip.addEventListener('click', () => {
    deps.onSkipStage();
  });

  el.append(skip);

  function update(state: GameplayState): void {
    skip.disabled = focusedTree(state) === undefined;
  }

  return { el, update };
}
