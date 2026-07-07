// Public surface of the coach module. Other modules import ONLY from here.
export type { CoachModelCall, CoachResult } from './internal/handler.ts';
export { handleCoachChat } from './internal/handler.ts';
export type { CoachMode } from './internal/prompts.ts';
export { createProxyTransport } from './internal/proxy-transport.ts';
export type { ChatMessage, CoachSession, CoachTransport } from './internal/session.ts';
export { createCoachSession } from './internal/session.ts';
