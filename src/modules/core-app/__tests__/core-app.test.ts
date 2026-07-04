import { describe, it, expect } from 'vitest';
import { coreApp } from '../index.ts';

describe('core-app', () => {
  it('wraps its input', () => {
    expect(coreApp('hi')).toBe('[core-app] hi');
  });
});
