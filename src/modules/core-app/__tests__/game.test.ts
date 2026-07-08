// S13 acceptance tests (§7): the headless game controller over null
// gateways. No Pixi, no DOM — pure event flow from sign-in to save.
import { describe, expect, it } from 'vitest';
import { MEMORY_FACT_CAP } from '../../coach/index.ts';
import type { TileCoord } from '../../config/index.ts';
import { GOAL_TEMPLATES, TASKS_PER_TREE, UNLOCK_COST_BY_SECTION } from '../../config/index.ts';
import { createNullGateways, toSave } from '../../save/index.ts';
import type { Gateways } from '../../save/index.ts';
import { activeTrees, availableTreeTypes, stageOf, xpProgress } from '../../systems/index.ts';
import { isSectionUnlocked, tileState } from '../../world/index.ts';
import { createGame } from '../internal/game.ts';
import type { Game } from '../internal/game.ts';

const EMAIL = 'player@example.com';
const PASSWORD = 'hunter22';

/** The demo sapling's tile: first section-1 tile whose 3×3 fits section 1. */
const DEMO_TILE: TileCoord = { x: 1, y: 1 };

async function signedInGame(gateways: Gateways = createNullGateways()): Promise<Game> {
  const game = createGame(gateways);
  const result = await game.signUp(EMAIL, PASSWORD);
  expect(result.ok).toBe(true);
  return game;
}

function demoTree(game: Game) {
  const tree = game.state().trees.find((candidate) => candidate.id === 'tree-demo');
  expect(tree).toBeDefined();
  return tree!;
}

describe('createGame — sign-in and hydration', () => {
  it('hydrates the demo state on first sign-up and focuses the preplanted sapling', async () => {
    const game = await signedInGame();
    const state = game.state();
    expect(state.trees).toHaveLength(1);
    expect(state.trees[0]!.id).toBe('tree-demo');
    expect(state.focusedTreeId).toBe('tree-demo');
    expect(game.storySeen()).toBe(false);
    expect(tileState(state.world, DEMO_TILE)).toBe('vibrant');
  });

  it('rejects bad credentials and leaves the state empty', async () => {
    const game = createGame(createNullGateways());
    const result = await game.signIn('nobody@example.com', 'wrong');
    expect(result.ok).toBe(false);
    expect(game.state().trees).toHaveLength(0);
  });

  it('notifies subscribers after every change', async () => {
    const game = await signedInGame();
    let ticks = 0;
    game.subscribe(() => {
      ticks += 1;
    });
    game.completeNextTask();
    expect(ticks).toBe(1);
    game.plantAt({ x: 4, y: 4 }, GOAL_TEMPLATES.sleep, 'A');
    expect(ticks).toBe(2);
    game.finishStory();
    expect(ticks).toBe(3);
  });
});

describe('growth — task completion drives the demo sapling', () => {
  it('advances the demo sapling to stage 2 after 3 completed tasks', async () => {
    const game = await signedInGame();
    expect(stageOf(demoTree(game))).toBe(1);
    for (let i = 0; i < 3; i++) game.completeNextTask();
    expect(demoTree(game).tasksDone).toBe(3);
    expect(stageOf(demoTree(game))).toBe(2);
  });

  it('completes the demo sapling after 18 tasks and frees its active slot', async () => {
    const game = await signedInGame();
    for (let i = 0; i < TASKS_PER_TREE; i++) game.completeNextTask();
    const state = game.state();
    expect(demoTree(game).tasksDone).toBe(TASKS_PER_TREE);
    expect(stageOf(demoTree(game))).toBe(5);
    expect(activeTrees(state.trees)).toHaveLength(0); // slot freed, tree stays
    expect(state.trees).toHaveLength(1);
    // The freed slot lets a full new set of trees be planted.
    expect(game.plantAt({ x: 4, y: 4 }, GOAL_TEMPLATES.sleep, 'A').ok).toBe(true);
    expect(game.plantAt({ x: 1, y: 4 }, GOAL_TEMPLATES.workout, 'A').ok).toBe(true);
    expect(game.plantAt({ x: 4, y: 1 }, GOAL_TEMPLATES.sleep, 'A').ok).toBe(true);
  });

  it('further task completions on a complete tree are no-ops', async () => {
    const game = await signedInGame();
    for (let i = 0; i < TASKS_PER_TREE + 3; i++) game.completeNextTask();
    expect(demoTree(game).tasksDone).toBe(TASKS_PER_TREE);
  });
});

