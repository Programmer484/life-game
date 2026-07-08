// Internal implementation. Deep imports from other modules are blocked by lint.
// System prompts moved to instructions.ts (layered builder); this file keeps
// the mode type and the client-side opening lines.

export type CoachMode = 'goal' | 'reflection';

export const OPENING_MESSAGES: Record<CoachMode, string> = {
  goal: "You've planted a tree — let's give it a goal. What's on your mind?",
  reflection: "Let's look at what's not working. What's been bothering you?",
};
