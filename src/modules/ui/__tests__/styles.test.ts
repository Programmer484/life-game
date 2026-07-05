// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { ensureStyles } from '../internal/styles.ts';

const TOKENS = [
  '--lg-bg-panel',
  '--lg-fg',
  '--lg-accent',
  '--lg-accent-2',
  '--lg-danger',
  '--lg-radius',
  '--lg-space-1',
  '--lg-space-2',
  '--lg-space-3',
  '--lg-font',
  '--lg-shadow',
];

const CLASSES = [
  '.lg-btn',
  '.lg-btn--primary',
  '.lg-btn--ghost',
  '.lg-btn--danger',
  '.lg-panel',
  '.lg-modal-backdrop',
  '.lg-modal',
  '.lg-input',
  '.lg-bar',
  '.lg-bar__fill',
];

function styleTags(): NodeListOf<HTMLStyleElement> {
  return document.head.querySelectorAll<HTMLStyleElement>('style#lg-styles');
}

describe('ensureStyles', () => {
  beforeEach(() => {
    for (const tag of styleTags()) tag.remove();
  });

  it('injects a single <style id="lg-styles"> tag into document.head', () => {
    ensureStyles();

    expect(styleTags()).toHaveLength(1);
  });

  it('is idempotent — repeated calls leave exactly one tag', () => {
    ensureStyles();
    ensureStyles();
    ensureStyles();

    expect(styleTags()).toHaveLength(1);
  });

  it('declares every design token on :root', () => {
    ensureStyles();
    const css = styleTags()[0]!.textContent ?? '';

    expect(css).toContain(':root');
    for (const token of TOKENS) {
      expect(css).toContain(token);
    }
  });

  it('defines every shared class', () => {
    ensureStyles();
    const css = styleTags()[0]!.textContent ?? '';

    for (const className of CLASSES) {
      expect(css).toContain(className);
    }
  });

  it('gives the bar fill a width transition and a [data-full] rule', () => {
    ensureStyles();
    const css = styleTags()[0]!.textContent ?? '';

    expect(css).toContain('transition: width');
    expect(css).toContain('[data-full]');
  });
});