describe('planting — placement rules and world conversion', () => {
  it('allows planting on unlocked dead and vibrant tiles', async () => {
    const game = await signedInGame();
    expect(tileState(game.state().world, { x: 4, y: 4 })).toBe('dead');
    expect(game.canPlantAt({ x: 4, y: 4 }).ok).toBe(true);
    expect(tileState(game.state().world, { x: 0, y: 0 })).toBe('vibrant');
    expect(game.canPlantAt({ x: 0, y: 0 }).ok).toBe(true);
    expect(game.plantAt({ x: 4, y: 4 }, GOAL_TEMPLATES.workout, 'A').ok).toBe(true);
  });

  it('blocks planting on fog and on occupied tiles, leaving state untouched', async () => {
    const game = await signedInGame();
    const before = game.state();
    const fogged = game.plantAt({ x: 7, y: 1 }, GOAL_TEMPLATES.sleep, 'A'); // section 2 is fog
    expect(fogged).toEqual({ ok: false, reason: 'fogged' });
    const occupied = game.plantAt(DEMO_TILE, GOAL_TEMPLATES.sleep, 'A');
    expect(occupied).toEqual({ ok: false, reason: 'occupied' });
    expect(game.state()).toEqual(before);
  });

  it('rejects a 4th active tree', async () => {
    const game = await signedInGame(); // demo sapling = 1 active
    expect(game.plantAt({ x: 4, y: 4 }, GOAL_TEMPLATES.sleep, 'A').ok).toBe(true);
    expect(game.plantAt({ x: 1, y: 4 }, GOAL_TEMPLATES.workout, 'A').ok).toBe(true);
    const fourth = game.plantAt({ x: 4, y: 1 }, GOAL_TEMPLATES.sleep, 'A');
    expect(fourth).toEqual({ ok: false, reason: 'cap' });
    expect(game.state().trees).toHaveLength(3);
  });

  it('converts the 3×3 around a plant to vibrant (reveal unchanged by vibrancy)', async () => {
    const game = await signedInGame();
    expect(game.plantAt({ x: 4, y: 4 }, GOAL_TEMPLATES.sleep, 'A').ok).toBe(true);
    const world = game.state().world;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        expect(tileState(world, { x: 4 + dx, y: 4 + dy })).toBe('vibrant');
      }
    }
    // Tiles outside the reveal stay dead — vibrancy is a separate overlay.
    expect(tileState(world, { x: 5, y: 2 })).toBe('dead');
  });
});

describe('vibrancy — per-tile view derived from all trees', () => {
  it('gives a planted tree vibrancy 3 on its tile, 2 orthogonal, 1 diagonal', async () => {
    const game = await signedInGame(); // demo sapling at (1,1) — far from (4,4)
    expect(game.tileVibrancy().get('4,4')).toBe(0);
    expect(game.plantAt({ x: 4, y: 4 }, GOAL_TEMPLATES.sleep, 'A').ok).toBe(true);
    const vibrancy = game.tileVibrancy();
    expect(vibrancy.get('4,4')).toBe(3); // own tile
    expect(vibrancy.get('5,4')).toBe(2); // orthogonal, d=1
    expect(vibrancy.get('5,5')).toBe(1); // diagonal neighbour, d=2
    // The demo sapling contributes its own pattern too.
    expect(vibrancy.get('1,1')).toBe(3);
  });

  it("stacks two trees' contributions cumulatively and clamps at 3", async () => {
    const game = await signedInGame();
    expect(game.plantAt({ x: 4, y: 4 }, GOAL_TEMPLATES.sleep, 'A').ok).toBe(true);
    expect(game.plantAt({ x: 4, y: 2 }, GOAL_TEMPLATES.workout, 'A').ok).toBe(true);
    const vibrancy = game.tileVibrancy();
    // (3,3) is d=2 from both new trees: 1 + 1 = 2 — more than either alone.
    expect(vibrancy.get('3,3')).toBe(2);
    // (4,3) is d=1 from both: 2 + 2 = 4, clamped to 3.
    expect(vibrancy.get('4,3')).toBe(3);
  });

  it('counts completed trees forever — vibrancy never regresses', async () => {
    const game = await signedInGame();
    expect(game.devPlantFullyGrown({ x: 4, y: 4 }, GOAL_TEMPLATES.sleep, 'A').ok).toBe(true);
    expect(game.tileVibrancy().get('4,4')).toBe(3); // stage-5 tree still counts
  });
});

