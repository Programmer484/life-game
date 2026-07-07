import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage, CoachModelCall } from '../index.ts';
import { handleCoachChat } from '../index.ts';

const KEY = 'sk-test-key';
const USER_TURN: ChatMessage[] = [{ role: 'user', text: 'hi' }];

function fakeModel(reply = 'A reply.') {
  const calls: { systemPrompt: string; messages: readonly ChatMessage[] }[] = [];
  const call: CoachModelCall = (systemPrompt, messages) => {
    calls.push({ systemPrompt, messages });
    return Promise.resolve(reply);
  };
  return { call, calls };
}

describe('handleCoachChat', () => {
  it('returns 503 when no API key is configured', async () => {
    const result = await handleCoachChat(
      { mode: 'goal', messages: USER_TURN },
      '',
      fakeModel().call,
    );
    expect(result.status).toBe(503);
    expect(result.body).toEqual({
      error: 'Coach is offline — ANTHROPIC_API_KEY is not configured on the server.',
    });
  });

  it('returns 400 for a bad mode', async () => {
    const result = await handleCoachChat(
      { mode: 'chef', messages: USER_TURN },
      KEY,
      fakeModel().call,
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "Invalid request: mode must be 'goal' or 'reflection'." });
  });

  it('returns 400 for empty or malformed messages', async () => {
    const empty = await handleCoachChat({ mode: 'goal', messages: [] }, KEY, fakeModel().call);
    expect(empty.status).toBe(400);
    const malformed = await handleCoachChat(
      { mode: 'goal', messages: [{ role: 'system', text: 'x' }] },
      KEY,
      fakeModel().call,
    );
    expect(malformed.status).toBe(400);
  });

  it('returns 400 when the last message is not from the user', async () => {
    const result = await handleCoachChat(
      { mode: 'goal', messages: [...USER_TURN, { role: 'assistant', text: 'hello' }] },
      KEY,
      fakeModel().call,
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: 'Invalid request: the last message must be from the user.',
    });
  });

  it('returns 200 with the model reply and resolves the mode-specific prompt', async () => {
    const goal = fakeModel('Goal reply');
    const goalResult = await handleCoachChat({ mode: 'goal', messages: USER_TURN }, KEY, goal.call);
    expect(goalResult).toEqual({ status: 200, body: { reply: 'Goal reply' } });
    expect(goal.calls[0]?.systemPrompt).toContain('goal-clarification coach');
    expect(goal.calls[0]?.messages).toEqual(USER_TURN);

    const reflection = fakeModel('Reflection reply');
    const reflectionResult = await handleCoachChat(
      { mode: 'reflection', messages: USER_TURN },
      KEY,
      reflection.call,
    );
    expect(reflectionResult).toEqual({ status: 200, body: { reply: 'Reflection reply' } });
    expect(reflection.calls[0]?.systemPrompt).toContain('reflection coach');
  });

  it('returns 502 without leaking internals when the model call throws', async () => {
    const call = vi.fn(() => Promise.reject(new Error('secret upstream detail')));
    const result = await handleCoachChat({ mode: 'goal', messages: USER_TURN }, KEY, call);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ error: 'Coach request failed upstream.' });
  });
});
