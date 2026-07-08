// Headless game controller: the full v1 event flow with NO Pixi and NO DOM.
// The thin shell (app.ts) drives it through these methods and subscribes for
// re-renders; the acceptance tests drive it over the null gateways.
import type { CoachConfig, CoachMemory } from '../../coach/index.ts';
import { appendMemoryFacts } from '../../coach/index.ts';
import type {
  GoalTemplate,
  GrowthStage,
  TaskDef,
  TileCoord,
  TreeType,
  Vibrancy,
} from '../../config/index.ts';
import { TASKS_PER_TREE, UNLOCK_COST_BY_SECTION } from '../../config/index.ts';
import { createGoal, nextTaskIndex, taskCompletedEvent } from '../../entities/index.ts';
import type { AuthResult, AutosaverTimers, Gateways } from '../../save/index.ts';
import { createAutosaver, loadOrCreate } from '../../save/index.ts';
import type { GameplayState, GoalEditRejection, PlantRejection } from '../../systems/index.ts';
import {
  activeTrees,
  applyProgression,
  applyTaskCompleted,
  canPlant,
  focusTree as applyFocus,
  focusedTree,
  isComplete,
  plantTree,
  stageOf,
  updateGoalTasks as applyGoalEdit,
} from '../../systems/index.ts';
import { createWorld, isSectionUnlocked, unlockSection, vibrancyMap } from '../../world/index.ts';

/** A player-authored (or template-derived) goal: a name plus its 18 tasks. */
export type GoalDraft = GoalTemplate;

export type PlantOutcome = { ok: true; treeId: string } | { ok: false; reason: PlantRejection };

export type GoalEditOutcome = { ok: true } | { ok: false; reason: GoalEditRejection };

/** Precomputed marker data for render — keeps game logic out of render. */
export interface TreeViewModel {
  id: string;
  tile: TileCoord;
  type: TreeType;
  stage: GrowthStage;
}

export interface Game {
  state(): GameplayState;
  /** Listener runs after every state change; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  storySeen(): boolean;
  finishStory(): void;
  /** Complete the focused tree's next task; no-op without a focused tree. */
  completeNextTask(): void;
  /** Complete `treeId`'s next task; no-op for unknown or complete trees. */
  completeTaskFor(treeId: string): void;
  plantAt(tile: TileCoord, draft: GoalDraft, type: TreeType): PlantOutcome;
  canPlantAt(tile: TileCoord): ReturnType<typeof canPlant>;
  focusTree(id: string): void;
  /** Replace a goal's task list (editing an existing tree); rejection is typed. */
  updateGoalTasks(goalId: string, tasks: readonly TaskDef[]): GoalEditOutcome;
  /** Dev: complete the focused tree's remaining tasks in its CURRENT stage. */
  devSkipStage(): void;
  /** Dev: the normal plant flow, then all 18 tasks completed (PRD shortcut). */
  devPlantFullyGrown(tile: TileCoord, draft: GoalDraft, type: TreeType): PlantOutcome;
  /** Dev: unlock the cheapest locked section, ignoring its cost; no-op when none left. */
  devUnlockNextSection(): void;
  /** Persist any pending autosave immediately (used on reload/teardown). */
  flushSave(): Promise<void>;
  coachMemory(): CoachMemory;
  coachConfig(): CoachConfig;
  /** Append coach memories (FIFO-capped in the coach module); autosaved. */
  appendCoachMemories(facts: readonly string[]): void;
  setCoachConfig(config: CoachConfig): void;
  treeViewModels(): TreeViewModel[];
  /**
   * Precomputed per-tile vibrancy for render, keyed `"x,y"` over every island
   * tile. Derived from ALL trees' tiles (any stage — trees are never removed).
   */
  tileVibrancy(): ReadonlyMap<string, Vibrancy>;
}

const AUTOSAVE_DEBOUNCE_MS = 800;

