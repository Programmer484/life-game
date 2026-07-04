// Public surface of the ui module. Other modules import ONLY from here.
import { greet } from './internal/ui.ts';

export function ui(input: string): string {
  return greet(input);
}
