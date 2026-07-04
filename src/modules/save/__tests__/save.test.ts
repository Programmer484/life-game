import { describe, it, expect } from 'vitest';
import { save } from '../index.ts';

describe('save', () => {
  it('wraps its input', () => {
    expect(save('hi')).toBe('[save] hi');
  });
});
