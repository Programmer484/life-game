import { describe, it, expect } from 'vitest';
import { config } from '../index.ts';

describe('config', () => {
  it('wraps its input', () => {
    expect(config('hi')).toBe('[config] hi');
  });
});
