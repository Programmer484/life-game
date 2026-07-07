// Internal implementation. Deep imports from other modules are blocked by lint.
import Anthropic from '@anthropic-ai/sdk';
import type { CoachTransport } from './session.ts';

const MODEL = 'claude-opus-4-8';
// Coach turns are deliberately short (one question at a time).
const MAX_TOKENS = 4096;

/**
 * Real transport against the Anthropic API. Browser-side by design for the
 * v1 prototype: the key comes from the caller (Vite env), never hardcoded.
 */
export function createAnthropicTransport(apiKey: string): CoachTransport {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

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
