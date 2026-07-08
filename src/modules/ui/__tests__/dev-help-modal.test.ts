// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createDevHelpModal } from '../index.ts';
import { DEV_TOOLS } from '../internal/dev-help-modal.ts';
import type { DevHelpModal } from '../internal/dev-help-modal.ts';

function query(el: HTMLElement, testid: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

describe('dev help modal', () => {
  it('lists every DEV_TOOLS entry — key, name, and description', () => {
    const modal: DevHelpModal = createDevHelpModal();
    const text = modal.el.textContent!;
    for (const tool of DEV_TOOLS) {
      expect(text).toContain(tool.key);
      expect(text).toContain(tool.name);
      expect(text).toContain(tool.desc);
    }
  });

  it('explains how to enable and disable dev mode', () => {
    const modal = createDevHelpModal();
    const note = query(modal.el, 'dev-help-mode-note')?.textContent ?? '';
    expect(note).toContain('?dev=1');
    expect(note).toContain('?dev=0');
  });

  it('is hidden initially; open/close/isOpen toggle visibility', () => {
    const modal = createDevHelpModal();
    expect(modal.isOpen()).toBe(false);
    expect(modal.el.style.display).toBe('none');

    modal.open();
    expect(modal.isOpen()).toBe(true);
    expect(modal.el.style.display).not.toBe('none');

    modal.close();
    expect(modal.isOpen()).toBe(false);
    expect(modal.el.style.display).toBe('none');
  });

  it('the Close button closes it', () => {
    const modal = createDevHelpModal();
    modal.open();
    query(modal.el, 'dev-help-close')?.click();
    expect(modal.isOpen()).toBe(false);
  });
});
