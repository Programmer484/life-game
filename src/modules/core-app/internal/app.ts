// Pixi/DOM shell: kept thin and untested by design. Every game
// decision lives in game.ts — this file only wires DOM/Pixi events to the
// controller and re-renders on its subscribe ticks.
import { Application, Container } from 'pixi.js';
import { loadArt } from '../../assets/index.ts';
import type { CoachMode, CoachTransport } from '../../coach/index.ts';
import { createAnthropicTransport, createCoachSession } from '../../coach/index.ts';
import { createViewport } from '../../core-viewport/index.ts';
import { drawWorld, screenToTile, updateTrees, updateWorld } from '../../render/index.ts';
import type { Gateways } from '../../save/index.ts';
import { createNullGateways, createSupabaseGateways } from '../../save/index.ts';
import type { ChatSession } from '../../ui/index.ts';
import {
  createAuthScreen,
  createDevPanel,
  createPlantingModal,
  createReflectButton,
  createReflectionModal,
  createStoryScreen,
  createTasksPanel,
  createXpBar,
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

/**
 * Anthropic transport when the API key is present; undefined otherwise
 * (the ui chat panels render their offline notice).
 */
function chooseCoachTransport(): CoachTransport | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const apiKey = env['VITE_ANTHROPIC_API_KEY'];
  if (apiKey === undefined || apiKey === '') {
    console.info('[life-game] coach: offline (no VITE_ANTHROPIC_API_KEY)');
    return undefined;
  }
  console.info('[life-game] coach: Anthropic transport');
  return createAnthropicTransport(apiKey);
}

/** Fresh-session factory for one coach mode, or undefined when offline. */
function coachFactory(
  mode: CoachMode,
  transport: CoachTransport | undefined,
): (() => ChatSession) | undefined {
  return transport ? () => createCoachSession(mode, transport) : undefined;
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

  // ── DOM overlay ────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  host.appendChild(overlay);

  const dock = (el: HTMLElement, position: Partial<CSSStyleDeclaration>): void => {
    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    Object.assign(el.style, position);
    overlay.appendChild(el);
  };

  const tasksPanel = createTasksPanel({
    onCompleteTask: () => {
      game.completeNextTask();
    },
  });
  tasksPanel.el.style.background = 'rgba(10, 14, 20, 0.85)';
  tasksPanel.el.style.color = '#e8e6df';
  tasksPanel.el.style.padding = '12px';
  tasksPanel.el.style.maxWidth = '320px';
  dock(tasksPanel.el, { top: '16px', right: '16px' });

  const xpBar = createXpBar();
  dock(xpBar.el, { top: '16px', left: '50%', transform: 'translateX(-50%)' });

  const coachTransport = chooseCoachTransport();

  const reflectionModal = createReflectionModal({
    createSession: coachFactory('reflection', coachTransport),
  });
  dock(reflectionModal.el, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

  const reflect = createReflectButton({ onClick: () => reflectionModal.open() });
  dock(reflect.el, { bottom: '16px', right: '16px' });

  const devPanel = createDevPanel({
    onSkipStage: () => {
      game.devSkipStage();
    },
  });
  devPanel.el.style.background = 'rgba(10, 14, 20, 0.85)';
  devPanel.el.style.color = '#e8e6df';
  devPanel.el.style.padding = '8px';
  dock(devPanel.el, { bottom: '16px', left: '16px' });

  const modal = createPlantingModal({
    onPlant: ({ tile, templateKey, type, grown }) => {
      if (grown) game.devPlantFullyGrown(tile, templateKey, type);
      else game.plantAt(tile, templateKey, type);
    },
    createGoalChat: coachFactory('goal', coachTransport),
  });
  dock(modal.el, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

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
    if (game.canPlantAt(tile).ok) modal.open(state, tile);
  });

  // ── Re-render everything on every controller change ───────────────────────
  const rerender = (): void => {
    const state = game.state();
    updateWorld(worldLayer, state.world, game.tileVibrancy(), textures);
    updateTrees(treeLayer, game.treeViewModels(), textures);
    tasksPanel.update(state);
    xpBar.update(state);
    devPanel.update(state);
  };
  game.subscribe(rerender);
  rerender();
}
