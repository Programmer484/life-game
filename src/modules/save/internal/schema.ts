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

/** Version 1 of the save schema. */
export interface SaveDataV1 {
  version: 1;
  storySeen: boolean;
  unlockedSections: number[];
  trees: SavedTree[];
  goals: Record<string, Goal>;
}

/** The current save version. */
export type SaveData = SaveDataV1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidV1(raw: Record<string, unknown>): boolean {
  return (
    typeof raw['storySeen'] === 'boolean' &&
    Array.isArray(raw['unlockedSections']) &&
    raw['unlockedSections'].every((id) => typeof id === 'number') &&
    Array.isArray(raw['trees']) &&
    isRecord(raw['goals'])
  );
}

/**
 * Version dispatch with a migration stub. `version: 1` passes through after
 * shape sanity checks; anything else returns null (treated as no save).
 * Future v2 migrations land here.
 */
export function migrateSave(raw: unknown): SaveData | null {
  if (!isRecord(raw)) return null;
  if (raw['version'] === 1) {
    return isValidV1(raw) ? dropUnknownSections(raw as unknown as SaveDataV1) : null;
  }
  return null;
}

const KNOWN_SECTION_IDS = new Set(ISLAND_LAYOUT.map((section) => section.id));

/**
 * A save written against a different layout may reference section ids the
 * current ISLAND_LAYOUT no longer has. Drop them with a warning instead of
 * crashing downstream world reconstruction.
 */
function dropUnknownSections(save: SaveDataV1): SaveDataV1 {
  const unknown = save.unlockedSections.filter((id) => !KNOWN_SECTION_IDS.has(id));
  if (unknown.length === 0) return save;
  console.warn(`save: dropping unknown section ids ${unknown.join(', ')}`);
  return {
    ...save,
    unlockedSections: save.unlockedSections.filter((id) => KNOWN_SECTION_IDS.has(id)),
  };
}
