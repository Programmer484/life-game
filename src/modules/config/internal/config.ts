// Internal implementation. Deep imports from other modules are blocked by lint.

// ── Shared contract types ────────────────────────────────────────────────────

export type TileState = 'fog' | 'dead' | 'vibrant';

/** Per-tile vibrancy: 0 = dead land, 3 = fully vibrant. */
export type Vibrancy = 0 | 1 | 2 | 3;

export type TreeType = 'A' | 'B';

export type GrowthStage = 1 | 2 | 3 | 4 | 5;

export interface TileCoord {
  x: number;
  y: number;
}

export interface TaskDef {
  title: string;
  estimatedMinutes: number;
}

export type TaskState = TaskDef & { done: boolean };

/** Ordered list of 18 tasks. */
export interface Goal {
  id: string;
  name: string;
  tasks: TaskState[];
}

export interface Tree {
  id: string;
  tile: TileCoord;
  type: TreeType;
  goalId: string;
  tasksDone: number;
}

export interface TaskCompletedEvent {
  type: 'task-completed';
  treeId: string;
  taskIndex: number;
}

export interface SectionDef {
  id: number;
  unlockedAtStart: boolean;
  tiles: TileCoord[];
}

/** Exactly 18 tasks. */
export interface GoalTemplate {
  name: string;
  tasks: TaskDef[];
}

// ── Tunable numbers ──────────────────────────────────────────────────────────

export const ACTIVE_TREE_CAP = 3;

/** Tasks to advance stage 1→2, 2→3, 3→4, 4→5. */
export const STAGE_TASKS = [3, 4, 5, 6] as const;

/** Must equal the sum of STAGE_TASKS. */
export const TASKS_PER_TREE = 18;

/** The 3×3 dead→vibrant reveal. */
export const REVEAL_SIZE = { width: 3, height: 3 } as const;

/** Highest vibrancy a tile can reach; totals above this clamp down. */
export const VIBRANCY_MAX = 3;

/**
 * A tree's vibrancy contribution, indexed by orthogonal (Manhattan) distance:
 * +3 on its own tile, +2 one step away, +1 two steps away. Cumulative across
 * trees.
 */
export const VIBRANCY_CONTRIBUTION = [3, 2, 1] as const;

// ── Island layout ────────────────────────────────────────────────────────────

/** Expand an inclusive rectangle of grid coords into a tile list. */
function rectTiles(x0: number, x1: number, y0: number, y1: number): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/**
 * Hard-coded jagged floating island: 25 contiguous sections growing outward
 * from section 1 in rough rings. Sections 1–7 are the original core (coords
 * frozen so existing saves and the demo state stay valid); 8–25 form two
 * irregular outer rings. Rectangles are 30–40 tiles and staggered so the
 * union of all tiles is a blobby silhouette, never a filled rectangle. Every
 * section shares an edge with an earlier section, so unlocking always grows
 * the island outward from section 1.
 */
export const ISLAND_LAYOUT: SectionDef[] = [
  // Rings 0–1: the original 7-section core (coords frozen).
  { id: 1, unlockedAtStart: true, tiles: rectTiles(0, 5, 0, 5) }, // 36
  { id: 2, unlockedAtStart: false, tiles: rectTiles(6, 11, 0, 5) }, // 36
  { id: 3, unlockedAtStart: false, tiles: rectTiles(0, 5, 6, 11) }, // 36
  { id: 4, unlockedAtStart: false, tiles: rectTiles(6, 11, 6, 11) }, // 36
  { id: 5, unlockedAtStart: false, tiles: rectTiles(-6, -1, 1, 6) }, // 36
  { id: 6, unlockedAtStart: false, tiles: rectTiles(1, 8, -5, -1) }, // 40
  { id: 7, unlockedAtStart: false, tiles: rectTiles(12, 17, 2, 7) }, // 36
  // Ring 2: wraps the core on all sides.
  { id: 8, unlockedAtStart: false, tiles: rectTiles(12, 17, 8, 12) }, // 30
  { id: 9, unlockedAtStart: false, tiles: rectTiles(6, 11, 12, 16) }, // 30
  { id: 10, unlockedAtStart: false, tiles: rectTiles(0, 5, 12, 16) }, // 30
  { id: 11, unlockedAtStart: false, tiles: rectTiles(-6, -1, 7, 12) }, // 36
  { id: 12, unlockedAtStart: false, tiles: rectTiles(-12, -7, 1, 6) }, // 36
  { id: 13, unlockedAtStart: false, tiles: rectTiles(-6, -1, -4, 0) }, // 30
  { id: 14, unlockedAtStart: false, tiles: rectTiles(9, 14, -5, -1) }, // 30
  { id: 15, unlockedAtStart: false, tiles: rectTiles(1, 8, -10, -6) }, // 40
  { id: 16, unlockedAtStart: false, tiles: rectTiles(18, 23, 2, 7) }, // 36
  // Ring 3: outer edge, staggered for an irregular coastline.
  { id: 17, unlockedAtStart: false, tiles: rectTiles(12, 17, 13, 17) }, // 30
  { id: 18, unlockedAtStart: false, tiles: rectTiles(-12, -7, 7, 12) }, // 36
  { id: 19, unlockedAtStart: false, tiles: rectTiles(-6, -1, 13, 17) }, // 30
  { id: 20, unlockedAtStart: false, tiles: rectTiles(9, 14, -10, -6) }, // 30
  { id: 21, unlockedAtStart: false, tiles: rectTiles(-12, -7, -4, 0) }, // 30
  { id: 22, unlockedAtStart: false, tiles: rectTiles(18, 23, 8, 12) }, // 30
  { id: 23, unlockedAtStart: false, tiles: rectTiles(-5, 0, -9, -5) }, // 30
  { id: 24, unlockedAtStart: false, tiles: rectTiles(15, 20, -4, 1) }, // 36
  { id: 25, unlockedAtStart: false, tiles: rectTiles(6, 11, 17, 21) }, // 30
];

