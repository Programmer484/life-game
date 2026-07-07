// Internal implementation. Deep imports from other modules are blocked by lint.
import type { CoachMode } from './prompts.ts';
import { OPENING_MESSAGES, SYSTEM_PROMPTS } from './prompts.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * The model call, injected so sessions are testable without a network.
 * Receives the system prompt and full history; resolves to the reply text.
 */
export type CoachTransport = (
  systemPrompt: string,
  messages: readonly ChatMessage[],
) => Promise<string>;

export interface CoachSession {
  mode: CoachMode;
  /** Assistant text shown before the user has said anything. */
  opening: string;
  history(): readonly ChatMessage[];
  /** Send a user message; resolves to the assistant reply. Rejections leave history without the failed turn. */
  send(text: string): Promise<string>;
}

/**
 * A stateful conversation with one of the two coaches. History accumulates
 * user/assistant turns; the transport is called with the full history each
 * time (the API is stateless).
 */
export function createCoachSession(mode: CoachMode, transport: CoachTransport): CoachSession {
  const messages: ChatMessage[] = [];

  return {
    mode,
    opening: OPENING_MESSAGES[mode],
    history: () => messages,
    async send(text: string): Promise<string> {
      const attempt = [...messages, { role: 'user', text } as const];
      const reply = await transport(SYSTEM_PROMPTS[mode], attempt);
      messages.push({ role: 'user', text }, { role: 'assistant', text: reply });
      return reply;
    },
  };
}
