import { STORY_BLOCKS } from '../../config/index.ts';

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
  const el = document.createElement('section');
  el.className = 'story-screen';
  el.dataset['testid'] = 'story-screen';
  el.style.position = 'fixed';
  el.style.inset = '0';
  el.style.background = '#0b0f14';
  el.style.color = '#e8e6df';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.textAlign = 'center';
  el.style.padding = '2rem';
  el.style.fontFamily = 'serif';

  const block = document.createElement('p');
  block.className = 'story-block';
  block.dataset['testid'] = 'story-block';
  block.style.maxWidth = '36rem';
  block.style.fontSize = '1.125rem';
  block.style.lineHeight = '1.6';
  el.appendChild(block);

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'story-next';
  next.dataset['testid'] = 'story-next';
  next.textContent = 'Next';
  next.style.marginTop = '2rem';
  el.appendChild(next);

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
