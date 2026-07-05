// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createReflectButton } from '../index.ts';

describe('reflect button', () => {
  it('renders a visible button labeled "Reflect"', () => {
    const { el } = createReflectButton();

    expect(el.dataset['testid']).toBe('reflect-button');
    expect(el.textContent).toBe('Reflect');
    expect(el.style.display).not.toBe('none');
    expect(el.style.visibility).not.toBe('hidden');
    expect((el as HTMLButtonElement).hidden).toBe(false);
    expect((el as HTMLButtonElement).disabled).toBe(false);
  });

  it('takes no callbacks — the factory has no deps surface', () => {
    // Placeholder contract: nothing to emit, so nothing to configure.
    expect(createReflectButton.length).toBe(0);
  });

  it('does nothing when clicked (no throw)', () => {
    const { el } = createReflectButton();

    expect(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      el.click();
    }).not.toThrow();
  });
});
