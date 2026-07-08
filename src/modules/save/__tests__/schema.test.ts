import { describe, it, expect, vi } from 'vitest';
import type { SaveDataV1 } from '../index.ts';
import { migrateSave, createDemoState, toSave } from '../index.ts';

/** A valid v1 payload (the shape shipped before the coach fields existed). */
function v1Payload(): SaveDataV1 {
  const { storySeen, unlockedSections, trees, goals } = toSave(createDemoState());
  return { version: 1, storySeen, unlockedSections, trees, goals };
}

describe('save · migrateSave', () => {
  it('passes a valid v2 payload through unchanged', () => {
    const demo = createDemoState();
    const data = toSave(demo);

    expect(data.version).toBe(2);
    expect(migrateSave(data)).toEqual(data);
  });

  it('migrates v1 → v2 with empty coach memory and default config', () => {
    const v1 = v1Payload();

    const migrated = migrateSave(v1);

    expect(migrated).toEqual({
      ...v1,
      version: 2,
      coach: { memory: { facts: [] }, config: {} },
    });
  });

  it('preserves a v2 payload with saved coach memory and config', () => {
    const data = {
      ...toSave(createDemoState()),
      coach: {
        memory: { facts: ['Night owl', 'Prefers small steps'] },
        config: { tone: 'direct' as const, customInstructions: 'Keep it brief' },
      },
    };

    expect(migrateSave(data)).toEqual(data);
  });

  it('returns null for unknown versions', () => {
    const demo = createDemoState();
    const data = { ...toSave(demo), version: 3 };

    expect(migrateSave(data)).toBeNull();
  });

  it('drops unknown section ids with a warning instead of crashing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const demo = createDemoState();
      const data = toSave(demo);
      const dirty = { ...data, unlockedSections: [...data.unlockedSections, 999, -1] };

      const migrated = migrateSave(dirty);
      expect(migrated?.unlockedSections).toEqual(data.unlockedSections);
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it('drops unknown section ids during the v1 → v2 migration too', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const v1 = v1Payload();
      const dirty = { ...v1, unlockedSections: [...v1.unlockedSections, 999] };

      const migrated = migrateSave(dirty);
      expect(migrated?.version).toBe(2);
      expect(migrated?.unlockedSections).toEqual(v1.unlockedSections);
      expect(migrated?.coach).toEqual({ memory: { facts: [] }, config: {} });
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it('returns null for a v2 payload with a malformed coach block', () => {
    const base = toSave(createDemoState());
    expect(migrateSave({ ...base, coach: undefined })).toBeNull();
    expect(migrateSave({ ...base, coach: { memory: { facts: 'nope' }, config: {} } })).toBeNull();
    expect(migrateSave({ ...base, coach: { memory: { facts: [42] }, config: {} } })).toBeNull();
    expect(
      migrateSave({ ...base, coach: { memory: { facts: [] }, config: { tone: 'rude' } } }),
    ).toBeNull();
    expect(
      migrateSave({ ...base, coach: { memory: { facts: [] }, config: { customInstructions: 9 } } }),
    ).toBeNull();
  });

  it('returns null for malformed payloads', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave(undefined)).toBeNull();
    expect(migrateSave('not an object')).toBeNull();
    expect(migrateSave(42)).toBeNull();
    expect(migrateSave({})).toBeNull();
    expect(migrateSave({ version: 1 })).toBeNull();
    expect(
      migrateSave({ version: 1, storySeen: 'yes', unlockedSections: [], trees: [], goals: {} }),
    ).toBeNull();
    expect(
      migrateSave({ version: 1, storySeen: false, unlockedSections: 'nope', trees: [], goals: {} }),
    ).toBeNull();
    expect(
      migrateSave({ version: 1, storySeen: false, unlockedSections: [], trees: {}, goals: {} }),
    ).toBeNull();
    expect(
      migrateSave({ version: 1, storySeen: false, unlockedSections: [], trees: [], goals: null }),
    ).toBeNull();
  });
});
