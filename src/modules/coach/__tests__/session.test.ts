import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../index.ts';
import { createCoachSession } from '../index.ts';

function fakeTransport(replies: string[]) {
  const calls: { systemPrompt: string; messages: readonly ChatMessage[] }[] = [];
  const transport = (systemPrompt: string, messages: readonly ChatMessage[]) => {
    calls.push({ systemPrompt, messages: [...messages] });
    return Promise.resolve(replies[calls.length - 1] ?? '(no reply)');
  };
  return { transport, calls };
}

describe('createCoachSession', () => {
  it('has a mode-specific opening and empty history', () => {
    const goal = createCoachSession('goal', fakeTransport([]).transport);
    const reflection = createCoachSession('reflection', fakeTransport([]).transport);
    expect(goal.opening).not.toBe(reflection.opening);
    expect(goal.history()).toEqual([]);
  });

  it('sends the full history to the transport and accumulates turns', async () => {
    const { transport, calls } = fakeTransport(['What area of your life?', 'By when?']);
    const session = createCoachSession('goal', transport);

    const first = await session.send('I want to plant a goal');
    expect(first).toBe('What area of your life?');
    expect(calls[0]?.messages).toEqual([{ role: 'user', text: 'I want to plant a goal' }]);

    await session.send('Health');
    expect(calls[1]?.messages).toEqual([
      { role: 'user', text: 'I want to plant a goal' },
      { role: 'assistant', text: 'What area of your life?' },
      { role: 'user', text: 'Health' },
    ]);
    expect(session.history()).toHaveLength(4);
  });

  it('uses a different system prompt per mode', async () => {
    const goal = fakeTransport(['ok']);
    const reflection = fakeTransport(['ok']);
    await createCoachSession('goal', goal.transport).send('hi');
    await createCoachSession('reflection', reflection.transport).send('hi');
    expect(goal.calls[0]?.systemPrompt).toContain('goal-clarification coach');
    expect(reflection.calls[0]?.systemPrompt).toContain('reflection coach');
    expect(goal.calls[0]?.systemPrompt).not.toBe(reflection.calls[0]?.systemPrompt);
  });

  it('leaves history unchanged when the transport rejects', async () => {
    const session = createCoachSession('goal', () => Promise.reject(new Error('network down')));
    await expect(session.send('hello')).rejects.toThrow('network down');
    expect(session.history()).toEqual([]);
  });
});
