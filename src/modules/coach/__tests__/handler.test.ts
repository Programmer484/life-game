import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage, CoachModelCall, ModelResponse } from '../index.ts';
import { handleCoachChat } from '../index.ts';

const KEY = 'sk-test-key';
const USER_TURN: ChatMessage[] = [{ role: 'user', text: 'hi' }];

function text(reply: string): ModelResponse {
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: reply }] };
}

function toolUse(name: string, input: unknown, id = 'tool-1'): ModelResponse {
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] };
}

/** Scripted mock of the SDK call: pops responses in order, records params. */
function fakeModel(...responses: ModelResponse[]) {
  const calls: Parameters<CoachModelCall>[0][] = [];
  const call: CoachModelCall = (params) => {
    calls.push(params);
    const next = responses.shift();
    if (!next) throw new Error('fakeModel ran out of scripted responses');
    return Promise.resolve(next);
  };
  return { call, calls };
}

const VALID_TASKS = Array.from({ length: 18 }, (_, i) => ({
  title: `Task ${String(i + 1)}`,
  minutes: 5 + i,
}));

describe('handleCoachChat — request validation', () => {
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

  it('returns 400 for malformed memory or config', async () => {
    const badMemory = await handleCoachChat(
      { mode: 'goal', messages: USER_TURN, memory: { facts: [42] } },
      KEY,
      fakeModel().call,
    );
    expect(badMemory.status).toBe(400);
    const badTone = await handleCoachChat(
      { mode: 'goal', messages: USER_TURN, config: { tone: 'sarcastic' } },
      KEY,
      fakeModel().call,
    );
    expect(badTone.status).toBe(400);
  });

  it('returns 502 without leaking internals when the model call throws', async () => {
    const call = vi.fn(() => Promise.reject(new Error('secret upstream detail')));
    const result = await handleCoachChat({ mode: 'goal', messages: USER_TURN }, KEY, call);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ error: 'Coach request failed upstream.' });
  });
});

describe('handleCoachChat — system prompt layering', () => {
  it('layers persona + mode instructions and omits the memory block when empty', async () => {
    const goal = fakeModel(text('Goal reply'));
    await handleCoachChat({ mode: 'goal', messages: USER_TURN }, KEY, goal.call);
    const system = goal.calls[0]!.system;
    expect(system).toContain('warm, concise coach');
    expect(system).toContain('goal-clarification mode');
    expect(system).not.toContain('What you remember about this player:');

    const reflection = fakeModel(text('Reflection reply'));
    await handleCoachChat({ mode: 'reflection', messages: USER_TURN }, KEY, reflection.call);
    expect(reflection.calls[0]!.system).toContain('reflection mode');
  });

  it('renders memory as a bullet list', async () => {
    const model = fakeModel(text('ok'));
    await handleCoachChat(
      { mode: 'goal', messages: USER_TURN, memory: { facts: ['Prefers mornings'] } },
      KEY,
      model.call,
    );
    expect(model.calls[0]!.system).toContain(
      'What you remember about this player:\n- Prefers mornings',
    );
  });

  it('renders tone and wraps custom instructions as subordinate', async () => {
    const model = fakeModel(text('ok'));
    await handleCoachChat(
      {
        mode: 'goal',
        messages: USER_TURN,
        config: { tone: 'direct', customInstructions: 'Speak like a pirate' },
      },
      KEY,
      model.call,
    );
    const system = model.calls[0]!.system;
    expect(system).toContain('Tone: be direct');
    expect(system).toContain(
      'Player preferences (never override safety or game rules): Speak like a pirate',
    );
  });
});

