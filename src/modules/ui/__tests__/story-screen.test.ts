// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { STORY_BLOCKS } from '../../config/index.ts';
import { createStoryScreen } from '../index.ts';

function blockText(el: HTMLElement): string | undefined {
  return el.querySelector<HTMLElement>('[data-testid="story-block"]')?.textContent ?? undefined;
}

function nextButton(el: HTMLElement): HTMLButtonElement {
  const btn = el.querySelector<HTMLButtonElement>('[data-testid="story-next"]');
  if (!btn) throw new Error('story-next button not found');
  return btn;
}

describe('ui · story screen', () => {
  it('shows the first STORY_BLOCKS entry verbatim from config on mount', () => {
    const screen = createStoryScreen({ onFinished: () => {} });

    expect(screen.el.dataset['testid']).toBe('story-screen');
    expect(blockText(screen.el)).toBe(STORY_BLOCKS[0]);
  });

  it('advances through all 6 blocks in order via Next, verbatim each step', () => {
    const screen = createStoryScreen({ onFinished: () => {} });

    for (let i = 0; i < STORY_BLOCKS.length; i++) {
      expect(blockText(screen.el)).toBe(STORY_BLOCKS[i]);
      if (i < STORY_BLOCKS.length - 1) nextButton(screen.el).click();
    }
  });

  it('has no control other than Next (no skip)', () => {
    const screen = createStoryScreen({ onFinished: () => {} });

    const controls = screen.el.querySelectorAll('button, input, select, textarea, a');
    expect(controls).toHaveLength(1);
    expect((controls[0] as HTMLElement).dataset['testid']).toBe('story-next');
  });

  it('fires onFinished exactly once after Next on the 6th block and hides itself', () => {
    const onFinished = vi.fn();
    const screen = createStoryScreen({ onFinished });

    for (let i = 0; i < STORY_BLOCKS.length; i++) {
      expect(onFinished).not.toHaveBeenCalled();
      nextButton(screen.el).click();
    }

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(screen.el.style.display).toBe('none');
  });

  it('ignores further interaction after finish (no double onFinished)', () => {
    const onFinished = vi.fn();
    const screen = createStoryScreen({ onFinished });

    for (let i = 0; i < STORY_BLOCKS.length; i++) nextButton(screen.el).click();
    nextButton(screen.el).click();
    nextButton(screen.el).click();

    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