export function createGame(gateways: Gateways, timers?: AutosaverTimers): Game {
  let state: GameplayState = { world: createWorld(), trees: [], goals: {} };
  let seenStory = false;
  let coachMemory: CoachMemory = { facts: [] };
  let coachConfig: CoachConfig = {};
  const autosaver = createAutosaver(gateways.store, AUTOSAVE_DEBOUNCE_MS, timers);
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function persist(): void {
    autosaver.schedule({
      world: state.world,
      trees: state.trees,
      goals: state.goals,
      storySeen: seenStory,
      coach: { memory: coachMemory, config: coachConfig },
    });
  }

  async function hydrate(): Promise<void> {
    const loaded = await loadOrCreate(gateways.store);
    // Focus defaults to the most recently planted active tree (save order is
    // plant order) — for the demo state, the preplanted sapling.
    const active = activeTrees(loaded.trees);
    state = {
      world: loaded.world,
      trees: loaded.trees,
      goals: loaded.goals,
      focusedTreeId: active[active.length - 1]?.id,
    };
    seenStory = loaded.storySeen;
    coachMemory = loaded.coach.memory;
    coachConfig = loaded.coach.config;
    notify();
  }

  async function authenticate(attempt: Promise<AuthResult>): Promise<AuthResult> {
    const result = await attempt;
    if (result.ok) await hydrate();
    return result;
  }

  /** Complete `treeId`'s next task; apply growth + progression + autosave. */
  function completeFor(treeId: string): void {
    const tree = state.trees.find((candidate) => candidate.id === treeId);
    if (!tree || isComplete(tree)) return;
    const goal = state.goals[tree.goalId];
    if (!goal) return;
    const next = nextTaskIndex(goal);
    if (next === undefined) return;
    const grown = applyTaskCompleted(state, taskCompletedEvent(tree.id, next));
    state = applyProgression({ ...state, trees: grown.trees, goals: grown.goals });
    persist();
    notify();
  }

  function plantAt(tile: TileCoord, draft: GoalDraft, type: TreeType): PlantOutcome {
    const serial = String(state.trees.length + 1);
    const goal = createGoal(`goal-${serial}`, draft);
    const planted = plantTree(state, { id: `tree-${serial}`, tile, type, goal });
    if (planted.rejected !== undefined) return { ok: false, reason: planted.rejected };
    state = applyProgression(planted.state);
    persist();
    notify();
    return { ok: true, treeId: `tree-${serial}` };
  }

  return {
    state: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn: (email, password) => authenticate(gateways.auth.signIn(email, password)),
    signUp: (email, password) => authenticate(gateways.auth.signUp(email, password)),
    storySeen: () => seenStory,
    finishStory() {
      if (seenStory) return;
      seenStory = true;
      persist();
      notify();
    },
    completeNextTask() {
      const tree = focusedTree(state);
      if (tree) completeFor(tree.id);
    },
    completeTaskFor(treeId) {
      completeFor(treeId);
    },
    plantAt,
    canPlantAt: (tile) => canPlant(state, tile),
    focusTree(id) {
      const next = applyFocus(state, id);
      if (next === state) return;
      state = next;
      notify();
    },
    updateGoalTasks(goalId, tasks) {
      const result = applyGoalEdit(state, goalId, tasks);
      if (!result.ok) return result;
      state = result.state;
      persist();
      notify();
      return { ok: true };
    },
    devSkipStage() {
      let tree = focusedTree(state);
      if (!tree) return;
      const treeId = tree.id;
      const startStage = stageOf(tree);
      while (tree && !isComplete(tree) && stageOf(tree) === startStage) {
        const before = tree.tasksDone;
        completeFor(treeId);
        tree = state.trees.find((candidate) => candidate.id === treeId);
        if (tree && tree.tasksDone === before) return; // guard against stalls
      }
    },
    devPlantFullyGrown(tile, draft, type) {
      const previousFocus = state.focusedTreeId;
      const outcome = plantAt(tile, draft, type);
      if (!outcome.ok) return outcome;
      for (let i = 0; i < TASKS_PER_TREE; i++) completeFor(outcome.treeId);
      // The finished tree cannot stay focused — restore the previous focus.
      state = { ...state, focusedTreeId: previousFocus };
      notify();
      return outcome;
    },
    devUnlockNextSection() {
      // Explicit dev bypass at the game layer: the systems progression rules
      // (cost thresholds) are untouched — this jumps straight to the world op.
      const next = Object.keys(UNLOCK_COST_BY_SECTION)
        .map(Number)
        .sort((a, b) => a - b)
        .find((id) => !isSectionUnlocked(state.world, id));
      if (next === undefined) return;
      state = { ...state, world: unlockSection(state.world, next) };
      persist();
      notify();
    },
    flushSave: () => autosaver.flush(),
    coachMemory: () => coachMemory,
    coachConfig: () => coachConfig,
    appendCoachMemories(facts) {
      if (facts.length === 0) return;
      coachMemory = appendMemoryFacts(coachMemory, facts);
      persist();
      notify();
    },
    setCoachConfig(config) {
      coachConfig = { ...config };
      persist();
      notify();
    },
    treeViewModels: () =>
      state.trees.map((tree) => ({
        id: tree.id,
        tile: { ...tree.tile },
        type: tree.type,
        stage: stageOf(tree),
      })),
    tileVibrancy: () =>
      vibrancyMap(
        state.world,
        state.trees.map((tree) => tree.tile),
      ),
  };
}
