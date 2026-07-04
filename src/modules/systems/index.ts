// Public surface of the systems module. Other modules import ONLY from here.
export type { GrowthState } from './internal/growth.ts';
export { activeTrees, applyTaskCompleted, isComplete, stageOf } from './internal/growth.ts';
export type { GameplayState, PlantRejection, PlantRequest } from './internal/planting.ts';
export { canPlant, focusTree, focusedTree, plantTree } from './internal/planting.ts';
