// Public surface of the assets module. Other modules import ONLY from here.
import { greet } from './internal/assets.ts';

export function assets(input: string): string {
  return greet(input);
}
