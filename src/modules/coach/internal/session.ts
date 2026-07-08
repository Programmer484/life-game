// Internal implementation. Deep imports from other modules are blocked by lint.
import type { CoachConfig, CoachMemory } from './instructions.ts';
import type { CoachMode } from './prompts.ts';
import { OPENING_MESSAGES } from './prompts.ts';
import type { CoachEffects } from './tools.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** What one send() carries to the server (the API is stateless). */
export interface CoachTransportRequest {
  mode: CoachMode;
  messages: readonly ChatMessage[];
  memory: CoachMemory;
  config: CoachConfig;
}

export interface CoachTransportResult {
  reply: string;
  effects?: CoachEffects;
}

/**
 * The model call, injected so sessions are testable without a network.
 * Receives the mode, full history, memory, and config; resolves to the reply
 * text plus any structured effects. System prompts are resolved server-side
 * (see handler.ts) so they never need to cross this boundary.
 */
export type CoachTransport = (request: CoachTransportRequest) => Promise<CoachTransportResult>;

/** Injected per-session context; effects surface through the callback. */
export interface CoachSessionDeps {
  memory: CoachMemory;
  config: CoachConfig;
  onEffects?: (effects: CoachEffects) => void;
}

export interface CoachSession {
  mode: CoachMode;
  /** Assistant text shown before the user has said anything. */
  opening: string;
  history(): readonly ChatMessage[];
  /** Send a user message; resolves to the assistant reply. Rejections leave history without the failed turn. */
  send(text: string): Promise<string>;
}

const EMPTY_DEPS: CoachSessionDeps = { memory: { facts: [] }, config: {} };

/**
 * A stateful conversation with one of the two coaches. History accumulates
 * user/assistant turns; the transport is called with the full history each
 * time. Effects (goal templates, saved memories) surface via deps.onEffects;
 * send() still resolves to plain reply text (chat-panel duck-typing).
 */
export function createCoachSession(
  mode: CoachMode,
  transport: CoachTransport,
  deps: CoachSessionDeps = EMPTY_DEPS,
): CoachSession {
  const messages: ChatMessage[] = [];

  return {
    mode,
    opening: OPENING_MESSAGES[mode],
    history: () => messages,
    async send(text: string): Promise<string> {
      const attempt = [...messages, { role: 'user', text } as const];
      const result = await transport({
        mode,
        messages: attempt,
        memory: deps.memory,
        config: deps.config,
      });
      messages.push({ role: 'user', text }, { role: 'assistant', text: result.reply });
      if (result.effects !== undefined) deps.onEffects?.(result.effects);
      return result.reply;
    },
  };
}
