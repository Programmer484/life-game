// Internal implementation. Deep imports from other modules are blocked by lint.
// Server-side coach handler, shared by the Vite dev proxy and the Vercel
// function. This is the only place the Anthropic key is used.
import Anthropic from '@anthropic-ai/sdk';
import type { CoachConfig, CoachMemory } from './instructions.ts';
import { buildSystemPrompt } from './instructions.ts';
import type { CoachMode } from './prompts.ts';
import type { ChatMessage } from './session.ts';
import type { CoachEffects, CoachToolDefinition } from './tools.ts';
import { toolsForMode, validateGoalTemplate, validateMemoryFact } from './tools.ts';

const MODEL = 'claude-opus-4-8';
// Coach turns are deliberately short (one question at a time).
const MAX_TOKENS = 4096;
// Hard bound on model round-trips per user turn (tool_use → tool_result → …).
const MAX_TOOL_ITERATIONS = 4;
// Invalid tool inputs get one retry (two attempts total), then we give up.
const MAX_INVALID_ATTEMPTS = 2;

/**
 * One content block of a model response. `text` and `tool_use` are the shapes
 * the handler acts on; anything else (e.g. thinking blocks) passes through
 * verbatim when the conversation is replayed to the model.
 */
export type ModelBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: string; [key: string]: unknown };

export interface ModelResponse {
  stop_reason: string | null;
  content: ModelBlock[];
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

interface ModelMessage {
  role: 'user' | 'assistant';
  content: string | (ModelBlock | ToolResultBlock)[];
}

/** The model call, injectable so the handler is testable without a network. */
export type CoachModelCall = (params: {
  system: string;
  messages: readonly ModelMessage[];
  tools: readonly CoachToolDefinition[];
}) => Promise<ModelResponse>;

export interface CoachResult {
  status: number;
  body: { reply: string; effects?: CoachEffects } | { error: string };
}

interface CoachRequest {
  mode: CoachMode;
  messages: readonly ChatMessage[];
  memory: CoachMemory;
  config: CoachConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  const { role, text } = value;
  return (role === 'user' || role === 'assistant') && typeof text === 'string';
}

/** Absent memory/config default to empty; present-but-malformed is a 400. */
function parseMemory(raw: unknown): CoachMemory | { error: string } {
  if (raw === undefined) return { facts: [] };
  if (isRecord(raw) && Array.isArray(raw['facts'])) {
    const facts = raw['facts'].filter((fact): fact is string => typeof fact === 'string');
    if (facts.length === raw['facts'].length) return { facts };
  }
  return { error: 'Invalid request: memory must be { facts: string[] }.' };
}

function parseConfig(raw: unknown): CoachConfig | { error: string } {
  if (raw === undefined) return {};
  if (!isRecord(raw)) return { error: 'Invalid request: config must be an object.' };
  const config: CoachConfig = {};
  const { tone, customInstructions } = raw;
  if (tone !== undefined) {
    if (tone !== 'gentle' && tone !== 'direct' && tone !== 'playful') {
      return { error: "Invalid request: config.tone must be 'gentle', 'direct', or 'playful'." };
    }
    config.tone = tone;
  }
  if (customInstructions !== undefined) {
    if (typeof customInstructions !== 'string') {
      return { error: 'Invalid request: config.customInstructions must be a string.' };
    }
    config.customInstructions = customInstructions;
  }
  return config;
}

/** Returns the validated request, or an error message describing what's wrong. */
function parseRequest(rawBody: unknown): CoachRequest | { error: string } {
  const { mode, messages, memory, config } = (rawBody ?? {}) as {
    mode?: unknown;
    messages?: unknown;
    memory?: unknown;
    config?: unknown;
  };
  if (mode !== 'goal' && mode !== 'reflection') {
    return { error: "Invalid request: mode must be 'goal' or 'reflection'." };
  }
  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isChatMessage)) {
    return { error: 'Invalid request: messages must be a non-empty array of chat messages.' };
  }
  if (messages[messages.length - 1]?.role !== 'user') {
    return { error: 'Invalid request: the last message must be from the user.' };
  }
  const parsedMemory = parseMemory(memory);
  if ('error' in parsedMemory) return parsedMemory;
  const parsedConfig = parseConfig(config);
  if ('error' in parsedConfig) return parsedConfig;
  return { mode, messages, memory: parsedMemory, config: parsedConfig };
}

