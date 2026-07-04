import { describe, it, expect } from 'vitest';
import { coreViewport } from '../index.ts';

describe('core-viewport', () => {
  it('wraps its input', () => {
    expect(coreViewport('hi')).toBe('[core-viewport] hi');
  });
});
