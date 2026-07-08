import { describe, expect, it } from 'vitest';
import type { CoachEffects, CoachTransport, CoachTransportRequest } from '../index.ts';
import { createCoachSession } from '../index.ts';

function fakeTransport(replies: (string | { reply: string; effects?: CoachEffects })[]) {
  const calls: CoachTransportRequest[] = [];
  const transport: CoachTransport = (request) => {
    calls.push({ ...request, messages: [...request.messages] });
    const next = replies[calls.length - 1] ?? '(no reply)';
    return Promise.resolve(typeof next === 'string' ? { reply: next } : next);
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

  it('passes its own mode plus injected memory and config to the transport', async () => {
    const goal = fakeTransport(['ok']);
    await createCoachSession('goal', goal.transport, {
      memory: { facts: ['Night owl'] },
      config: { tone: 'direct' },
    }).send('hi');
    expect(goal.calls[0]?.mode).toBe('goal');
    expect(goal.calls[0]?.memory).toEqual({ facts: ['Night owl'] });
    expect(goal.calls[0]?.config).toEqual({ tone: 'direct' });

    const reflection = fakeTransport(['ok']);
    await createCoachSession('reflection', reflection.transport).send('hi');
    expect(reflection.calls[0]?.mode).toBe('reflection');
    expect(reflection.calls[0]?.memory).toEqual({ facts: [] });
  });

  it('surfaces effects through onEffects and still resolves to the reply text', async () => {
    const effects: CoachEffects = { memories: ['Prefers mornings'] };
    const { transport } = fakeTransport([{ reply: 'Noted!', effects }]);
    const received: CoachEffects[] = [];
    const session = createCoachSession('reflection', transport, {
      memory: { facts: [] },
      config: {},
      onEffects: (incoming) => received.push(incoming),
    });
    await expect(session.send('I wake up late')).resolves.toBe('Noted!');
    expect(received).toEqual([effects]);
  });

  it('does not invoke onEffects when the response carries none', async () => {
    const { transport } = fakeTransport(['plain reply']);
    const received: CoachEffects[] = [];
    const session = createCoachSession('goal', transport, {
      memory: { facts: [] },
      config: {},
      onEffects: (incoming) => received.push(incoming),
    });
    await session.send('hi');
    expect(received).toEqual([]);
  });

  it('leaves history unchanged when the transport rejects', async () => {
    const session = createCoachSession('goal', () => Promise.reject(new Error('network down')));
    await expect(session.send('hello')).rejects.toThrow('network down');
    expect(session.history()).toEqual([]);
  });
});
