import { describe, it, expect } from 'vitest';
import { ui } from '../index.ts';

describe('ui', () => {
  it('wraps its input', () => {
    expect(ui('hi')).toBe('[ui] hi');
  });
});