/** Real model call against the Anthropic API. Server-side only. */
function defaultAnthropicCall(apiKey: string): CoachModelCall {
  const client = new Anthropic({ apiKey });

  return async ({ system, messages, tools }) => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: tools as Anthropic.Tool[],
      messages: messages as Anthropic.MessageParam[],
    });
    return { stop_reason: response.stop_reason, content: response.content as ModelBlock[] };
  };
}

function isToolUse(
  block: ModelBlock,
): block is { type: 'tool_use'; id: string; name: string; input: unknown } {
  return block.type === 'tool_use';
}

/** Execute one tool call: accumulate into effects, return the tool_result. */
function runTool(
  block: { id: string; name: string; input: unknown },
  offered: readonly CoachToolDefinition[],
  effects: CoachEffects,
  invalidAttempts: Map<string, number>,
): ToolResultBlock {
  const fail = (error: string): ToolResultBlock => {
    const attempts = (invalidAttempts.get(block.name) ?? 0) + 1;
    invalidAttempts.set(block.name, attempts);
    return {
      type: 'tool_result',
      tool_use_id: block.id,
      content:
        attempts >= MAX_INVALID_ATTEMPTS
          ? `Invalid input: ${error} You are out of retries — continue the conversation without this tool.`
          : `Invalid input: ${error} Fix the input and call the tool again.`,
      is_error: true,
    };
  };
  const ok = (): ToolResultBlock => ({
    type: 'tool_result',
    tool_use_id: block.id,
    content: JSON.stringify({ ok: true }),
  });

  // A tool this mode does not offer should be unreachable; refuse defensively.
  if (!offered.some((tool) => tool.name === block.name)) {
    return fail(`Tool '${block.name}' is not available in this mode.`);
  }
  if (block.name === 'create_goal_template') {
    const result = validateGoalTemplate(block.input);
    if (!result.ok) return fail(result.error);
    effects.goalTemplate = result.value;
    return ok();
  }
  const result = validateMemoryFact(block.input);
  if (!result.ok) return fail(result.error);
  (effects.memories ??= []).push(result.value);
  return ok();
}

/**
 * Handle one coach chat request: validate, build the layered system prompt,
 * run the tool-use loop (at most MAX_TOOL_ITERATIONS model calls). Tools never
 * mutate server state — their outcomes accumulate into `effects`, applied
 * client-side. Upstream errors are never leaked to the client.
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
  const system = buildSystemPrompt(parsed);
  const tools = toolsForMode(parsed.mode);
  const conversation: ModelMessage[] = parsed.messages.map((message) => ({
    role: message.role,
    content: message.text,
  }));
  const effects: CoachEffects = {};
  const invalidAttempts = new Map<string, number>();

  try {
    let response = await call({ system, messages: conversation, tools });
    for (let i = 1; i < MAX_TOOL_ITERATIONS && response.stop_reason === 'tool_use'; i++) {
      const results = response.content
        .filter(isToolUse)
        .map((block) => runTool(block, tools, effects, invalidAttempts));
      conversation.push({ role: 'assistant', content: response.content });
      conversation.push({ role: 'user', content: results });
      response = await call({ system, messages: conversation, tools });
    }
    const reply = response.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const hasEffects = effects.goalTemplate !== undefined || effects.memories !== undefined;
    return { status: 200, body: hasEffects ? { reply, effects } : { reply } };
  } catch {
    return { status: 502, body: { error: 'Coach request failed upstream.' } };
  }
}
