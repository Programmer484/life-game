import { describe, it, expect } from 'vitest';
import { isDevMode } from '../index.ts';
import type { DevModeStorage } from '../internal/dev-mode.ts';

/** In-memory Storage stand-in — no DOM needed for a pure decision helper. */
function fakeStorage(initial: Record<string, string> = {}): DevModeStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('isDevMode', () => {
  it('is off by default in a production build with nothing persisted', () => {
    expect(isDevMode('', fakeStorage(), false)).toBe(false);
  });

  it('is always on in a dev build', () => {
    expect(isDevMode('', fakeStorage(), true)).toBe(true);
  });

  it('?dev=1 turns it on and persists lg-dev=1', () => {
    const storage = fakeStorage();
    expect(isDevMode('?dev=1', storage, false)).toBe(true);
    expect(storage.data.get('lg-dev')).toBe('1');
  });

  it('persisted lg-dev=1 keeps it on across later visits without the param', () => {
    expect(isDevMode('', fakeStorage({ 'lg-dev': '1' }), false)).toBe(true);
  });

  it('?dev=0 clears the persisted flag and turns it off', () => {
    const storage = fakeStorage({ 'lg-dev': '1' });
    expect(isDevMode('?dev=0', storage, false)).toBe(false);
    expect(storage.data.has('lg-dev')).toBe(false);
  });

  it('?dev=0 cannot turn off a dev build, but still clears persistence', () => {
    const storage = fakeStorage({ 'lg-dev': '1' });
    expect(isDevMode('?dev=0', storage, true)).toBe(true);
    expect(storage.data.has('lg-dev')).toBe(false);
  });

  it('ignores unrelated params and unrecognized dev values', () => {
    const storage = fakeStorage();
    expect(isDevMode('?foo=bar&dev=yes', storage, false)).toBe(false);
    expect(storage.data.size).toBe(0);
  });
});
