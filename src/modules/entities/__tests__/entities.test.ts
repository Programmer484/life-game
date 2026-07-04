import { describe, it, expect } from 'vitest';
import { entities } from '../index.ts';

describe('entities', () => {
  it('wraps its input', () => {
    expect(entities('hi')).toBe('[entities] hi');
  });
});
