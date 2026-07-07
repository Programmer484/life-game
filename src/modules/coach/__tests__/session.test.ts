import { describe, expect, it } from 'vitest';
import type { ChatMessage, CoachMode } from '../index.ts';
import { createCoachSession } from '../index.ts';

function fakeTransport(replies: string[]) {
  const calls: { mode: CoachMode; messages: readonly ChatMessage[] }[] = [];
  const transport = (mode: CoachMode, messages: readonly ChatMessage[]) => {
    calls.push({ mode, messages: [...messages] });
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

  it('passes its own mode to the transport', async () => {
    const goal = fakeTransport(['ok']);
    const reflection = fakeTransport(['ok']);
    await createCoachSession('goal', goal.transport).send('hi');
    await createCoachSession('reflection', reflection.transport).send('hi');
    expect(goal.calls[0]?.mode).toBe('goal');
    expect(reflection.calls[0]?.mode).toBe('reflection');
  });

  it('leaves history unchanged when the transport rejects', async () => {
    const session = createCoachSession('goal', () => Promise.reject(new Error('network down')));
    await expect(session.send('hello')).rejects.toThrow('network down');
    expect(session.history()).toEqual([]);
  });
});