describe('progression — fully grown trees unlock the island', () => {
  it('4 fully grown trees meet the XP requirement, lift section 2 fog, and unlock type B', async () => {
    const game = await signedInGame();
    expect(availableTreeTypes(game.state())).toEqual(['A']);

    const tiles: TileCoord[] = [
      { x: 4, y: 4 },
      { x: 1, y: 4 },
      { x: 4, y: 1 },
    ];
    for (const tile of tiles)
      expect(game.devPlantFullyGrown(tile, GOAL_TEMPLATES.sleep, 'A').ok).toBe(true);
    // 3 grown trees: not enough yet.
    expect(isSectionUnlocked(game.state().world, 2)).toBe(false);
    expect(xpProgress(game.state())).toBeLessThan(1);

    expect(game.devPlantFullyGrown({ x: 0, y: 4 }, GOAL_TEMPLATES.workout, 'A').ok).toBe(true);
    const state = game.state();
    // The 4th grown tree fills the XP requirement for section 2 …
    expect(state.trees.filter((tree) => tree.tasksDone === TASKS_PER_TREE)).toHaveLength(4);
    expect(UNLOCK_COST_BY_SECTION[2]).toBe(4);
    // … which lifts section 2's fog …
    expect(isSectionUnlocked(state.world, 2)).toBe(true);
    expect(tileState(state.world, { x: 7, y: 1 })).toBe('dead');
    // … and makes tree type B available.
    expect(availableTreeTypes(state)).toEqual(['A', 'B']);
  });
});

describe('focus — switching which tree tasks drive', () => {
  it('completeNextTask drives the focused tree only', async () => {
    const game = await signedInGame();
    game.plantAt({ x: 4, y: 4 }, GOAL_TEMPLATES.workout, 'A'); // planting focuses the new tree
    game.completeNextTask();
    let trees = game.state().trees;
    expect(trees.find((tree) => tree.id !== 'tree-demo')!.tasksDone).toBe(1);
    expect(trees.find((tree) => tree.id === 'tree-demo')!.tasksDone).toBe(0);

    game.focusTree('tree-demo');
    game.completeNextTask();
    trees = game.state().trees;
    expect(trees.find((tree) => tree.id !== 'tree-demo')!.tasksDone).toBe(1);
    expect(trees.find((tree) => tree.id === 'tree-demo')!.tasksDone).toBe(1);
  });

  it('completeTaskFor drives the named tree without moving focus', async () => {
    const game = await signedInGame();
    game.plantAt({ x: 4, y: 4 }, GOAL_TEMPLATES.workout, 'A'); // planting focuses the new tree
    const focusedId = game.state().focusedTreeId;
    game.completeTaskFor('tree-demo');
    expect(demoTree(game).tasksDone).toBe(1);
    expect(game.state().focusedTreeId).toBe(focusedId);
    game.completeTaskFor('no-such-tree'); // unknown tree is a no-op
    expect(demoTree(game).tasksDone).toBe(1);
  });

  it('a complete tree cannot be focused', async () => {
    const game = await signedInGame();
    const planted = game.devPlantFullyGrown({ x: 4, y: 4 }, GOAL_TEMPLATES.sleep, 'A');
    expect(planted.ok).toBe(true);
    game.focusTree('tree-demo');
    const grownId = game.state().trees.find((tree) => tree.id !== 'tree-demo')!.id;
    game.focusTree(grownId);
    expect(game.state().focusedTreeId).toBe('tree-demo');
    game.completeNextTask();
    expect(demoTree(game).tasksDone).toBe(1);
  });
});

describe('save — reload restores identical state', () => {
  it('replays a session from the flushed save byte-for-byte', async () => {
    const gateways = createNullGateways();
    const first = await signedInGame(gateways);
    first.finishStory();
    for (let i = 0; i < 5; i++) first.completeNextTask();
    expect(first.plantAt({ x: 4, y: 4 }, GOAL_TEMPLATES.workout, 'A').ok).toBe(true);
    first.completeNextTask();
    for (const tile of [
      { x: 1, y: 4 },
      { x: 4, y: 1 },
      { x: 0, y: 4 },
      { x: 2, y: 4 },
    ]) {
      expect(first.devPlantFullyGrown(tile, GOAL_TEMPLATES.sleep, 'A').ok).toBe(true);
    }
    expect(isSectionUnlocked(first.state().world, 2)).toBe(true); // unlock happened
    await first.flushSave();

    const second = createGame(gateways);
    const result = await second.signIn(EMAIL, PASSWORD);
    expect(result.ok).toBe(true);

    expect(second.storySeen()).toBe(true);
    expect(second.state().trees).toEqual(first.state().trees);
    expect(second.state().goals).toEqual(first.state().goals);
    const snapshot = (game: Game) =>
      toSave({
        ...game.state(),
        storySeen: game.storySeen(),
        coach: { memory: game.coachMemory(), config: game.coachConfig() },
      });
    expect(snapshot(second)).toEqual(snapshot(first));
    // Full per-tile equality, not just the serialized section list.
    for (const section of first.state().world.sections) {
      for (const tile of section.tiles) {
        expect(tileState(second.state().world, tile)).toBe(tileState(first.state().world, tile));
      }
    }
  });
});

