// Public surface of the render module. Other modules import ONLY from here.
import { greet } from './internal/render.ts';

export function render(input: string): string {
  return greet(input);
}
