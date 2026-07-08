// Internal implementation. Deep imports from other modules are blocked by lint.

/** The subset of `Storage` the dev-mode decision needs (injectable for tests). */
export interface DevModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = 'lg-dev';

/**
 * Decide whether dev tools are enabled, from explicit inputs only (no
 * globals) so the decision is unit-testable. Dev mode is ON when any holds:
 * the build is a dev build, `?dev=1` is in the URL (also persisted to
 * `lg-dev=1` in storage so it survives navigation), or `lg-dev=1` is already
 * persisted. `?dev=0` clears the persisted flag (a dev build stays on).
 */
export function isDevMode(search: string, storage: DevModeStorage, isDevBuild: boolean): boolean {
  const param = new URLSearchParams(search).get('dev');
  if (param === '1') storage.setItem(STORAGE_KEY, '1');
  else if (param === '0') storage.removeItem(STORAGE_KEY);
  return isDevBuild || storage.getItem(STORAGE_KEY) === '1';
}
