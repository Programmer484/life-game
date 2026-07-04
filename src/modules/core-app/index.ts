// Public surface of the core-app module. Other modules import ONLY from here.
import { greet } from './internal/core-app.ts';

export function coreApp(input: string): string {
  return greet(input);
}
