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
.lg-input--error {
  border-color: var(--lg-danger);
}
.lg-input--error:focus {
  border-color: var(--lg-danger);
  box-shadow: 0 0 0 2px rgba(192, 80, 62, 0.35);
}

/* ── Wizard (planting modal) ─────────────────────────────────────────── */
.lg-steps {
  display: flex;
  gap: var(--lg-space-2);
  margin-bottom: var(--lg-space-3);
  font-size: 12px;
  opacity: 0.7;
}
.lg-steps__step[data-active] {
  color: var(--lg-accent-bright);
  opacity: 1;
  font-weight: 600;
}
.lg-step {
  animation: lg-step-in 0.18s ease-out;
}
@keyframes lg-step-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lg-step {
    animation: none;
  }
}
.lg-option-cards {
  display: flex;
  gap: var(--lg-space-2);
  margin: var(--lg-space-2) 0;
}
.lg-option-card {
  flex: 1;
  padding: var(--lg-space-3);
  border: 1px solid rgba(232, 230, 225, 0.25);
  border-radius: var(--lg-radius);
  background: #191c23;
  color: var(--lg-fg);
  font-family: var(--lg-font);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.lg-option-card[aria-pressed='true'] {
  border-color: var(--lg-accent);
}
.lg-template-card {
  display: block;
  width: 100%;
  margin-top: var(--lg-space-2);
  padding: var(--lg-space-2);
  border: 1px solid rgba(232, 230, 225, 0.25);
  border-radius: var(--lg-radius);
  background: #191c23;
  color: var(--lg-fg);
  font-family: var(--lg-font);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.lg-template-card:hover {
  border-color: var(--lg-accent);
}
.lg-footer {
  display: flex;
  justify-content: space-between;
  gap: var(--lg-space-2);
  margin-top: var(--lg-space-3);
}
.lg-footer__spacer {
  flex: 1;
}

/* ── Task editor ─────────────────────────────────────────────────────── */
.lg-editor {
  display: flex;
  flex-direction: column;
  gap: var(--lg-space-1);
  max-height: 60vh;
  overflow-y: auto;
  width: 420px;
  max-width: 80vw;
}
.lg-editor__stage {
  margin: var(--lg-space-2) 0 var(--lg-space-1);
  font-size: 12px;
  opacity: 0.7;
}
.lg-editor__row {
  display: flex;
  gap: var(--lg-space-1);
  align-items: center;
}
.lg-editor__index {
  width: 1.5em;
  font-size: 12px;
  opacity: 0.6;
  text-align: right;
}
.lg-editor__title {
  flex: 1;
}
.lg-editor__minutes {
  width: 4.5em;
}
.lg-editor__row[data-locked] {
  opacity: 0.6;
}
.lg-editor__lock {
  color: var(--lg-accent);
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

.lg-toast-host {
  position: fixed;
  bottom: calc(var(--lg-space-3) * 4);
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: var(--lg-space-2);
  pointer-events: none;
}

.lg-toast {
  max-width: 26rem;
  padding: var(--lg-space-2) var(--lg-space-3);
  border-radius: var(--lg-radius);
  background: var(--lg-bg-panel);
  color: var(--lg-fg);
  font-family: var(--lg-font);
  font-size: 14px;
  line-height: 1.4;
  box-shadow: var(--lg-shadow);
  animation: lg-toast-in 0.2s ease-out;
}
.lg-toast--warn {
  border-left: 3px solid var(--lg-accent-bright);
}
.lg-toast--error {
  border-left: 3px solid var(--lg-danger);
  background: #2c1e1c;
}
.lg-toast[data-leaving] {
  animation: lg-toast-out 0.2s ease-in forwards;
}
@keyframes lg-toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes lg-toast-out {
  to {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lg-toast,
  .lg-toast[data-leaving] {
    animation: none;
  }
}

.lg-chip {
  display: inline-block;
  padding: var(--lg-space-1) var(--lg-space-2);
  border-radius: var(--lg-radius);
  background: var(--lg-bg-panel);
  color: var(--lg-fg);
  font-family: var(--lg-font);
  font-size: 12px;
  line-height: 1.4;
  box-shadow: var(--lg-shadow);
}
.lg-chip--warn,
.lg-chip[data-full] {
  color: var(--lg-accent-bright);
  animation: lg-bar-pulse 1.2s ease-in-out infinite;
}

.lg-prose {
  max-width: 36rem;
  font-size: 1.125rem;
  line-height: 1.7;
}

.lg-task-card {
  padding: var(--lg-space-2);
  border: 1px solid transparent;
  border-radius: var(--lg-radius);
  background: #191c23;
}
.lg-task-card--focused {
  border-color: var(--lg-accent);
}
.lg-task-card + .lg-task-card {
  margin-top: var(--lg-space-2);
}

.lg-chat {
  display: flex;
  flex-direction: column;
  font-family: var(--lg-font);
}
.lg-chat__log {
  display: flex;
  flex-direction: column;
  gap: var(--lg-space-1);
  width: 280px;
  height: 160px;
  overflow-y: auto;
  margin-bottom: var(--lg-space-2);
}
/* Fill variant: the host (e.g. the reflection modal) owns the size. */
.lg-chat--fill,
.lg-chat--fill .lg-chat__log {
  flex: 1;
  min-height: 0;
  width: auto;
}
.lg-chat__msg {
  max-width: 80%;
  padding: var(--lg-space-1) var(--lg-space-2);
  border-radius: var(--lg-radius);
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
.lg-chat__msg--user {
  align-self: flex-end;
  background: var(--lg-accent);
  color: #10130d;
}
.lg-chat__msg--coach {
  align-self: flex-start;
  background: #333944;
  color: var(--lg-fg);
}
.lg-chat__msg--error {
  align-self: flex-start;
  background: #2c1e1c;
  border-left: 3px solid var(--lg-danger);
  color: var(--lg-fg);
}
.lg-chat__label {
  display: block;
  margin-bottom: 2px;
  font-size: 11px;
  opacity: 0.7;
}
.lg-chat__typing .lg-chat__dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 3px;
  border-radius: 50%;
  background: var(--lg-fg);
  opacity: 0.5;
  animation: lg-chat-dot 1s ease-in-out infinite;
}
.lg-chat__typing .lg-chat__dot:nth-child(2) {
  animation-delay: 0.15s;
}
.lg-chat__typing .lg-chat__dot:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes lg-chat-dot {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.9;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lg-chat__typing .lg-chat__dot {
    animation: none;
  }
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
