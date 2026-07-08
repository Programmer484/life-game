// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
// createChatPanel is not on the public surface (only core-app-facing pieces
// are); own-module internal access is allowed for otherwise-unreachable logic.
import type { ChatSession } from '../internal/chat-panel.ts';
import { createChatPanel } from '../internal/chat-panel.ts';

function query(el: HTMLElement, testid: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

function input(el: HTMLElement): HTMLTextAreaElement {
  return query(el, 'chat-input') as HTMLTextAreaElement;
}

function sendButton(el: HTMLElement): HTMLButtonElement {
  return query(el, 'chat-send') as HTMLButtonElement;
}

/** Set the textarea value the way a user would (fires the input listener). */
function type(el: HTMLElement, text: string): void {
  input(el).value = text;
  input(el).dispatchEvent(new Event('input', { bubbles: true }));
}

function clickSend(el: HTMLElement): void {
  sendButton(el).dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function fakeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return { opening: 'Hello there.', send: async () => 'A reply.', ...overrides };
}

describe('ui / chat panel', () => {
  it('starts offline: notice shown, input and send disabled', () => {
    const panel = createChatPanel();

    expect(query(panel.el, 'chat-log')?.textContent).toContain('Chat is unavailable.');
    expect(input(panel.el).disabled).toBe(true);
    expect(sendButton(panel.el).disabled).toBe(true);
  });

  it('sends a message and renders user and coach bubbles', async () => {
    const send = vi.fn(async () => 'Sounds great!');
    const panel = createChatPanel();
    panel.start(fakeSession({ opening: 'What is on your mind?', send }));

    const log = query(panel.el, 'chat-log')!;
    const opening = log.querySelector('.lg-chat__msg--coach')!;
    expect(opening.textContent).toContain('What is on your mind?');
    expect(opening.textContent).toContain('Coach'); // labelled coach run

    type(panel.el, 'I slept well');
    clickSend(panel.el);

    expect(send).toHaveBeenCalledWith('I slept well');
    const user = log.querySelector('.lg-chat__msg--user')!;
    expect(user.textContent).toBe('I slept well');
    expect(input(panel.el).value).toBe('');
    await vi.waitFor(() => {
      expect(log.textContent).toContain('Sounds great!');
    });
    expect(input(panel.el).disabled).toBe(false);
    // Second coach message in a row: opening + reply, but only one label.
    expect(log.querySelectorAll('.lg-chat__msg--coach')).toHaveLength(2);
  });

  it('labels only the first coach bubble of each coach run', async () => {
    const panel = createChatPanel();
    panel.start(fakeSession({ send: async () => 'reply' }));

    type(panel.el, 'one');
    clickSend(panel.el);
    await vi.waitFor(() => {
      expect(query(panel.el, 'chat-log')!.textContent).toContain('reply');
    });

    const log = query(panel.el, 'chat-log')!;
    // Opening (labelled) → user → reply (labelled again: new run).
    expect(log.querySelectorAll('.lg-chat__label')).toHaveLength(2);
  });

  it('shows a typing indicator while awaiting the reply, then removes it', async () => {
    let resolveReply: (text: string) => void = () => {};
    const send = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveReply = resolve;
        }),
    );
    const panel = createChatPanel();
    panel.start(fakeSession({ send }));

    type(panel.el, 'hi');
    clickSend(panel.el);
    expect(query(panel.el, 'chat-typing')).not.toBeNull();
    expect(sendButton(panel.el).disabled).toBe(true);

    resolveReply('done');
    await vi.waitFor(() => {
      expect(query(panel.el, 'chat-typing')).toBeNull();
    });
    expect(query(panel.el, 'chat-log')!.textContent).toContain('done');
  });

  it('renders an error bubble when the session rejects, and re-enables input', async () => {
    const panel = createChatPanel();
    panel.start(
      fakeSession({ send: () => Promise.reject(new Error('Coach is offline — no key.')) }),
    );

    type(panel.el, 'hi');
    clickSend(panel.el);

    const log = query(panel.el, 'chat-log')!;
    await vi.waitFor(() => {
      expect(log.querySelector('.lg-chat__msg--error')?.textContent).toContain(
        'Coach is offline — no key.',
      );
    });
    expect(query(panel.el, 'chat-typing')).toBeNull();
    expect(input(panel.el).disabled).toBe(false);
  });

  it('falls back to a generic notice when the rejection has no message', async () => {
    const panel = createChatPanel();
    panel.start(fakeSession({ send: () => Promise.reject(new Error()) }));

    type(panel.el, 'hi');
    clickSend(panel.el);

    await vi.waitFor(() => {
      expect(query(panel.el, 'chat-log')!.textContent).toContain('Something went wrong');
    });
  });

  it('submits on Enter; Shift+Enter does not submit', async () => {
    const send = vi.fn(async () => 'ok');
    const panel = createChatPanel();
    panel.start(fakeSession({ send }));

    type(panel.el, 'line one');
    input(panel.el).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }),
    );
    expect(send).not.toHaveBeenCalled();

    input(panel.el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(send).toHaveBeenCalledWith('line one');
    await vi.waitFor(() => {
      expect(query(panel.el, 'chat-log')!.textContent).toContain('ok');
    });
  });

  it('disables Send while the input is empty and grows the textarea with newlines', () => {
    const panel = createChatPanel();
    panel.start(fakeSession());

    expect(sendButton(panel.el).disabled).toBe(true);
    type(panel.el, 'hello');
    expect(sendButton(panel.el).disabled).toBe(false);
    expect(Number(input(panel.el).rows)).toBe(1); // happy-dom reports rows as a string

    type(panel.el, 'a\nb\nc\nd\ne\nf');
    expect(Number(input(panel.el).rows)).toBe(4); // capped at 4 rows

    type(panel.el, '');
    expect(sendButton(panel.el).disabled).toBe(true);
  });

  it('auto-scrolls on new messages only when already near the bottom', async () => {
    const panel = createChatPanel();
    panel.start(fakeSession({ send: async () => 'reply' }));
    const log = query(panel.el, 'chat-log')!;

    // Simulate a scrolled-up log: happy-dom reports 0 layout metrics, so fake
    // a tall scrollHeight and a scroll position far from the bottom.
    Object.defineProperty(log, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(log, 'clientHeight', { value: 160, configurable: true });
    log.scrollTop = 100;

    type(panel.el, 'hi');
    clickSend(panel.el);
    await vi.waitFor(() => {
      expect(log.textContent).toContain('reply');
    });
    expect(log.scrollTop).toBe(100); // scrolled-up position preserved

    log.scrollTop = 830; // 1000 - 160 - 10 → within 40px of the bottom
    type(panel.el, 'again');
    clickSend(panel.el);
    expect(log.scrollTop).toBe(1000); // followed to the bottom
  });
});