/**
 * Fully-grown trees needed to unlock the locked sections, in layout order.
 * This literal array is the single source of truth; its values follow the
 * curve cost(i) = max(prev + 1, round(4 * 1.22^i)) — early-fast, late-slow.
 */
const UNLOCK_COST_SEQUENCE = [
  4, 5, 6, 7, 9, 11, 13, 16, 20, 24, 29, 36, 43, 53, 65, 79, 96, 118, 143, 175, 213, 260, 318, 388,
] as const;

/**
 * Fully-grown-tree cost to unlock a section, keyed by section id. Derived
 * from ISLAND_LAYOUT: the locked sections, in layout order, take
 * UNLOCK_COST_SEQUENCE in order. A section id with no entry (unlocked at
 * start, or unknown) has no unlock cost and is never unlockable via
 * progression.
 */
export const UNLOCK_COST_BY_SECTION: Readonly<Record<number, number>> = Object.fromEntries(
  ISLAND_LAYOUT.filter((section) => !section.unlockedAtStart).flatMap((section, index) => {
    const cost = UNLOCK_COST_SEQUENCE[index];
    return cost === undefined ? [] : [[section.id, cost]];
  }),
);

// ── Story ────────────────────────────────────────────────────────────────────

export const STORY_BLOCKS: string[] = [
  'Long ago, the island was a living jewel — rolling green tiles, groves heavy with fruit, rivers of light. All of it was tended by a goddess who loved the world as a mother loves a newborn, walking the land each day to coax every seed into bloom.',
  'But the world was young, and the young grow. As the island learned to hold its own shape, the goddess came less often — a visit each season, then each year, trusting her creation to stand on its own.',
  'And in the quiet she left behind, a darkness began to seep in — a cold fog, a creeping sludge. It was temptation; it was the small surrenders and unkept promises that ask for nothing yet take everything.',
  "At first it was only a stain at the island's edge, and whenever it spread too far the goddess would return and cleanse the land with her light — and for a while the world remembered how to shine.",
  'But her visits grew rarer still, until one day they stopped altogether. With no one to push back the dark, the fog swallowed the groves, the rivers dimmed, and the island slowly withered into silence.',
  'So it remained through a long age of night… until you arrive. Where your feet touch the earth, one tree stands green and the tiles around it warm back to color — a single patch of living light in a drowned world. You are the seed of life. The rest is up to you.',
];

// ── Goal templates ───────────────────────────────────────────────────────────

function task(title: string, estimatedMinutes: number): TaskDef {
  return { title, estimatedMinutes };
}

export const GOAL_TEMPLATES: { sleep: GoalTemplate; workout: GoalTemplate } = {
  sleep: {
    name: 'Sleep plan',
    tasks: [
      task('Estimate your bed/wake times for the past week — set a baseline', 15),
      task('Pick your target sleep window and write down your why', 15),
      task('Set a nightly wind-down alarm 45 min before bed', 15),
      task('Bedroom audit: blackout fixes, cover/remove light sources', 30),
      task('Move phone charging outside the bedroom', 15),
      task('Set a caffeine cutoff (none after 2 pm) + pick a replacement drink', 15),
      task('Write a 3-step wind-down routine', 20),
      task('Night 1: follow the wind-down routine + hit your sleep window; log it', 15),
      task('Night 2: follow the wind-down routine + hit your sleep window; log it', 15),
      task('Night 3: follow the wind-down routine + hit your sleep window; log it', 15),
      task('Night 4: follow the wind-down routine + hit your sleep window; log it', 15),
      task('Night 5: follow the wind-down routine + hit your sleep window; log it', 15),
      task('Night 6: hit your sleep window; log it', 15),
      task('Night 7: hit your sleep window; log it', 15),
      task('Night 8: hit your sleep window; log it', 15),
      task('Night 9: hit your sleep window; log it', 15),
      task('Night 10: hit your sleep window; log it', 15),
      task('Review the log: biggest blocker + one adjustment going forward', 20),
    ],
  },
  workout: {
    name: 'Workout plan',
    tasks: [
      task('Pick your focus (strength/cardio) + block 3 weekly slots in your calendar', 15),
      task('Choose a beginner program template', 20),
      task('Prep gear & space — shoes, mat, gym access', 30),
      task('Week 1: workout 1 at easy effort', 45),
      task('Week 1: workout 2 at easy effort', 45),
      task('Week 1: workout 3 at easy effort', 45),
      task('Recovery walk + note how the week felt', 20),
      task('Week 2: workout 4 with small progression', 45),
      task('Week 2: workout 5 with small progression', 45),
      task('Week 2: workout 6 with small progression', 45),
      task('Mobility / stretch session', 20),
      task("Log numbers + set next week's targets", 15),
      task('Week 3: workout 7', 45),
      task('Week 3: workout 8', 45),
      task('Week 3: workout 9', 45),
      task('Active recovery session', 30),
      task('Progress check vs week 1 — reps/weights/pace', 15),
      task('Plan the next 4 weeks', 30),
    ],
  },
};