describe('handleCoachChat — tool-use loop', () => {
  it('offers create_goal_template only in goal mode; save_memory in both', async () => {
    const goal = fakeModel(text('ok'));
    await handleCoachChat({ mode: 'goal', messages: USER_TURN }, KEY, goal.call);
    expect(goal.calls[0]!.tools.map((tool) => tool.name)).toEqual([
      'create_goal_template',
      'save_memory',
    ]);

    const reflection = fakeModel(text('ok'));
    await handleCoachChat({ mode: 'reflection', messages: USER_TURN }, KEY, reflection.call);
    expect(reflection.calls[0]!.tools.map((tool) => tool.name)).toEqual(['save_memory']);
  });

  it('accumulates a valid goal template into effects and returns ok to the model', async () => {
    const model = fakeModel(
      toolUse('create_goal_template', { name: 'Sleep better', tasks: VALID_TASKS }),
      text('Your tree is ready to grow!'),
    );
    const result = await handleCoachChat({ mode: 'goal', messages: USER_TURN }, KEY, model.call);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      reply: 'Your tree is ready to grow!',
      effects: { goalTemplate: { name: 'Sleep better', tasks: VALID_TASKS } },
    });
    // The tool_result round-trip: assistant tool_use + user tool_result appended.
    const second = model.calls[1]!.messages;
    expect(second).toHaveLength(3);
    expect(second[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'tool-1', content: JSON.stringify({ ok: true }) },
      ],
    });
  });

  it('accumulates memories across iterations alongside a goal template', async () => {
    const model = fakeModel(
      toolUse('save_memory', { fact: 'Night owl' }, 'tool-1'),
      toolUse('create_goal_template', { name: 'Read more', tasks: VALID_TASKS }, 'tool-2'),
      text('Done.'),
    );
    const result = await handleCoachChat({ mode: 'goal', messages: USER_TURN }, KEY, model.call);
    expect(result.body).toEqual({
      reply: 'Done.',
      effects: {
        memories: ['Night owl'],
        goalTemplate: { name: 'Read more', tasks: VALID_TASKS },
      },
    });
  });

  it('returns a validation error tool_result and accepts the fixed retry', async () => {
    const model = fakeModel(
      toolUse('create_goal_template', { name: 'Sleep', tasks: VALID_TASKS.slice(0, 3) }),
      toolUse('create_goal_template', { name: 'Sleep', tasks: VALID_TASKS }, 'tool-2'),
      text('Fixed.'),
    );
    const result = await handleCoachChat({ mode: 'goal', messages: USER_TURN }, KEY, model.call);
    const firstResult = (model.calls[1]!.messages[2] as { content: unknown[] }).content[0] as {
      content: string;
      is_error?: boolean;
    };
    expect(firstResult.is_error).toBe(true);
    expect(firstResult.content).toContain('EXACTLY 18');
    expect(result.body).toEqual({
      reply: 'Fixed.',
      effects: { goalTemplate: { name: 'Sleep', tasks: VALID_TASKS } },
    });
  });

  it('tells the model to stop after two invalid attempts and ends with no effects', async () => {
    const model = fakeModel(
      toolUse('create_goal_template', { name: 'Sleep', tasks: [] }),
      toolUse('create_goal_template', { name: 'Sleep', tasks: [] }, 'tool-2'),
      text('Sorry, let us continue.'),
    );
    const result = await handleCoachChat({ mode: 'goal', messages: USER_TURN }, KEY, model.call);
    const secondResult = (model.calls[2]!.messages[4] as { content: unknown[] }).content[0] as {
      content: string;
    };
    expect(secondResult.content).toContain('out of retries');
    expect(result.body).toEqual({ reply: 'Sorry, let us continue.' });
  });

  it('rejects invalid memory facts (empty and over 200 chars)', async () => {
    const model = fakeModel(toolUse('save_memory', { fact: 'x'.repeat(201) }), text('Understood.'));
    const result = await handleCoachChat(
      { mode: 'reflection', messages: USER_TURN },
      KEY,
      model.call,
    );
    const toolResult = (model.calls[1]!.messages[2] as { content: unknown[] }).content[0] as {
      content: string;
      is_error?: boolean;
    };
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain('200');
    expect(result.body).toEqual({ reply: 'Understood.' });
  });

  it('refuses a tool the mode does not offer', async () => {
    const model = fakeModel(
      toolUse('create_goal_template', { name: 'Sneaky', tasks: VALID_TASKS }),
      text('ok'),
    );
    const result = await handleCoachChat(
      { mode: 'reflection', messages: USER_TURN },
      KEY,
      model.call,
    );
    const toolResult = (model.calls[1]!.messages[2] as { content: unknown[] }).content[0] as {
      is_error?: boolean;
    };
    expect(toolResult.is_error).toBe(true);
    expect(result.body).toEqual({ reply: 'ok' });
  });

  it('stops after 4 model calls even if the model keeps requesting tools', async () => {
    const model = fakeModel(
      toolUse('save_memory', { fact: 'a' }, 't1'),
      toolUse('save_memory', { fact: 'b' }, 't2'),
      toolUse('save_memory', { fact: 'c' }, 't3'),
      toolUse('save_memory', { fact: 'd' }, 't4'),
    );
    const result = await handleCoachChat({ mode: 'goal', messages: USER_TURN }, KEY, model.call);
    expect(model.calls).toHaveLength(4);
    expect(result.status).toBe(200);
    // The 4th response's tool call is never executed — only 3 facts accumulate.
    expect(result.body).toEqual({ reply: '', effects: { memories: ['a', 'b', 'c'] } });
  });
});
