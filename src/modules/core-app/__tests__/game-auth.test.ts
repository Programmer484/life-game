// DEBT-1: the autosave/auth path of the headless game controller.
// Fake auth gateways assert AuthResult propagation; injected AutosaverTimers
// make the debounce deterministic so the store's save calls are observable.
import { describe, expect, it } from 'vitest';
import type { AutosaverTimers, Gateways, SaveData } from '../../save/index.ts';
import { createNullGateways } from '../../save/index.ts';
import { createGame } from '../internal/game.ts';

const EMAIL = 'player@example.com';
const PASSWORD = 'hunter22';

/** Timers fake: schedule() collects callbacks; fire() runs them manually. */
function fakeTimers() {
  const scheduled = new Map<number, { callback: () => void; ms: number }>();
  let nextId = 1;
  const timers: AutosaverTimers = {
    setTimeout(callback, ms) {
      const id = nextId++;
      scheduled.set(id, { callback, ms });
      return id;
    },
    clearTimeout(id) {
      scheduled.delete(id);
    },
  };
  return {
    timers,
    pendingCount: () => scheduled.size,
    delays: () => [...scheduled.values()].map((entry) => entry.ms),
    fire() {
      const entries = [...scheduled.values()];
      scheduled.clear();
      for (const entry of entries) entry.callback();
    },
  };
}

/** Wrap gateways so every store.save payload is recorded. */
function recordSaves(gateways: Gateways): { gateways: Gateways; saves: SaveData[] } {
  const saves: SaveData[] = [];
  return {
    saves,
    gateways: {
      auth: gateways.auth,
      store: {
        load: () => gateways.store.load(),
        save(data) {
          saves.push(data);
          return gateways.store.save(data);
        },
      },
    },
  };
}

describe('auth — AuthResult propagation and hydration effects', () => {
  it('signUp succeeds on a fresh email and hydrates the demo state', async () => {
    const game = createGame(createNullGateways());
    expect(game.state().trees).toHaveLength(0); // pre-auth: empty
    const result = await game.signUp(EMAIL, PASSWORD);
    expect(result).toEqual({ ok: true });
    expect(game.state().trees.map((tree) => tree.id)).toEqual(['tree-demo']);
    expect(game.state().focusedTreeId).toBe('tree-demo');
  });

  it('signUp on an existing email fails with the gateway error, state untouched', async () => {
    const game = createGame(createNullGateways({ users: { [EMAIL]: PASSWORD } }));
    const result = await game.signUp(EMAIL, 'another-password');
    expect(result).toEqual({ ok: false, error: 'An account with this email already exists' });
    expect(game.state().trees).toHaveLength(0); // failure must not hydrate
  });

  it('signIn succeeds for a seeded user and hydrates', async () => {
    const game = createGame(createNullGateways({ users: { [EMAIL]: PASSWORD } }));
    const result = await game.signIn(EMAIL, PASSWORD);
    expect(result).toEqual({ ok: true });
    expect(game.state().trees.map((tree) => tree.id)).toEqual(['tree-demo']);
  });

  it('signIn with a wrong password fails with the gateway error, state untouched', async () => {
    const game = createGame(createNullGateways({ users: { [EMAIL]: PASSWORD } }));
    const result = await game.signIn(EMAIL, 'wrong');
    expect(result).toEqual({ ok: false, error: 'Invalid email or password' });
    expect(game.state().trees).toHaveLength(0);
  });
});

describe('autosave — debounced persist through injected timers', () => {
  it('persists to the store only after the debounce timer fires', async () => {
    const clock = fakeTimers();
    const recorded = recordSaves(createNullGateways());
    const game = createGame(recorded.gateways, clock.timers);
    await game.signUp(EMAIL, PASSWORD);

    game.completeNextTask();
    expect(recorded.saves).toHaveLength(0); // scheduled, not yet persisted
    expect(clock.delays()).toEqual([800]);

    clock.fire();
    await game.flushSave(); // drain the fired persist's microtask
    expect(recorded.saves).toHaveLength(1);
    expect(recorded.saves[0]!.trees.find((tree) => tree.id === 'tree-demo')!.tasksDone).toBe(1);
  });

  it('debounces: rapid changes collapse into one save with the latest state', async () => {
    const clock = fakeTimers();
    const recorded = recordSaves(createNullGateways());
    const game = createGame(recorded.gateways, clock.timers);
    await game.signUp(EMAIL, PASSWORD);

    game.completeNextTask();
    game.completeNextTask();
    game.finishStory();
    expect(clock.pendingCount()).toBe(1); // earlier timers were cleared

    clock.fire();
    await game.flushSave();
    expect(recorded.saves).toHaveLength(1);
    expect(recorded.saves[0]!.storySeen).toBe(true);
    expect(recorded.saves[0]!.trees.find((tree) => tree.id === 'tree-demo')!.tasksDone).toBe(2);
  });

  it('flushSave persists pending data immediately and cancels the timer', async () => {
    const clock = fakeTimers();
    const recorded = recordSaves(createNullGateways());
    const game = createGame(recorded.gateways, clock.timers);
    await game.signUp(EMAIL, PASSWORD);

    game.completeNextTask();
    await game.flushSave();
    expect(recorded.saves).toHaveLength(1);
    expect(clock.pendingCount()).toBe(0); // timer cancelled, no double save
    clock.fire();
    expect(recorded.saves).toHaveLength(1);
  });

  it('flushSave with nothing pending is a no-op', async () => {
    const recorded = recordSaves(createNullGateways());
    const game = createGame(recorded.gateways, fakeTimers().timers);
    await game.signUp(EMAIL, PASSWORD);
    await game.flushSave();
    expect(recorded.saves).toHaveLength(0);
  });
});

describe('treeViewModels — precomputed render markers', () => {
  it('exposes id/tile/type/stage per tree, with tile copied not aliased', async () => {
    const game = createGame(createNullGateways());
    await game.signUp(EMAIL, PASSWORD);
    const [model] = game.treeViewModels();
    expect(model).toEqual({ id: 'tree-demo', tile: { x: 1, y: 1 }, type: 'A', stage: 1 });
    expect(model!.tile).not.toBe(game.state().trees[0]!.tile); // defensive copy
  });
});
