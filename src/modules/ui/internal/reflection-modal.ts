// Internal implementation. Deep imports from other modules are blocked by lint.
import type { ChatSession } from './chat-panel.ts';
import { createChatPanel } from './chat-panel.ts';
import { ensureStyles } from './styles.ts';

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
 * The dedicated reflection chat window, opened by the Reflect button. Each
 * open starts a fresh conversation; without a session factory the chat panel
 * shows its offline notice. DOM is built once at creation — open only resets
 * it.
 */
export function createReflectionModal(deps: ReflectionModalDeps): ReflectionModal {
  ensureStyles();
  const el = document.createElement('div');
  el.className = 'reflection-modal lg-modal';
  el.dataset['testid'] = 'reflection-modal';
  el.style.display = 'none';
  el.style.minWidth = '420px';
  el.style.height = '70vh';
  el.style.flexDirection = 'column';

  const header = document.createElement('header');
  header.style.display = 'flex';
  header.style.alignItems = 'baseline';
  header.style.gap = 'var(--lg-space-2)';
  header.style.marginBottom = 'var(--lg-space-2)';

  const title = document.createElement('h2');
  title.dataset['testid'] = 'reflection-title';
  title.textContent = 'Reflection';
  title.style.margin = '0';
  title.style.fontSize = '18px';
  title.style.flex = '1';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'reflection-close lg-btn lg-btn--ghost';
  closeButton.dataset['testid'] = 'reflection-close';
  closeButton.textContent = 'Close';
  header.append(title, closeButton);
  el.appendChild(header);

  const subtitle = document.createElement('p');
  subtitle.dataset['testid'] = 'reflection-subtitle';
  subtitle.textContent = 'Talk through your day with your coach.';
  subtitle.style.margin = '0 0 var(--lg-space-2)';
  subtitle.style.fontSize = '13px';
  subtitle.style.opacity = '0.7';
  el.appendChild(subtitle);

  // Fill variant: the chat log stretches to the modal's remaining height.
  const chat = createChatPanel();
  chat.el.classList.add('lg-chat--fill');
  el.appendChild(chat.el);

  let openState = false;

  function open(): void {
    openState = true;
    chat.start(deps.createSession?.());
    el.style.display = 'flex';
  }

  function close(): void {
    openState = false;
    el.style.display = 'none';
  }

  closeButton.addEventListener('click', close);

  return { el, open, close, isOpen: () => openState };
}
