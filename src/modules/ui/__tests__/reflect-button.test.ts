// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createReflectButton } from '../index.ts';

describe('reflect button', () => {
  it('renders a visible button labeled "Reflect"', () => {
    const { el } = createReflectButton({ onClick: () => {} });

    expect(el.dataset['testid']).toBe('reflect-button');
    expect(el.textContent).toBe('Reflect');
    expect(el.style.display).not.toBe('none');
    expect(el.style.visibility).not.toBe('hidden');
    expect((el as HTMLButtonElement).hidden).toBe(false);
    expect((el as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { el } = createReflectButton({ onClick });

    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
