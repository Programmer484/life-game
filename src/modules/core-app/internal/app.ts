// Pixi/DOM shell: kept thin and untested by design. Every game
// decision lives in game.ts — this file only wires DOM/Pixi events to the
// controller and re-renders on its subscribe ticks.
import { Application, Container } from 'pixi.js';
import { loadArt } from '../../assets/index.ts';
import type { CoachMode, CoachTransport } from '../../coach/index.ts';
import { createCoachSession, createProxyTransport } from '../../coach/index.ts';
import { createViewport } from '../../core-viewport/index.ts';
import { drawWorld, screenToTile, updateTrees, updateWorld } from '../../render/index.ts';
import type { Gateways } from '../../save/index.ts';
import { createNullGateways, createSupabaseGateways } from '../../save/index.ts';
import type { ChatSession } from '../../ui/index.ts';
import {
  createAuthScreen,
  createDevHelpModal,
  createDevPanel,
  createEditGoalModal,
  createPlantingModal,
  createReflectButton,
  createReflectionModal,
  createShortcuts,
  createStoryScreen,
  createTasksPanel,
  createToastHost,
  createTreeSlots,
  createXpBar,
  isDevMode,
  plantRejectionFeedback,
} from '../../ui/index.ts';
import type { Game } from './game.ts';
import { createGame } from './game.ts';

/** Supabase when both env vars are present; the null gateways otherwise. */
function chooseGateways(): Gateways {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const url = env['VITE_SUPABASE_URL'];
  const anonKey = env['VITE_SUPABASE_ANON_KEY'];
  if (url !== undefined && url !== '' && anonKey !== undefined && anonKey !== '') {
    console.info('[life-game] persistence: Supabase gateways');
    return createSupabaseGateways(url, anonKey);
  }
  console.info('[life-game] persistence: in-memory null gateways (dev fallback)');
  return createNullGateways();
}

/** Whether this is a dev build (Vite sets `import.meta.env.DEV`). */
function isDevBuild(): boolean {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
  return env['DEV'] === true;
}

/**
 * Fresh-session factory for one coach mode. Sessions always exist now — the
 * key lives server-side, so a missing key surfaces as the proxy's 503 error
 * message inside the chat, not as an offline panel.
 */
function coachFactory(mode: CoachMode, transport: CoachTransport, game: Game): () => ChatSession {
  return () =>
    createCoachSession(mode, transport, {
      memory: game.coachMemory(),
      config: game.coachConfig(),
      // goalTemplate effects surface here too; the planting flow consumes
      // them in a later slice — for now only memories are applied.
      onEffects: (effects) => {
        if (effects.memories !== undefined) game.appendCoachMemories(effects.memories);
      },
    });
}

/** Boot the shell: auth screen → (first run) story → island scene. */
export async function startApp(host: HTMLElement): Promise<void> {
  const game = createGame(chooseGateways());

  let entered = false;
  const enter = (): void => {
    if (entered) return;
    entered = true;
    auth.hide();
    if (!game.storySeen()) {
      const story = createStoryScreen({
        onFinished: () => {
          game.finishStory();
        },
      });
      host.appendChild(story.el);
    }
    void startIsland(host, game);
  };

  const auth = createAuthScreen({
    onSignIn: (email, password) => {
      void game.signIn(email, password).then((result) => {
        if (result.ok) enter();
        else auth.showError(result.error);
      });
    },
    onSignUp: (email, password) => {
      void game.signUp(email, password).then((result) => {
        if (result.ok) enter();
        else auth.showError(result.error);
      });
    },
  });
  host.appendChild(auth.el);
}

