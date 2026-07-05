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
 * Fresh-session factory for one coach mode. Sessions always exist now — the
 * key lives server-side, so a missing key surfaces as the proxy's 503 error
 * message inside the chat, not as an offline panel.
 */
function coachFactory(mode: CoachMode, transport: CoachTransport): () => ChatSession {
  return () => createCoachSession(mode, transport);
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

  const tasksPanel = createTasksPanel({
    onCompleteTask: () => {
      game.completeNextTask();
    },
  });
  tasksPanel.el.style.maxWidth = '320px';
  dock(tasksPanel.el, { top: '16px', left: '16px' });

  const xpBar = createXpBar();
  dock(xpBar.el, { top: '16px', left: '50%', transform: 'translateX(-50%)' });

  const coachTransport = createProxyTransport();

  const reflectionModal = createReflectionModal({
    createSession: coachFactory('reflection', coachTransport),
  });
  dock(reflectionModal.el, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

  // Bottom-right corner cluster: dev panel stacked above the reflect button.
  const corner = document.createElement('div');
  corner.style.display = 'flex';
  corner.style.flexDirection = 'column';
  corner.style.alignItems = 'flex-end';
  corner.style.gap = '8px';
  dock(corner, { bottom: '16px', right: '16px' });

  const devPanel = createDevPanel({
    onSkipStage: () => {
      game.devSkipStage();
    },
  });
  corner.appendChild(devPanel.el);

  const reflect = createReflectButton({ onClick: () => reflectionModal.open() });
  corner.appendChild(reflect.el);

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
