// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
// createChatPanel is not on the public surface (only core-app-facing pieces
// are); own-module internal access is allowed for otherwise-unreachable logic.
import type { ChatSession } from '../internal/chat-panel.ts';
import { createChatPanel } from '../internal/chat-panel.ts';

function query(el: HTMLElement, testid: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

function input(el: HTMLElement): HTMLInputElement {
  return query(el, 'chat-input') as HTMLInputElement;
}

function fakeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return { opening: 'Hello there.', send: async () => 'A reply.', ...overrides };
}

describe('ui / chat panel', () => {
  it('starts offline: notice shown, input and send disabled', () => {
    const panel = createChatPanel();

    expect(query(panel.el, 'chat-log')?.textContent).toContain('Chat is unavailable.');
    expect(input(panel.el).disabled).toBe(true);
    expect((query(panel.el, 'chat-send') as HTMLButtonElement).disabled).toBe(true);
  });

  it('sends a message and appends the user line and the session reply', async () => {
    const send = vi.fn(async () => 'Sounds great!');
    const panel = createChatPanel();
    panel.start(fakeSession({ opening: 'What is on your mind?', send }));

    const log = query(panel.el, 'chat-log')!;
    expect(log.textContent).toContain('What is on your mind?');

    input(panel.el).value = 'I slept well';
    query(panel.el, 'chat-send')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(send).toHaveBeenCalledWith('I slept well');
    expect(log.textContent).toContain('You: I slept well');
    expect(input(panel.el).value).toBe('');
    await vi.waitFor(() => {
      expect(log.textContent).toContain('Sounds great!');
    });
    expect(input(panel.el).disabled).toBe(false);
  });

  it('shows the error message when the session rejects with one, and re-enables input', async () => {
    const panel = createChatPanel();
    panel.start(
      fakeSession({ send: () => Promise.reject(new Error('Coach is offline — no key.')) }),
    );

    input(panel.el).value = 'hi';
    query(panel.el, 'chat-send')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const log = query(panel.el, 'chat-log')!;
    await vi.waitFor(() => {
      expect(log.textContent).toContain('Coach is offline — no key.');
    });
    expect(input(panel.el).disabled).toBe(false);
  });

  it('falls back to a generic notice when the rejection has no message', async () => {
    const panel = createChatPanel();
    panel.start(fakeSession({ send: () => Promise.reject(new Error()) }));

    input(panel.el).value = 'hi';
    query(panel.el, 'chat-send')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(query(panel.el, 'chat-log')!.textContent).toContain('Something went wrong');
    });
  });

  it('submits on Enter', async () => {
    const send = vi.fn(async () => 'ok');
    const panel = createChatPanel();
    panel.start(fakeSession({ send }));

    input(panel.el).value = 'via keyboard';
    input(panel.el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(send).toHaveBeenCalledWith('via keyboard');
    await vi.waitFor(() => {
      expect(query(panel.el, 'chat-log')!.textContent).toContain('ok');
    });
  });
});
