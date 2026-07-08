// Internal implementation. Deep imports from other modules are blocked by lint.
import type { Goal, TileCoord, Tree } from '../../config/index.ts';
import { GOAL_TEMPLATES, ISLAND_LAYOUT } from '../../config/index.ts';
import type { World } from '../../world/index.ts';
import {
  createWorld,
  isSectionUnlocked,
  revealAround,
  sectionOf,
  unlockSection,
} from '../../world/index.ts';
import { createGoal, createTree } from '../../entities/index.ts';
import type { SaveData, SavedCoach } from './schema.ts';
import { emptyCoach } from './schema.ts';

export interface GameState {
  world: World;
  trees: Tree[];
  goals: Record<string, Goal>;
  storySeen: boolean;
  coach: SavedCoach;
}

export interface SaveInput {
  world: World;
  trees: readonly Tree[];
  goals: Record<string, Goal>;
  storySeen: boolean;
  coach: SavedCoach;
}

/** Deep-copy the coach state so saves never alias live objects. */
function copyCoach(coach: SavedCoach): SavedCoach {
  return { memory: { facts: [...coach.memory.facts] }, config: { ...coach.config } };
}

/** Serialize the live state; unlockedSections derived via isSectionUnlocked. */
export function toSave(input: SaveInput): SaveData {
  return {
    version: 2,
    storySeen: input.storySeen,
    coach: copyCoach(input.coach),
    unlockedSections: input.world.sections
      .filter((section) => isSectionUnlocked(input.world, section.id))
      .map((section) => section.id),
    trees: input.trees.map(({ id, tile, type, tasksDone, goalId }) => ({
      id,
      tile: { ...tile },
      type,
      tasksDone,
      goalId,
    })),
    goals: Object.fromEntries(
      Object.entries(input.goals).map(([id, goal]) => [
        id,
        { ...goal, tasks: goal.tasks.map((task) => ({ ...task })) },
      ]),
    ),
  };
}

/**
 * Rebuild the live state: fresh world, unlock the saved sections, then
 * re-apply revealAround at every tree's tile — trees are what made land
 * vibrant, and land never regresses.
 */
export function fromSave(data: SaveData): GameState {
  let world = createWorld();
  for (const sectionId of data.unlockedSections) world = unlockSection(world, sectionId);
  for (const tree of data.trees) world = revealAround(world, tree.tile);
  return {
    world,
    trees: data.trees.map(({ id, tile, type, tasksDone, goalId }) => ({
      id,
      tile: { ...tile },
      type,
      tasksDone,
      goalId,
    })),
    goals: Object.fromEntries(
      Object.entries(data.goals).map(([id, goal]) => [
        id,
        { ...goal, tasks: goal.tasks.map((task) => ({ ...task })) },
      ]),
    ),
    storySeen: data.storySeen,
    coach: copyCoach(data.coach),
  };
}

/** First section-1 tile (layout order) whose full 3×3 lies inside section 1. */
function demoTile(world: World): TileCoord {
  const section1 = ISLAND_LAYOUT.find((section) => section.id === 1);
  if (!section1) throw new Error('section 1 missing from ISLAND_LAYOUT');
  for (const tile of section1.tiles) {
    let fits = true;
    for (let dy = -1; dy <= 1 && fits; dy++) {
      for (let dx = -1; dx <= 1 && fits; dx++) {
        if (sectionOf(world, { x: tile.x + dx, y: tile.y + dy }) !== 1) fits = false;
      }
    }
    if (fits) return tile;
  }
  throw new Error('no section-1 tile fits a 3×3');
}

/**
 * First-login start state: one preplanted type-A sapling with the Sleep plan
 * goal (0 tasks done), its 3×3 already vibrant inside section 1.
 */
export function createDemoState(): GameState {
  let world = createWorld();
  const tile = demoTile(world);
  const goal = createGoal('goal-demo-sleep', GOAL_TEMPLATES.sleep);
  const tree = createTree('tree-demo', tile, 'A', goal.id);
  world = revealAround(world, tile);
  return {
    world,
    trees: [tree],
    goals: { [goal.id]: goal },
    storySeen: false,
    coach: emptyCoach(),
  };
}
