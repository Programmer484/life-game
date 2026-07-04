// Public surface of the core-viewport module. Other modules import ONLY from here.
import { greet } from './internal/core-viewport.ts';

export function coreViewport(input: string): string {
  return greet(input);
}
