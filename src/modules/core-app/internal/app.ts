// Pixi 8 bootstrap (async init): kept thin and untested (see .task/spec.md).
import { Application } from 'pixi.js';
import { createWorld } from '../../world/index.ts';
import { drawWorld } from '../../render/index.ts';
import { createViewport } from '../../core-viewport/index.ts';

/** Boot Pixi, mount the canvas, and show the island centered in a pannable view. */
export async function startApp(canvasHost: HTMLElement): Promise<void> {
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x08080c, antialias: true });
  canvasHost.appendChild(app.canvas);

  const viewport = createViewport(app);
  app.stage.addChild(viewport);

  const island = drawWorld(createWorld());
  viewport.addChild(island);

  const bounds = island.getLocalBounds();
  viewport.moveCenter(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}
