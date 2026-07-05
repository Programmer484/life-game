// Public surface of the world module. Other modules import ONLY from here.
export type { World } from './internal/world.ts';
export {
  createWorld,
  tileState,
  sectionOf,
  isSectionUnlocked,
  unlockSection,
  revealAround,
  transitionTiles,
} from './internal/world.ts';
