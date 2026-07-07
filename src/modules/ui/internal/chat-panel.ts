// Internal implementation. Deep imports from other modules are blocked by lint.

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

const OFFLINE_NOTICE = 'Chat is offline — add VITE_ANTHROPIC_API_KEY to .env.local to enable it.';

/** Shared chat UI for the goal and reflection coaches: log + input + send. */
export function createChatPanel(): ChatPanel {
  const el = document.createElement('div');
  el.dataset['testid'] = 'chat-panel';

  const log = document.createElement('div');
  log.dataset['testid'] = 'chat-log';
  log.style.width = '280px';
  log.style.height = '160px';
  log.style.overflowY = 'auto';
  log.style.border = '1px solid #555';
  log.style.padding = '6px';
  log.style.marginBottom = '6px';
  el.appendChild(log);

  const row = document.createElement('div');
  const input = document.createElement('input');
  input.type = 'text';
  input.dataset['testid'] = 'chat-input';
  input.placeholder = 'Type a message…';
  input.style.width = '210px';
  const send = document.createElement('button');
  send.type = 'button';
  send.dataset['testid'] = 'chat-send';
  send.textContent = 'Send';
  row.append(input, send);
  el.appendChild(row);

  let session: ChatSession | undefined;

  function append(role: 'user' | 'assistant' | 'notice', text: string): void {
    const line = document.createElement('div');
    line.dataset['role'] = role;
    line.textContent = role === 'user' ? `You: ${text}` : text;
    if (role === 'notice') line.style.opacity = '0.7';
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function setBusy(busy: boolean): void {
    input.disabled = busy || session === undefined;
    send.disabled = busy || session === undefined;
  }

  function submit(): void {
    const text = input.value.trim();
    if (!session || !text) return;
    const active = session;
    append('user', text);
    input.value = '';
    setBusy(true);
    active
      .send(text)
      .then((reply) => {
        // Ignore replies from a conversation that was reset mid-flight.
        if (session === active) append('assistant', reply);
      })
      .catch(() => {
        if (session === active) append('notice', 'Something went wrong — try again.');
      })
      .finally(() => {
        if (session === active) setBusy(false);
      });
  }

  send.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit();
  });

  function start(next: ChatSession | undefined): void {
    session = next;
    log.replaceChildren();
    input.value = '';
    if (!session) {
      append('notice', OFFLINE_NOTICE);
    } else {
      append('assistant', session.opening);
    }
    setBusy(false);
  }

  start(undefined);
  return { el, start };
}
