import { STORY_BLOCKS } from '../../config/index.ts';
import { ensureStyles } from './styles.ts';

export interface StoryScreenDeps {
  onFinished: () => void;
}

export interface StoryScreen {
  el: HTMLElement;
}

/**
 * First-run story screen. A full-screen opaque overlay that plays the
 * STORY_BLOCKS sequence one block at a time; the ONLY control is the Next
 * button. After Next on the final block, `onFinished` fires exactly once and
 * the screen hides itself. Whether it shows at all is decided by the caller.
 */
export function createStoryScreen(deps: StoryScreenDeps): StoryScreen {
  ensureStyles();
  const el = document.createElement('section');
  el.className = 'story-screen lg-modal-backdrop';
  el.dataset['testid'] = 'story-screen';
  el.style.background = '#0b0f14'; // opaque: the story hides the scene behind it

  const card = document.createElement('div');
  card.className = 'lg-modal';
  card.style.boxShadow = 'none'; // flush against the opaque backdrop
  card.style.background = 'transparent';
  card.style.textAlign = 'center';
  el.appendChild(card);

  const block = document.createElement('p');
  block.className = 'story-block lg-prose';
  block.dataset['testid'] = 'story-block';
  card.appendChild(block);

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'story-next lg-btn lg-btn--primary';
  next.dataset['testid'] = 'story-next';
  next.textContent = 'Next';
  next.style.marginTop = '2rem';
  card.appendChild(next);

  let index = 0;
  let finished = false;
  block.textContent = STORY_BLOCKS[index] ?? '';

  next.addEventListener('click', () => {
    if (finished) return;
    index += 1;
    if (index < STORY_BLOCKS.length) {
      block.textContent = STORY_BLOCKS[index] ?? '';
      return;
    }
    finished = true;
    el.style.display = 'none';
    deps.onFinished();
  });

  return { el };
}
