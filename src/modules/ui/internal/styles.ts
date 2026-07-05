/**
 * Design tokens + shared `lg-` classes for every ui component.
 *
 * `ensureStyles()` injects one `<style id="lg-styles">` tag into
 * `document.head`, exactly once — component factories call it on creation
 * (wired in slice B2) so styles exist before any component renders.
 */

const STYLE_ID = 'lg-styles';

const CSS = /* css */ `
:root {
  --lg-bg-panel: #1e222c;
  --lg-fg: #e8e6e1;
  --lg-accent: #64a047;
  --lg-accent-bright: #9eca4e;
  --lg-accent-2: #309395;
  --lg-accent-2-deep: #185e6b;
  --lg-danger: #c0503e;
  --lg-radius: 6px;
  --lg-space-1: 4px;
  --lg-space-2: 8px;
  --lg-space-3: 16px;
  --lg-font: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --lg-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
}

.lg-btn {
  display: inline-block;
  padding: var(--lg-space-1) var(--lg-space-3);
  border: 1px solid transparent;
  border-radius: var(--lg-radius);
  background: #333944;
  color: var(--lg-fg);
  font-family: var(--lg-font);
  font-size: 14px;
  line-height: 1.4;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.lg-btn:hover:not(:disabled) {
  background: #3e4552;
}
.lg-btn:active:not(:disabled) {
  background: #2a2f39;
}
.lg-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.lg-btn--primary {
  background: var(--lg-accent);
  color: #10130d;
}
.lg-btn--primary:hover:not(:disabled) {
  background: var(--lg-accent-bright);
}
.lg-btn--primary:active:not(:disabled) {
  background: #558b3c;
}

.lg-btn--ghost {
  background: transparent;
  border-color: rgba(232, 230, 225, 0.25);
}
.lg-btn--ghost:hover:not(:disabled) {
  background: rgba(232, 230, 225, 0.08);
  border-color: rgba(232, 230, 225, 0.45);
}
.lg-btn--ghost:active:not(:disabled) {
  background: rgba(232, 230, 225, 0.14);
}

.lg-btn--danger {
  background: var(--lg-danger);
  color: #fff4f0;
}
.lg-btn--danger:hover:not(:disabled) {
  background: #d4644f;
}
.lg-btn--danger:active:not(:disabled) {
  background: #a5432f;
}

.lg-panel {
  padding: var(--lg-space-3);
  border-radius: var(--lg-radius);
  background: var(--lg-bg-panel);
  color: var(--lg-fg);
  font-family: var(--lg-font);
  box-shadow: var(--lg-shadow);
}

.lg-modal-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(25, 28, 35, 0.7);
}

.lg-modal {
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  padding: var(--lg-space-3);
  border-radius: var(--lg-radius);
  background: var(--lg-bg-panel);
  color: var(--lg-fg);
  font-family: var(--lg-font);
  box-shadow: var(--lg-shadow);
}

.lg-input {
  padding: var(--lg-space-1) var(--lg-space-2);
  border: 1px solid #333944;
  border-radius: var(--lg-radius);
  background: #191c23;
  color: var(--lg-fg);
  font-family: var(--lg-font);
  font-size: 14px;
}
.lg-input:focus {
  outline: none;
  border-color: var(--lg-accent);
  box-shadow: 0 0 0 2px rgba(100, 160, 71, 0.35);
}

.lg-bar {
  overflow: hidden;
  height: var(--lg-space-2);
  border-radius: var(--lg-radius);
  background: #191c23;
}
.lg-bar__fill {
  height: 100%;
  background: var(--lg-accent);
  transition: width 0.3s ease;
}
.lg-bar__fill[data-full],
.lg-bar[data-full] .lg-bar__fill {
  background: var(--lg-accent-bright);
  box-shadow: 0 0 8px rgba(158, 202, 78, 0.8);
  animation: lg-bar-pulse 1.2s ease-in-out infinite;
}
@keyframes lg-bar-pulse {
  0%,
  100% {
    box-shadow: 0 0 4px rgba(158, 202, 78, 0.5);
  }
  50% {
    box-shadow: 0 0 12px rgba(158, 202, 78, 0.9);
  }
}

.lg-hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  font-family: var(--lg-font);
}
.lg-hud > * {
  position: absolute;
  pointer-events: auto;
}

.lg-prose {
  max-width: 36rem;
  font-size: 1.125rem;
  line-height: 1.7;
}
`;

/** Inject the shared stylesheet into `document.head` exactly once. */
export function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
