import { describe, it, expect } from 'vitest';
import { GOAL_TEMPLATES, TASKS_PER_TREE } from '../../config/index.ts';
import type { Goal } from '../../config/index.ts';
import {
  createGoal,
  createTree,
  nextTaskIndex,
  completeNextTask,
  tasksDone,
  taskCompletedEvent,
} from '../index.ts';

function completeN(goal: Goal, n: number): Goal {
  let g = goal;
  for (let i = 0; i < n; i++) g = completeNextTask(g);
  return g;
}

describe('entities', () => {
  describe('createGoal', () => {
    it('instantiates the sleep template: 18 tasks in template order, titles/minutes from config, none done, name "Sleep plan"', () => {
      const goal = createGoal('g1', GOAL_TEMPLATES.sleep);
      expect(goal.id).toBe('g1');
      expect(goal.name).toBe('Sleep plan');
      expect(goal.tasks).toHaveLength(TASKS_PER_TREE);
      expect(goal.tasks).toHaveLength(18);
      expect(goal.tasks).toEqual(
        GOAL_TEMPLATES.sleep.tasks.map((task) => ({
          title: task.title,
          estimatedMinutes: task.estimatedMinutes,
          done: false,
        })),
      );
    });

    it('instantiates the workout template the same way', () => {
      const goal = createGoal('g2', GOAL_TEMPLATES.workout);
      expect(goal.id).toBe('g2');
      expect(goal.name).toBe('Workout plan');
      expect(goal.tasks).toHaveLength(18);
      expect(goal.tasks).toEqual(
        GOAL_TEMPLATES.workout.tasks.map((task) => ({
          title: task.title,
          estimatedMinutes: task.estimatedMinutes,
          done: false,
        })),
      );
    });
  });

  describe('createTree', () => {
    it('starts at tasksDone 0 with the given tile/type/goalId', () => {
      const tree = createTree('t1', { x: 3, y: 5 }, 'B', 'g1');
      expect(tree).toEqual({
        id: 't1',
        tile: { x: 3, y: 5 },
        type: 'B',
        goalId: 'g1',
        tasksDone: 0,
      });
    });
  });

  describe('nextTaskIndex', () => {
    it('is 0 on a fresh goal', () => {
      const goal = createGoal('g1', GOAL_TEMPLATES.sleep);
      expect(nextTaskIndex(goal)).toBe(0);
    });

    it('advances by one after each completion', () => {
      let goal = createGoal('g1', GOAL_TEMPLATES.sleep);
      for (let i = 0; i < 18; i++) {
        expect(nextTaskIndex(goal)).toBe(i);
        goal = completeNextTask(goal);
      }
    });

    it('is undefined when all 18 tasks are done', () => {
      const goal = completeN(createGoal('g1', GOAL_TEMPLATES.sleep), 18);
      expect(nextTaskIndex(goal)).toBeUndefined();
    });
  });

  describe('completeNextTask', () => {
    it('marks exactly the next task done', () => {
      const fresh = createGoal('g1', GOAL_TEMPLATES.sleep);
      const once = completeNextTask(fresh);
      expect(once.tasks.map((t) => t.done)).toEqual([true, ...Array(17).fill(false)]);

      const twice = completeNextTask(once);
      expect(twice.tasks.map((t) => t.done)).toEqual([true, true, ...Array(16).fill(false)]);
    });

    it('does not mutate the input goal', () => {
      const fresh = createGoal('g1', GOAL_TEMPLATES.sleep);
      const result = completeNextTask(fresh);
      expect(result).not.toBe(fresh);
      expect(fresh.tasks.every((t) => !t.done)).toBe(true);
    });

    it('returns a fully-done goal unchanged', () => {
      const done = completeN(createGoal('g1', GOAL_TEMPLATES.sleep), 18);
      const again = completeNextTask(done);
      expect(again).toBe(done);
      expect(again.tasks.every((t) => t.done)).toBe(true);
    });
  });

  describe('tasksDone', () => {
    it('is 0 on a fresh goal', () => {
      expect(tasksDone(createGoal('g1', GOAL_TEMPLATES.sleep))).toBe(0);
    });

    it('is n after n completions', () => {
      const goal = completeN(createGoal('g1', GOAL_TEMPLATES.sleep), 7);
      expect(tasksDone(goal)).toBe(7);
    });

    it('is 18 when the goal is finished', () => {
      const goal = completeN(createGoal('g1', GOAL_TEMPLATES.sleep), 18);
      expect(tasksDone(goal)).toBe(18);
    });
  });

  describe('taskCompletedEvent', () => {
    it("carries type 'task-completed', treeId, taskIndex", () => {
      expect(taskCompletedEvent('t1', 4)).toEqual({
        type: 'task-completed',
        treeId: 't1',
        taskIndex: 4,
      });
    });
  });
});
