// Public surface of the config module. Other modules import ONLY from here.
import { greet } from './internal/config.ts';

export function config(input: string): string {
  return greet(input);
}
