// Internal implementation. Deep imports from other modules are blocked by lint.

export interface ShortcutsDeps {
  /** Suppress every shortcut while any modal is open. */
  isModalOpen(): boolean;
}

export interface Shortcuts {
  /** Bind `key` (a KeyboardEvent.key value, e.g. '1' or '?') to a handler. */
  register(key: string, handler: () => void): void;
  dispose(): void;
}

/** True when the event originates from a text-entry element. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * One document-level keydown listener dispatching to registered handlers.
 * Suppressed when focus is in an input/textarea/contenteditable, when a
 * modal is open (per deps), or when a modifier (ctrl/meta/alt) is held —
 * shortcuts must never eat typing or browser chords. `dispose()` removes
 * the listener.
 */
export function createShortcuts(deps: ShortcutsDeps, target: EventTarget = document): Shortcuts {
  const handlers = new Map<string, () => void>();

  const onKeydown = (event: Event): void => {
    const key = event as KeyboardEvent;
    if (key.ctrlKey || key.metaKey || key.altKey) return;
    if (isEditable(key.target) || deps.isModalOpen()) return;
    handlers.get(key.key)?.();
  };
  target.addEventListener('keydown', onKeydown);

  return {
    register(key, handler) {
      handlers.set(key, handler);
    },
    dispose() {
      target.removeEventListener('keydown', onKeydown);
    },
  };
}
