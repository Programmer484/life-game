// Internal implementation. Deep imports from other modules are blocked by lint.

export interface ReflectButtonDeps {
  /** Fired on click — core-app opens the reflection modal. */
  onClick: () => void;
}

/** The Reflect button: opens the reflection chat via the injected callback. */
export function createReflectButton(deps: ReflectButtonDeps): { el: HTMLElement } {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'reflect-button';
  el.dataset['testid'] = 'reflect-button';
  el.textContent = 'Reflect';
  el.style.fontFamily = 'sans-serif';
  el.addEventListener('click', () => {
    deps.onClick();
  });
  return { el };
}