/** The island scene: world + tree markers in a pannable viewport + overlay UI. */
async function startIsland(host: HTMLElement, game: Game): Promise<void> {
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x08080c, antialias: true });
  host.appendChild(app.canvas);

  const viewport = createViewport(app);
  app.stage.addChild(viewport);

  const textures = await loadArt();
  const worldLayer = drawWorld(game.state().world, game.tileVibrancy(), textures);
  const treeLayer = new Container();
  viewport.addChild(worldLayer, treeLayer);

  viewport.setZoom(2);
  const bounds = worldLayer.getLocalBounds();
  viewport.moveCenter(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);

  // ── DOM overlay: the fixed HUD layer (.lg-hud makes children interactive) ──
  const overlay = document.createElement('div');
  overlay.className = 'lg-hud';
  host.appendChild(overlay);

  const dock = (el: HTMLElement, position: Partial<CSSStyleDeclaration>): void => {
    Object.assign(el.style, position);
    overlay.appendChild(el);
  };

  // Toast host positions itself (fixed bottom-center) — appended, not docked.
  const toasts = createToastHost();
  overlay.appendChild(toasts.el);

  /** Toast a plant rejection; off-island taps stay silent. */
  const toastRejection = (
    reason: Parameters<typeof plantRejectionFeedback>[0],
    source: 'tap' | 'plant',
  ): void => {
    const feedback = plantRejectionFeedback(reason, source);
    if (feedback) toasts.show(feedback.message, feedback.variant);
  };

  // Built before the tasks panel so its "Edit tasks" button can open it.
  const editGoalModal = createEditGoalModal({
    onSave: (goalId, name, tasks) => {
      const outcome = game.updateGoalTasks(goalId, name, tasks);
      if (!outcome.ok) toasts.show('That edit was rejected — try again.', 'error');
    },
  });
  dock(editGoalModal.el, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

  const tasksPanel = createTasksPanel({
    onCompleteTask: (treeId) => {
      game.completeTaskFor(treeId);
    },
    onFocusTree: (treeId) => {
      game.focusTree(treeId);
    },
    onEditGoal: (goalId) => {
      const goal = game.state().goals[goalId];
      if (goal) editGoalModal.open(goal);
    },
  });
  tasksPanel.el.style.maxWidth = '320px';
  dock(tasksPanel.el, { top: '16px', left: '16px' });

  const xpBar = createXpBar();
  dock(xpBar.el, { top: '16px', left: '50%', transform: 'translateX(-50%)' });

  const treeSlots = createTreeSlots();
  dock(treeSlots.el, { top: '40px', left: '50%', transform: 'translateX(-50%)' });

  const coachTransport = createProxyTransport();

  const reflectionModal = createReflectionModal({
    createSession: coachFactory('reflection', coachTransport, game),
  });
  dock(reflectionModal.el, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

  // Bottom-right corner cluster: dev panel stacked above the reflect button.
  const corner = document.createElement('div');
  corner.style.display = 'flex';
  corner.style.flexDirection = 'column';
  corner.style.alignItems = 'flex-end';
  corner.style.gap = '8px';
  dock(corner, { bottom: '16px', right: '16px' });

  const reflect = createReflectButton({ onClick: () => reflectionModal.open() });
  corner.appendChild(reflect.el);

  // Assigned by the dev-tools block below; absent in production builds.
  let devPanel: ReturnType<typeof createDevPanel> | undefined;

  const modal = createPlantingModal({
    onPlant: ({ tile, type, goal }) => {
      const outcome = devPanel?.isPlantGrownEnabled()
        ? game.devPlantFullyGrown(tile, goal, type)
        : game.plantAt(tile, goal, type);
      if (!outcome.ok) toastRejection(outcome.reason, 'plant');
    },
    // The goal-drafting chat: surface the coach's goalTemplate effect to the
    // wizard (converting the coach's `minutes` to the task's estimatedMinutes)
    // while still applying any memories through the game.
    createGoalChat: (onDraft) =>
      createCoachSession('goal', coachTransport, {
        memory: game.coachMemory(),
        config: game.coachConfig(),
        onEffects: (effects) => {
          if (effects.memories !== undefined) game.appendCoachMemories(effects.memories);
          if (effects.goalTemplate !== undefined) {
            onDraft({
              name: effects.goalTemplate.name,
              tasks: effects.goalTemplate.tasks.map((task) => ({
                title: task.title,
                estimatedMinutes: task.minutes,
              })),
            });
          }
        },
      }),
  });
  dock(modal.el, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

  // ── Dev tools: panel + help modal + shortcuts, rendered only in dev mode ──
  if (isDevMode(window.location.search, window.localStorage, isDevBuild())) {
    const helpModal = createDevHelpModal();
    dock(helpModal.el, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

    const panel = createDevPanel({
      onSkipStage: () => {
        game.devSkipStage();
      },
      onCompleteTask: () => {
        game.completeNextTask();
      },
      onUnlockSection: () => {
        game.devUnlockNextSection();
      },
      onHelp: () => helpModal.open(),
    });
    devPanel = panel;
    corner.insertBefore(panel.el, reflect.el); // stacked above the reflect button

    const shortcuts = createShortcuts({
      isModalOpen: () =>
        modal.isOpen() || editGoalModal.isOpen() || reflectionModal.isOpen() || helpModal.isOpen(),
    });
    shortcuts.register('1', () => {
      game.devSkipStage();
    });
    shortcuts.register('2', () => {
      game.completeNextTask();
    });
    shortcuts.register('3', () => panel.togglePlantGrown());
    shortcuts.register('4', () => {
      game.devUnlockNextSection();
    });
    shortcuts.register('?', () => helpModal.open());
    shortcuts.register('`', () => panel.toggleCollapsed());
  }

  // ── Clicks: tap a tree to focus it; tap plantable ground to plant ─────────
  viewport.on('clicked', (event: { world: { x: number; y: number } }) => {
    const tile = screenToTile({ x: event.world.x, y: event.world.y });
    const state = game.state();
    const tree = state.trees.find(
      (candidate) => candidate.tile.x === tile.x && candidate.tile.y === tile.y,
    );
    if (tree) {
      game.focusTree(tree.id);
      return;
    }
    const verdict = game.canPlantAt(tile);
    if (verdict.ok) modal.open(state, tile);
    else toastRejection(verdict.reason, 'tap');
  });

  // ── Re-render everything on every controller change ───────────────────────
  const rerender = (): void => {
    const state = game.state();
    updateWorld(worldLayer, state.world, game.tileVibrancy(), textures);
    updateTrees(treeLayer, game.treeViewModels(), textures);
    tasksPanel.update(state);
    xpBar.update(state);
    treeSlots.update(state);
    devPanel?.update(state);
  };
  game.subscribe(rerender);
  rerender();
}
