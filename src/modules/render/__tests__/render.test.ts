import { describe, it, expect } from 'vitest';
import { render } from '../index.ts';

describe('render', () => {
  it('wraps its input', () => {
    expect(render('hi')).toBe('[render] hi');
  });
});
