// Public surface of the systems module. Other modules import ONLY from here.
import { greet } from './internal/systems.ts';

export function systems(input: string): string {
  return greet(input);
}
