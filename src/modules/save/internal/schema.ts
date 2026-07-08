// Internal implementation. Deep imports from other modules are blocked by lint.
import { ISLAND_LAYOUT } from '../../config/index.ts';
import type { Goal, TileCoord, TreeType } from '../../config/index.ts';

/** Persisted tree — the plain-data subset of Tree (focus is NOT persisted). */
export interface SavedTree {
  id: string;
  tile: TileCoord;
  type: TreeType;
  tasksDone: number;
  goalId: string;
}

/**
 * Persisted coach state. Structurally identical to the coach module's
 * CoachMemory/CoachConfig — duplicated as plain data so save never has to
 * import coach (memory/config cross module boundaries as data only).
 */
export interface SavedCoach {
  memory: { facts: string[] };
  config: { tone?: 'gentle' | 'direct' | 'playful'; customInstructions?: string };
}

/** Version 1 of the save schema. */
export interface SaveDataV1 {
  version: 1;
  storySeen: boolean;
  unlockedSections: number[];
  trees: SavedTree[];
  goals: Record<string, Goal>;
}

/** Version 2: v1 plus persisted coach memory + config. */
export interface SaveDataV2 extends Omit<SaveDataV1, 'version'> {
  version: 2;
  coach: SavedCoach;
}

/** The current save version. */
export type SaveData = SaveDataV2;

/** A fresh coach: nothing remembered, default config. */
export function emptyCoach(): SavedCoach {
  return { memory: { facts: [] }, config: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Shape checks shared by v1 and v2 (the non-coach fields). */
function isValidBase(raw: Record<string, unknown>): boolean {
  return (
    typeof raw['storySeen'] === 'boolean' &&
    Array.isArray(raw['unlockedSections']) &&
    raw['unlockedSections'].every((id) => typeof id === 'number') &&
    Array.isArray(raw['trees']) &&
    isRecord(raw['goals'])
  );
}

function isValidCoach(raw: unknown): raw is SavedCoach {
  if (!isRecord(raw)) return false;
  const { memory, config } = raw;
  if (!isRecord(memory) || !Array.isArray(memory['facts'])) return false;
  if (!memory['facts'].every((fact) => typeof fact === 'string')) return false;
  if (!isRecord(config)) return false;
  const { tone, customInstructions } = config;
  if (tone !== undefined && tone !== 'gentle' && tone !== 'direct' && tone !== 'playful') {
    return false;
  }
  return customInstructions === undefined || typeof customInstructions === 'string';
}

const KNOWN_SECTION_IDS = new Set(ISLAND_LAYOUT.map((section) => section.id));

/**
 * A save written against a different layout may reference section ids the
 * current ISLAND_LAYOUT no longer has. Drop them with a warning instead of
 * crashing downstream world reconstruction. Applies to every save version.
 */
function dropUnknownSections<T extends { unlockedSections: number[] }>(save: T): T {
  const unknown = save.unlockedSections.filter((id) => !KNOWN_SECTION_IDS.has(id));
  if (unknown.length === 0) return save;
  console.warn(`save: dropping unknown section ids ${unknown.join(', ')}`);
  return {
    ...save,
    unlockedSections: save.unlockedSections.filter((id) => KNOWN_SECTION_IDS.has(id)),
  };
}

/**
 * Version dispatch with migrations. v1 upgrades to v2 with a fresh coach;
 * `version: 2` passes through after shape sanity checks; anything else
 * returns null (treated as no save). Unknown section ids are dropped on
 * every path. Future v3 migrations land here.
 */
export function migrateSave(raw: unknown): SaveData | null {
  if (!isRecord(raw)) return null;
  if (raw['version'] === 1) {
    if (!isValidBase(raw)) return null;
    return dropUnknownSections({
      ...(raw as unknown as SaveDataV1),
      version: 2 as const,
      coach: emptyCoach(),
    });
  }
  if (raw['version'] === 2) {
    return isValidBase(raw) && isValidCoach(raw['coach'])
      ? dropUnknownSections(raw as unknown as SaveDataV2)
      : null;
  }
  return null;
}
