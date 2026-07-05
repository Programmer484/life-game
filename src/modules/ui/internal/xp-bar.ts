// Internal implementation. Deep imports from other modules are blocked by lint.
import { UNLOCK_COSTS } from '../../config/index.ts';
import { fullyGrownCount, xpProgress } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import { isSectionUnlocked } from '../../world/index.ts';

export interface XpBar {
  el: HTMLElement;
  update(state: GameplayState): void;
}

/** Cost of the lowest locked section, or undefined when all are unlocked. */
function nextUnlockCost(state: GameplayState): number | undefined {
  for (let id = 2; id <= UNLOCK_COSTS.length + 1; id++) {
    if (!isSectionUnlocked(state.world, id)) return UNLOCK_COSTS[id - 2]!;
  }
  return undefined;
}

/**
 * The XP bar: a fill that tracks `xpProgress` plus a numeric label of
 * fully-grown trees vs the next section's unlock cost (`MAX` once every
 * section is unlocked). Pure read-only DOM overlay — mutating the same
 * nodes on every `update`, so repeated calls never stack DOM or listeners.
 */
export function createXpBar(): XpBar {
  const el = document.createElement('div');
  el.className = 'xp-bar';
  el.dataset['testid'] = 'xp-bar';
  el.style.position = 'relative';
  el.style.width = '240px';
  el.style.height = '16px';
  el.style.border = '1px solid #555';
  el.style.background = '#222';
  el.style.fontFamily = 'sans-serif';

  const fill = document.createElement('div');
  fill.className = 'xp-bar-fill';
  fill.dataset['testid'] = 'xp-bar-fill';
  fill.style.height = '100%';
  fill.style.width = '0%';
  fill.style.background = '#6c4';
  el.appendChild(fill);

  const label = document.createElement('span');
  label.className = 'xp-bar-label';
  label.dataset['testid'] = 'xp-bar-label';
  label.style.position = 'absolute';
  label.style.inset = '0';
  label.style.textAlign = 'center';
  label.style.fontSize = '11px';
  label.style.color = '#fff';
  el.appendChild(label);

  function update(state: GameplayState): void {
    const progress = Math.min(1, Math.max(0, xpProgress(state)));
    fill.style.width = `${progress * 100}%`;
    if (progress >= 1) {
      el.setAttribute('data-full', '');
    } else {
      el.removeAttribute('data-full');
    }
    const cost = nextUnlockCost(state);
    label.textContent = cost === undefined ? 'MAX' : `${fullyGrownCount(state.trees)} / ${cost}`;
  }

  return { el, update };
}
