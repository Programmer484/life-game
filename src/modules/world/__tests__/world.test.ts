import { describe, it, expect } from 'vitest';
import { world } from '../index.ts';

describe('world', () => {
  it('wraps its input', () => {
    expect(world('hi')).toBe('[world] hi');
  });
});
