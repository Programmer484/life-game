// Internal implementation. Deep imports from other modules are blocked by lint.
import { ensureStyles } from './styles.ts';

/**
 * What the chat panel needs from a conversation. Structurally matched by the
 * coach module's CoachSession — ui never imports coach; core-app injects it.
 */
export interface ChatSession {
  /** Assistant text shown before the user has said anything. */
  opening: string;
  send(text: string): Promise<string>;
}

export interface ChatPanel {
  el: HTMLElement;
  /**
   * Reset the panel for a fresh conversation. With no session (no API key
   * configured) the panel renders an offline notice and stays disabled.
   */
  start(session: ChatSession | undefined): void;
}

const OFFLINE_NOTICE = 'Chat is unavailable.';
/** Auto-scroll on new messages only when already this close to the bottom. */
const NEAR_BOTTOM_PX = 40;
const MAX_INPUT_ROWS = 4;

/** Shared chat UI for the goal and reflection coaches: bubbles + textarea. */
export function createChatPanel(): ChatPanel {
  ensureStyles();
  const el = document.createElement('div');
  el.className = 'chat-panel lg-chat';
  el.dataset['testid'] = 'chat-panel';

  const log = document.createElement('div');
  log.className = 'chat-log lg-chat__log lg-input';
  log.dataset['testid'] = 'chat-log';
  el.appendChild(log);

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = 'var(--lg-space-1)';
  row.style.alignItems = 'flex-end';
  const input = document.createElement('textarea');
  input.rows = 1;
  input.className = 'chat-input lg-input';
  input.dataset['testid'] = 'chat-input';
  input.placeholder = 'Type a message…';
  input.style.flex = '1';
  input.style.resize = 'none';
  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'chat-send lg-btn lg-btn--primary';
  send.dataset['testid'] = 'chat-send';
  send.textContent = 'Send';
  row.append(input, send);
  el.appendChild(row);

  let session: ChatSession | undefined;
  let busy = false;
  let typing: HTMLElement | undefined;

  function nearBottom(): boolean {
    return log.scrollHeight - log.scrollTop - log.clientHeight <= NEAR_BOTTOM_PX;
  }

  /** Append `node`, scrolling only if the user was already near the bottom. */
  function appendToLog(node: HTMLElement): void {
    const follow = nearBottom();
    log.appendChild(node);
    if (follow) log.scrollTop = log.scrollHeight;
  }

  function lastRole(): string | undefined {
    return log.lastElementChild instanceof HTMLElement
      ? log.lastElementChild.dataset['role']
      : undefined;
  }

  function bubble(role: 'user' | 'coach' | 'error', text: string): void {
    const msg = document.createElement('div');
    msg.className = `lg-chat__msg lg-chat__msg--${role}`;
    msg.dataset['role'] = role;
    // Label the first coach bubble of each coach run.
    if (role === 'coach' && lastRole() !== 'coach') {
      const label = document.createElement('span');
      label.className = 'lg-chat__label';
      label.textContent = 'Coach';
      msg.appendChild(label);
    }
    msg.appendChild(document.createTextNode(text));
    appendToLog(msg);
  }

  function showTyping(): void {
    const msg = document.createElement('div');
    msg.className = 'lg-chat__msg lg-chat__msg--coach lg-chat__typing';
    msg.dataset['testid'] = 'chat-typing';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'lg-chat__dot';
      msg.appendChild(dot);
    }
    typing = msg;
    appendToLog(msg);
  }

  function hideTyping(): void {
    typing?.remove();
    typing = undefined;
  }

  function syncControls(): void {
    input.disabled = busy || session === undefined;
    send.disabled = busy || session === undefined || input.value.trim() === '';
    input.rows = Math.min(MAX_INPUT_ROWS, input.value.split('\n').length);
  }

  function setBusy(next: boolean): void {
    busy = next;
    syncControls();
  }

  function submit(): void {
    const text = input.value.trim();
    if (!session || busy || !text) return;
    const active = session;
    bubble('user', text);
    input.value = '';
    setBusy(true);
    showTyping();
    active
      .send(text)
      .then((reply) => {
        // Ignore replies from a conversation that was reset mid-flight.
        if (session === active) bubble('coach', reply);
      })
      .catch((error: unknown) => {
        if (session !== active) return;
        // Server errors carry a user-facing message (e.g. the 503 no-key one).
        const message = error instanceof Error && error.message !== '' ? error.message : undefined;
        bubble('error', message ?? 'Something went wrong — try again.');
      })
      .finally(() => {
        if (session !== active) return;
        hideTyping();
        setBusy(false);
      });
  }

  send.addEventListener('click', submit);
  input.addEventListener('input', syncControls);
  input.addEventListener('keydown', (event) => {
    // Enter sends; Shift+Enter falls through to insert a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });

  function start(next: ChatSession | undefined): void {
    session = next;
    log.replaceChildren();
    typing = undefined;
    input.value = '';
    if (!session) {
      const notice = document.createElement('div');
      notice.className = 'lg-chat__msg lg-chat__msg--coach';
      notice.dataset['role'] = 'notice';
      notice.style.opacity = '0.7';
      notice.textContent = OFFLINE_NOTICE;
      log.appendChild(notice);
    } else {
      bubble('coach', session.opening);
    }
    setBusy(false);
  }

  start(undefined);
  return { el, start };
}
