// Internal implementation. Deep imports from other modules are blocked by lint.
// Server-side coach handler, shared by the Vite dev proxy and the Vercel
// function. This is the only place the Anthropic key is used.
import Anthropic from '@anthropic-ai/sdk';
import type { CoachMode } from './prompts.ts';
import { SYSTEM_PROMPTS } from './prompts.ts';
import type { ChatMessage } from './session.ts';

const MODEL = 'claude-opus-4-8';
// Coach turns are deliberately short (one question at a time).
const MAX_TOKENS = 4096;

/** The model call, injectable so the handler is testable without a network. */
export type CoachModelCall = (
  systemPrompt: string,
  messages: readonly ChatMessage[],
) => Promise<string>;

export interface CoachResult {
  status: number;
  body: { reply: string } | { error: string };
}

interface CoachRequest {
  mode: CoachMode;
  messages: readonly ChatMessage[];
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const { role, text } = value as { role?: unknown; text?: unknown };
  return (role === 'user' || role === 'assistant') && typeof text === 'string';
}

/** Returns the validated request, or an error message describing what's wrong. */
function parseRequest(rawBody: unknown): CoachRequest | { error: string } {
  const { mode, messages } = (rawBody ?? {}) as { mode?: unknown; messages?: unknown };
  if (mode !== 'goal' && mode !== 'reflection') {
    return { error: "Invalid request: mode must be 'goal' or 'reflection'." };
  }
  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isChatMessage)) {
    return { error: 'Invalid request: messages must be a non-empty array of chat messages.' };
  }
  if (messages[messages.length - 1]?.role !== 'user') {
    return { error: 'Invalid request: the last message must be from the user.' };
  }
  return { mode, messages };
}

/** Real model call against the Anthropic API. Server-side only. */
function defaultAnthropicCall(apiKey: string): CoachModelCall {
  const client = new Anthropic({ apiKey });

  return async (systemPrompt, messages) => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: messages.map((message) => ({ role: message.role, content: message.text })),
    });
    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
  };
}

/**
 * Handle one coach chat request: validate, resolve the mode's system prompt,
 * call the model. Upstream errors are never leaked to the client.
 */
export async function handleCoachChat(
  rawBody: unknown,
  apiKey: string | undefined,
  callModel?: CoachModelCall,
): Promise<CoachResult> {
  if (apiKey === undefined || apiKey === '') {
    return {
      status: 503,
      body: { error: 'Coach is offline — ANTHROPIC_API_KEY is not configured on the server.' },
    };
  }
  const parsed = parseRequest(rawBody);
  if ('error' in parsed) return { status: 400, body: parsed };

  const call = callModel ?? defaultAnthropicCall(apiKey);
  try {
    const reply = await call(SYSTEM_PROMPTS[parsed.mode], parsed.messages);
    return { status: 200, body: { reply } };
  } catch {
    return { status: 502, body: { error: 'Coach request failed upstream.' } };
  }
}