describe('dev shortcuts', () => {
  it('devSkipStage completes exactly the remaining tasks of the current stage', async () => {
    const game = await signedInGame();
    game.devSkipStage(); // stage 1 needs 3 tasks
    expect(demoTree(game).tasksDone).toBe(3);
    expect(stageOf(demoTree(game))).toBe(2);

    game.completeNextTask(); // mid-stage: 4 done
    game.devSkipStage(); // stage 2 ends at 7
    expect(demoTree(game).tasksDone).toBe(7);
    expect(stageOf(demoTree(game))).toBe(3);

    game.devSkipStage(); // stage 3 ends at 12
    game.devSkipStage(); // stage 4 ends at 18 — complete
    expect(demoTree(game).tasksDone).toBe(TASKS_PER_TREE);
    game.devSkipStage(); // complete tree: no-op
    expect(demoTree(game).tasksDone).toBe(TASKS_PER_TREE);
  });

  it('devPlantFullyGrown plants through the normal flow and completes all 18 tasks', async () => {
    const game = await signedInGame();
    const outcome = game.devPlantFullyGrown({ x: 4, y: 4 }, GOAL_TEMPLATES.workout, 'A');
    expect(outcome.ok).toBe(true);
    const grown = game.state().trees.find((tree) => tree.id !== 'tree-demo')!;
    expect(grown.tasksDone).toBe(TASKS_PER_TREE);
    expect(game.state().goals[grown.goalId]!.name).toBe(GOAL_TEMPLATES.workout.name);
    expect(game.state().goals[grown.goalId]!.tasks.every((task) => task.done)).toBe(true);
    expect(activeTrees(game.state().trees)).toHaveLength(1); // demo only
    // The dev plant respects the same placement rules as a normal plant.
    expect(game.devPlantFullyGrown({ x: 7, y: 7 }, GOAL_TEMPLATES.sleep, 'A')).toEqual({
      ok: false,
      reason: 'fogged',
    });
  });

  it('devUnlockNextSection unlocks the cheapest locked section, ignoring its cost', async () => {
    const game = await signedInGame();
    expect(isSectionUnlocked(game.state().world, 2)).toBe(false); // 0 grown trees

    let ticks = 0;
    game.subscribe(() => {
      ticks += 1;
    });
    game.devUnlockNextSection();
    expect(isSectionUnlocked(game.state().world, 2)).toBe(true);
    expect(ticks).toBe(1);
    // Type B unlocks with the section, exactly as a legitimate unlock would.
    expect(availableTreeTypes(game.state())).toEqual(['A', 'B']);
  });

  it('devUnlockNextSection walks sections in order and no-ops when all are unlocked', async () => {
    const game = await signedInGame();
    const ids = Object.keys(UNLOCK_COST_BY_SECTION)
      .map(Number)
      .sort((a, b) => a - b);
    for (const id of ids) {
      expect(isSectionUnlocked(game.state().world, id)).toBe(false);
      game.devUnlockNextSection();
      expect(isSectionUnlocked(game.state().world, id)).toBe(true);
    }

    let ticks = 0;
    game.subscribe(() => {
      ticks += 1;
    });
    game.devUnlockNextSection(); // everything unlocked: silent no-op
    expect(ticks).toBe(0);
  });

  it('devUnlockNextSection persists — the unlock survives a save/reload cycle', async () => {
    const gateways = createNullGateways();
    const first = await signedInGame(gateways);
    first.devUnlockNextSection();
    await first.flushSave();

    const second = createGame(gateways);
    await second.signIn(EMAIL, PASSWORD);
    expect(isSectionUnlocked(second.state().world, 2)).toBe(true);
  });
});

