// Public surface of the entities module. Other modules import ONLY from here.
import { greet } from './internal/entities.ts';

export function entities(input: string): string {
  return greet(input);
}
