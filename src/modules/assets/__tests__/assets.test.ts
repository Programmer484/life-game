import { describe, it, expect } from 'vitest';
import { assets } from '../index.ts';

describe('assets', () => {
  it('wraps its input', () => {
    expect(assets('hi')).toBe('[assets] hi');
  });
});
