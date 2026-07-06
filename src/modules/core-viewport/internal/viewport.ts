// Pixi-touching wrapper: kept thin and untested by design (shell gate).
import { Viewport } from 'pixi-viewport';
import type { Application } from 'pixi.js';

/** pixi-viewport with click-drag panning enabled. Add world content as children. */
export function createViewport(app: Application): Viewport {
  const viewport = new Viewport({
    screenWidth: app.screen.width,
    screenHeight: app.screen.height,
    events: app.renderer.events,
  });
  viewport.drag();
  return viewport;
}
