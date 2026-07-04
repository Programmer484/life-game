// Public surface of the world module. Other modules import ONLY from here.
import { greet } from './internal/world.ts';

export function world(input: string): string {
  return greet(input);
}
