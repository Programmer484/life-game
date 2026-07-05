// Public surface of the core-viewport module. Other modules import ONLY from here.
// Only this module may import pixi-viewport; the Viewport type is re-exported
// so consumers (core-app) never touch the package directly.
export type { Viewport } from 'pixi-viewport';
export { createViewport } from './internal/viewport.ts';
