// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createShortcuts } from '../index.ts';
import type { Shortcuts, ShortcutsDeps } from '../internal/shortcuts.ts';

function make(deps: ShortcutsDeps): Shortcuts {
  return createShortcuts(deps);
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

describe('shortcuts', () => {
  it('dispatches a registered key to its handler', () => {
    const shortcuts = make({ isModalOpen: () => false });
    const handler = vi.fn();
    shortcuts.register('1', handler);

    press('1');
    expect(handler).toHaveBeenCalledTimes(1);
    shortcuts.dispose();
  });

  it('ignores unregistered keys', () => {
    const shortcuts = make({ isModalOpen: () => false });
    const handler = vi.fn();
    shortcuts.register('1', handler);

    press('2');
    expect(handler).not.toHaveBeenCalled();
    shortcuts.dispose();
  });

  it("dispatches '?' (a shifted key) by its produced character", () => {
    const shortcuts = make({ isModalOpen: () => false });
    const handler = vi.fn();
    shortcuts.register('?', handler);

    press('?', { shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    shortcuts.dispose();
  });

  it('suppresses shortcuts while a modal is open', () => {
    let open = true;
    const shortcuts = make({ isModalOpen: () => open });
    const handler = vi.fn();
    shortcuts.register('1', handler);

    press('1');
    expect(handler).not.toHaveBeenCalled();

    open = false;
    press('1');
    expect(handler).toHaveBeenCalledTimes(1);
    shortcuts.dispose();
  });

  it('suppresses shortcuts when typing in an input, textarea, or contenteditable', () => {
    const shortcuts = make({ isModalOpen: () => false });
    const handler = vi.fn();
    shortcuts.register('1', handler);

    for (const el of [
      document.createElement('input'),
      document.createElement('textarea'),
      Object.assign(document.createElement('div'), { contentEditable: 'true' }),
    ]) {
      document.body.appendChild(el);
      press('1', {}, el);
      el.remove();
    }
    expect(handler).not.toHaveBeenCalled();
    shortcuts.dispose();
  });

  it('ignores keys pressed with ctrl, meta, or alt held', () => {
    const shortcuts = make({ isModalOpen: () => false });
    const handler = vi.fn();
    shortcuts.register('1', handler);

    press('1', { ctrlKey: true });
    press('1', { metaKey: true });
    press('1', { altKey: true });
    expect(handler).not.toHaveBeenCalled();
    shortcuts.dispose();
  });

  it('stops dispatching after dispose()', () => {
    const shortcuts = make({ isModalOpen: () => false });
    const handler = vi.fn();
    shortcuts.register('1', handler);

    shortcuts.dispose();
    press('1');
    expect(handler).not.toHaveBeenCalled();
  });
});
