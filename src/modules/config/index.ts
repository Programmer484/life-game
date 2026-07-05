// Public surface of the config module. Other modules import ONLY from here.
export type {
  TileState,
  TreeType,
  GrowthStage,
  TileCoord,
  TaskDef,
  TaskState,
  Goal,
  Tree,
  TaskCompletedEvent,
  SectionDef,
  GoalTemplate,
} from './internal/config.ts';

export {
  ACTIVE_TREE_CAP,
  STAGE_TASKS,
  TASKS_PER_TREE,
  REVEAL_SIZE,
  UNLOCK_COSTS,
  ISLAND_LAYOUT,
  STORY_BLOCKS,
  GOAL_TEMPLATES,
} from './internal/config.ts';
