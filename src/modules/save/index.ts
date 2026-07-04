// Public surface of the save module. Other modules import ONLY from here.
import { greet } from './internal/save.ts';

export function save(input: string): string {
  return greet(input);
}
