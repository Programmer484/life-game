// Public surface of the coach module. Other modules import ONLY from here.
export { createAnthropicTransport } from './internal/anthropic.ts';
export type { CoachMode } from './internal/prompts.ts';
export type { ChatMessage, CoachSession, CoachTransport } from './internal/session.ts';
export { createCoachSession } from './internal/session.ts';
