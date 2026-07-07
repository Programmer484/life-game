// Internal implementation. Deep imports from other modules are blocked by lint.
import type { ChatSession } from './chat-panel.ts';
import { createChatPanel } from './chat-panel.ts';

export interface ReflectionModalDeps {
  /** Fresh reflection conversation per open; absent = no API key configured. */
  createSession?: () => ChatSession;
}

export interface ReflectionModal {
  el: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
}

/**
 * The reflection chat, opened by the Reflect button. Each open starts a fresh
 * conversation; without a session factory the chat panel shows its offline
 * notice. DOM is built once at creation — open only resets it.
 */
export function createReflectionModal(deps: ReflectionModalDeps): ReflectionModal {
  const el = document.createElement('div');
  el.className = 'reflection-modal';
  el.dataset['testid'] = 'reflection-modal';
  el.style.display = 'none';
  el.style.position = 'absolute';
  el.style.padding = '12px';
  el.style.border = '1px solid #555';
  el.style.background = '#222';
  el.style.color = '#eee';
  el.style.fontFamily = 'sans-serif';

  const title = document.createElement('div');
  title.textContent = 'Reflect';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  const chat = createChatPanel();
  el.appendChild(chat.el);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.dataset['testid'] = 'reflection-close';
  closeButton.textContent = 'Close';
  closeButton.style.marginTop = '8px';
  el.appendChild(closeButton);

  let openState = false;

  function open(): void {
    openState = true;
    chat.start(deps.createSession?.());
    el.style.display = 'block';
  }

  function close(): void {
    openState = false;
    el.style.display = 'none';
  }

  closeButton.addEventListener('click', close);

  return { el, open, close, isOpen: () => openState };
}
