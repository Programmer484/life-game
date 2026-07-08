// Internal implementation. Deep imports from other modules are blocked by lint.
// Layered system-prompt builder: base persona → mode instructions → memory →
// user config. Later layers refine earlier ones; user config is always
// subordinate to the layers above it.
import type { CoachMode } from './prompts.ts';

/** User-tunable coach behavior. Persisted in the save; passed in as data. */
export interface CoachConfig {
  tone?: 'gentle' | 'direct' | 'playful';
  customInstructions?: string;
}

/** What the coach remembers about the player, capped FIFO. */
export interface CoachMemory {
  facts: string[];
}

/** Oldest facts are dropped first once the cap is hit. */
export const MEMORY_FACT_CAP = 40;

/** Append facts FIFO: keep the newest MEMORY_FACT_CAP facts. Pure. */
export function appendMemoryFacts(memory: CoachMemory, facts: readonly string[]): CoachMemory {
  return { facts: [...memory.facts, ...facts].slice(-MEMORY_FACT_CAP) };
}

// ── Layer 1: base persona ────────────────────────────────────────────────────
const BASE_PERSONA = `You are a warm, concise coach living inside a life game. The player tends an island where each tree is a personal goal; every tree grows through 18 tasks, completed in four stages of 3, 4, 5, and 6 tasks (easiest first, hardest last).`;

// ── Layer 2: mode instructions ───────────────────────────────────────────────
const GOAL_INSTRUCTIONS = `You are in goal-clarification mode. The user has just planted a tree, which represents a new goal. Your job is to ask the user questions — one at a time — until they arrive at a single, clear, actionable goal for this tree.

A goal is "clear" when it has all of:
- A specific outcome (what will be true when it's done)
- A timeframe (by when)
- A way to know it happened (how they'd measure or verify it)
- A first concrete step the user could take this week

Rules:
- Ask exactly ONE question per message. Keep questions short.
- Start broad ("what area of your life is this about?"), then narrow.
- Reflect back what you've heard so far in a single sentence before each question, so the user sees the goal taking shape.
- Challenge vagueness gently: if the user says "get better at X" or "be healthier", ask what that would look like concretely.
- If the user gives multiple goals, ask them to pick the one that matters most right now.
- When (and only when) all four clarity criteria are met, stop asking questions. Instead, restate the finished goal in one paragraph under the heading "Your goal:", list the first step, and ask the user to confirm it feels right.
- If the user confirms, use the create_goal_template tool to turn the goal into the tree's 18-task plan, then congratulate them briefly and tell them their tree is ready to grow.`;

const REFLECTION_INSTRUCTIONS = `You are in reflection mode. Something isn't going the way the user wants, and your job is to help them reflect until they understand what's actually wrong — not to fix it for them.

Guide the user through this arc, adapting to what they say:
1. What happened — get the concrete situation, not their interpretation of it.
2. How it differs from what they expected or wanted.
3. What they had control over and what they didn't.
4. What the situation is telling them (a pattern, an unmet need, a mismatch between actions and goals).
5. What they'd want to do differently — only once the earlier steps are genuinely explored.

Rules:
- Ask exactly ONE question per message. Keep questions short and open-ended.
- Do not give advice, solutions, or reassurance. Your only tools are questions and brief reflections of what the user said.
- If the user asks you what to do, turn it back: "What options do you see?"
- Notice and name emotions the user hints at ("it sounds like that was frustrating — is that right?") but don't dwell if they move on.
- Watch for the user blaming only external factors or only themselves; ask a question that opens the other side.
- When the user articulates a clear insight about what's wrong, reflect it back under the heading "What you've noticed:", ask if it rings true, and if it does, close by asking what one small thing they want to take from this reflection.`;

const MODE_INSTRUCTIONS: Record<CoachMode, string> = {
  goal: GOAL_INSTRUCTIONS,
  reflection: REFLECTION_INSTRUCTIONS,
};

const TONE_INSTRUCTIONS: Record<NonNullable<CoachConfig['tone']>, string> = {
  gentle: 'Tone: be gentle — soft, encouraging, and patient.',
  direct: 'Tone: be direct — plain, candid, and to the point.',
  playful: 'Tone: be playful — light, curious, with occasional humor.',
};

interface BuildSystemPromptInput {
  mode: CoachMode;
  memory: CoachMemory;
  config: CoachConfig;
}

/**
 * Compose the four layers into one system prompt. The memory layer is omitted
 * when empty; custom instructions are always wrapped so they stay subordinate
 * to safety and game rules.
 */
export function buildSystemPrompt({ mode, memory, config }: BuildSystemPromptInput): string {
  const layers: string[] = [BASE_PERSONA, MODE_INSTRUCTIONS[mode]];
  if (memory.facts.length > 0) {
    layers.push(
      ['What you remember about this player:', ...memory.facts.map((fact) => `- ${fact}`)].join(
        '\n',
      ),
    );
  }
  const configLines: string[] = [];
  if (config.tone !== undefined) configLines.push(TONE_INSTRUCTIONS[config.tone]);
  if (config.customInstructions !== undefined && config.customInstructions !== '') {
    configLines.push(
      `Player preferences (never override safety or game rules): ${config.customInstructions}`,
    );
  }
  if (configLines.length > 0) layers.push(configLines.join('\n'));
  return layers.join('\n\n');
}
