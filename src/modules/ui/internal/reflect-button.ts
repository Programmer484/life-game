// Internal implementation. Deep imports from other modules are blocked by lint.

/**
 * Placeholder Reflect button. It is visible but inert: clicking it does
 * nothing and there is no callback surface yet (wired in a later slice).
 */
export function createReflectButton(): { el: HTMLElement } {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'reflect-button';
  el.dataset['testid'] = 'reflect-button';
  el.textContent = 'Reflect';
  el.style.fontFamily = 'sans-serif';
  return { el };
}