describe('updateGoalTasks — editing an existing goal', () => {
  const customDraft = {
    name: 'Custom',
    tasks: Array.from({ length: TASKS_PER_TREE }, (_, i) => ({
      title: `task ${String(i)}`,
      estimatedMinutes: 10,
    })),
  };

  it('plants a custom (non-template) goal and persists its edited tasks across reload', async () => {
    const gateways = createNullGateways();
    const first = await signedInGame(gateways);
    expect(first.plantAt({ x: 4, y: 4 }, customDraft, 'A').ok).toBe(true);
    const goalId = first.state().trees.find((tree) => tree.id !== 'tree-demo')!.goalId;

    const edited = customDraft.tasks.map((task, i) =>
      i === 5 ? { ...task, title: 'edited upcoming' } : task,
    );
    expect(first.updateGoalTasks(goalId, 'Renamed Custom', edited)).toEqual({ ok: true });
    expect(first.state().goals[goalId]!.name).toBe('Renamed Custom');
    expect(first.state().goals[goalId]!.tasks[5]!.title).toBe('edited upcoming');
    await first.flushSave();

    const second = createGame(gateways);
    await second.signIn(EMAIL, PASSWORD);
    expect(second.state().goals[goalId]!.name).toBe('Renamed Custom');
    expect(second.state().goals[goalId]!.tasks[5]!.title).toBe('edited upcoming');
  });

  it('rejects rewriting a completed task and an unknown goal', async () => {
    const game = await signedInGame();
    game.plantAt({ x: 4, y: 4 }, customDraft, 'A');
    const tree = game.state().trees.find((candidate) => candidate.id !== 'tree-demo')!;
    game.completeTaskFor(tree.id); // task 0 is now done (locked)

    const rewrite = customDraft.tasks.map((task, i) =>
      i === 0 ? { ...task, title: 'rewritten' } : task,
    );
    expect(game.updateGoalTasks(tree.goalId, 'Custom', rewrite)).toEqual({
      ok: false,
      reason: 'locked-changed',
    });
    expect(game.updateGoalTasks('no-such-goal', 'Custom', customDraft.tasks)).toEqual({
      ok: false,
      reason: 'unknown-goal',
    });
  });
});

describe('story', () => {
  it('finishStory persists storySeen so the sequence is skipped on the next load', async () => {
    const gateways = createNullGateways();
    const first = await signedInGame(gateways);
    expect(first.storySeen()).toBe(false);
    first.finishStory();
    expect(first.storySeen()).toBe(true);
    await first.flushSave();

    const second = createGame(gateways);
    await second.signIn(EMAIL, PASSWORD);
    expect(second.storySeen()).toBe(true);
  });
});

describe('coach memory + config', () => {
  it('starts empty and appends memories FIFO-capped at MEMORY_FACT_CAP', async () => {
    const game = await signedInGame();
    expect(game.coachMemory()).toEqual({ facts: [] });
    expect(game.coachConfig()).toEqual({});

    game.appendCoachMemories(['fact 0']);
    const many = Array.from({ length: MEMORY_FACT_CAP }, (_, i) => `fact ${String(i + 1)}`);
    game.appendCoachMemories(many);

    const facts = game.coachMemory().facts;
    expect(facts).toHaveLength(MEMORY_FACT_CAP);
    expect(facts[0]).toBe('fact 1'); // the oldest fact was dropped first
    expect(facts[facts.length - 1]).toBe(`fact ${String(MEMORY_FACT_CAP)}`);
  });

  it('persists memories and config across a save/load cycle', async () => {
    const gateways = createNullGateways();
    const first = await signedInGame(gateways);
    first.appendCoachMemories(['Night owl']);
    first.setCoachConfig({ tone: 'direct', customInstructions: 'Keep it brief' });
    await first.flushSave();

    const second = createGame(gateways);
    await second.signIn(EMAIL, PASSWORD);
    expect(second.coachMemory()).toEqual({ facts: ['Night owl'] });
    expect(second.coachConfig()).toEqual({ tone: 'direct', customInstructions: 'Keep it brief' });
  });

  it('notifies subscribers on memory and config changes; empty appends are no-ops', async () => {
    const game = await signedInGame();
    let ticks = 0;
    game.subscribe(() => {
      ticks += 1;
    });
    game.appendCoachMemories([]);
    expect(ticks).toBe(0);
    game.appendCoachMemories(['fact']);
    expect(ticks).toBe(1);
    game.setCoachConfig({ tone: 'playful' });
    expect(ticks).toBe(2);
  });
});
