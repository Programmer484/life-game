// Public surface of the coach module. Other modules import ONLY from here.
export type { CoachModelCall, CoachResult, ModelResponse } from './internal/handler.ts';
export { handleCoachChat } from './internal/handler.ts';
export type { CoachConfig, CoachMemory } from './internal/instructions.ts';
export { appendMemoryFacts, MEMORY_FACT_CAP } from './internal/instructions.ts';
export type { CoachMode } from './internal/prompts.ts';
export { createProxyTransport } from './internal/proxy-transport.ts';
export type {
  ChatMessage,
  CoachSession,
  CoachSessionDeps,
  CoachTransport,
  CoachTransportRequest,
  CoachTransportResult,
} from './internal/session.ts';
export { createCoachSession } from './internal/session.ts';
export type { CoachEffects, GoalTemplateDraft } from './internal/tools.ts';
