// Public surface of the config module. Other modules import ONLY from here.
export type {
  TileState,
  Vibrancy,
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
  TASK_MINUTES_MIN,
  TASK_MINUTES_MAX,
  REVEAL_SIZE,
  UNLOCK_COST_BY_SECTION,
  VIBRANCY_MAX,
  VIBRANCY_CONTRIBUTION,
  ISLAND_LAYOUT,
  STORY_BLOCKS,
  GOAL_TEMPLATES,
} from './internal/config.ts';
