// Public surface of the entities module. Other modules import ONLY from here.
export {
  createGoal,
  createTree,
  nextTaskIndex,
  completeNextTask,
  tasksDone,
  taskCompletedEvent,
} from './internal/entities.ts';
