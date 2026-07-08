// Internal implementation. Deep imports from other modules are blocked by lint.
// Anthropic tool definitions + server-side input validators. Tool execution
// never mutates server state: results accumulate into CoachEffects and flow
// back to the client (see handler.ts).
import type { CoachMode } from './prompts.ts';

/** A validated goal plan the planting flow can consume. */
export interface GoalTemplateDraft {
  name: string;
  tasks: { title: string; minutes: number }[];
}

/** Structured side effects of one coach turn, applied client-side. */
export interface CoachEffects {
  goalTemplate?: GoalTemplateDraft;
  memories?: string[];
}

const GOAL_TASK_COUNT = 18;
const TASK_MINUTES_MIN = 5;
const TASK_MINUTES_MAX = 120;
const MEMORY_FACT_MAX_CHARS = 200;

/** Minimal structural subset of the SDK's Tool type (keeps tests SDK-free). */
export interface CoachToolDefinition {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required: string[] };
}

const CREATE_GOAL_TEMPLATE: CoachToolDefinition = {
  name: 'create_goal_template',
  description: `Turn the user's confirmed goal into the tree's task plan. Provide EXACTLY ${String(GOAL_TASK_COUNT)} tasks, ordered easiest to hardest — they are completed in four growth stages of 3, 4, 5, and 6 tasks. Each task takes between ${String(TASK_MINUTES_MIN)} and ${String(TASK_MINUTES_MAX)} minutes. Call this only after the user confirms the goal.`,
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short goal name shown on the tree.' },
      tasks: {
        type: 'array',
        description: `Exactly ${String(GOAL_TASK_COUNT)} tasks, easiest first.`,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            minutes: {
              type: 'number',
              description: `Estimated minutes, ${String(TASK_MINUTES_MIN)}-${String(TASK_MINUTES_MAX)}.`,
            },
          },
          required: ['title', 'minutes'],
        },
      },
    },
    required: ['name', 'tasks'],
  },
};

const SAVE_MEMORY: CoachToolDefinition = {
  name: 'save_memory',
  description: `Remember one durable fact about the player (preferences, life context, recurring patterns) for future conversations. Keep it under ${String(MEMORY_FACT_MAX_CHARS)} characters. Do not save transient conversation details.`,
  input_schema: {
    type: 'object',
    properties: {
      fact: { type: 'string', description: 'One concise fact about the player.' },
    },
    required: ['fact'],
  },
};

/** create_goal_template only makes sense in goal mode; save_memory in both. */
export function toolsForMode(mode: CoachMode): CoachToolDefinition[] {
  return mode === 'goal' ? [CREATE_GOAL_TEMPLATE, SAVE_MEMORY] : [SAVE_MEMORY];
}

type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Server-side validation of create_goal_template input. */
export function validateGoalTemplate(input: unknown): Validation<GoalTemplateDraft> {
  if (!isRecord(input)) return { ok: false, error: 'Input must be an object.' };
  const { name, tasks } = input;
  if (typeof name !== 'string' || name.trim() === '') {
    return { ok: false, error: 'name must be a non-empty string.' };
  }
  if (!Array.isArray(tasks) || tasks.length !== GOAL_TASK_COUNT) {
    return {
      ok: false,
      error: `tasks must be an array of EXACTLY ${String(GOAL_TASK_COUNT)} tasks (got ${String(Array.isArray(tasks) ? tasks.length : typeof tasks)}).`,
    };
  }
  const parsed: GoalTemplateDraft['tasks'] = [];
  for (const [index, task] of tasks.entries()) {
    if (!isRecord(task) || typeof task['title'] !== 'string' || task['title'].trim() === '') {
      return { ok: false, error: `tasks[${String(index)}].title must be a non-empty string.` };
    }
    const minutes = task['minutes'];
    if (
      typeof minutes !== 'number' ||
      !Number.isFinite(minutes) ||
      minutes < TASK_MINUTES_MIN ||
      minutes > TASK_MINUTES_MAX
    ) {
      return {
        ok: false,
        error: `tasks[${String(index)}].minutes must be a number between ${String(TASK_MINUTES_MIN)} and ${String(TASK_MINUTES_MAX)}.`,
      };
    }
    parsed.push({ title: task['title'], minutes });
  }
  return { ok: true, value: { name: name.trim(), tasks: parsed } };
}

/** Server-side validation of save_memory input. */
export function validateMemoryFact(input: unknown): Validation<string> {
  if (!isRecord(input) || typeof input['fact'] !== 'string' || input['fact'].trim() === '') {
    return { ok: false, error: 'fact must be a non-empty string.' };
  }
  if (input['fact'].length > MEMORY_FACT_MAX_CHARS) {
    return {
      ok: false,
      error: `fact must be at most ${String(MEMORY_FACT_MAX_CHARS)} characters.`,
    };
  }
  return { ok: true, value: input['fact'].trim() };
}
