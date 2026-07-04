import { describe, it, expect } from 'vitest';
import { systems } from '../index.ts';

describe('systems', () => {
  it('wraps its input', () => {
    expect(systems('hi')).toBe('[systems] hi');
  });
});
