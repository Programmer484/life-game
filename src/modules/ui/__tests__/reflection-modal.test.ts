// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createReflectionModal } from '../index.ts';

function query(el: HTMLElement, testid: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

describe('ui / reflection modal', () => {
  it('is hidden initially', () => {
    const modal = createReflectionModal({});

    expect(modal.el.dataset['testid']).toBe('reflection-modal');
    expect(modal.isOpen()).toBe(false);
    expect(modal.el.style.display).toBe('none');
  });

  it('open() shows the modal and starts a fresh session each time', () => {
    const createSession = vi.fn(() => ({
      opening: 'How was your day?',
      send: async () => 'reply',
    }));
    const modal = createReflectionModal({ createSession });

    modal.open();
    expect(modal.isOpen()).toBe(true);
    expect(modal.el.style.display).not.toBe('none');
    expect(query(modal.el, 'chat-log')?.textContent).toContain('How was your day?');

    modal.close();
    modal.open();
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it('open() without a session factory shows the offline notice', () => {
    const modal = createReflectionModal({});
    modal.open();

    expect(query(modal.el, 'chat-log')?.textContent).toContain('Chat is unavailable.');
    expect((query(modal.el, 'chat-input') as HTMLInputElement).disabled).toBe(true);
  });

  it('the close button hides the modal', () => {
    const modal = createReflectionModal({});
    modal.open();

    query(modal.el, 'reflection-close')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(modal.isOpen()).toBe(false);
    expect(modal.el.style.display).toBe('none');
  });
});
