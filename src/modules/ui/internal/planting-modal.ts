// Internal implementation. Deep imports from other modules are blocked by lint.
import { GOAL_TEMPLATES, TASKS_PER_TREE } from '../../config/index.ts';
import type { GoalTemplate, TileCoord, TreeType } from '../../config/index.ts';
import { availableTreeTypes } from '../../systems/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import type { ChatPanel, ChatSession } from './chat-panel.ts';
import { createChatPanel } from './chat-panel.ts';
import { ensureStyles } from './styles.ts';
import { createTaskEditor } from './task-editor.ts';
import type { TaskEditor } from './task-editor.ts';

export interface PlantChoice {
  tile: TileCoord;
  type: TreeType;
  /** The full goal to plant — a picked template or a player/AI-authored draft. */
  goal: GoalTemplate;
}

export interface PlantingModalDeps {
  onPlant: (choice: PlantChoice) => void;
  /**
   * Fresh goal-drafting conversation per open. `onDraft` is invoked whenever
   * the coach surfaces a `create_goal_template` effect; absent factory = no
   * key configured (the chat renders its offline notice).
   */
  createGoalChat?: (onDraft: (draft: GoalTemplate) => void) => ChatSession;
}

export interface PlantingModal {
  el: HTMLElement;
  open(state: GameplayState, tile: TileCoord): void;
  close(): void;
  isOpen(): boolean;
}

type Step = 1 | 2 | 3;

function button(testid: string, label: string, variant?: 'primary' | 'ghost'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = variant === undefined ? 'lg-btn' : `lg-btn lg-btn--${variant}`;
  b.dataset['testid'] = testid;
  b.textContent = label;
  return b;
}

/**
 * The planting modal: a three-step wizard (Choose → Tasks → Plant) inside one
 * modal. Step 1 offers a template or an AI-drafted goal; step 2 embeds the
 * task editor; step 3 confirms and reports the plant via `onPlant`
 * ({ tile, type, goal }). The modal never mutates game state itself. All DOM
 * is rebuilt per step; `open` resets to step 1, so repeated opens never stack.
 */
export function createPlantingModal(deps: PlantingModalDeps): PlantingModal {
  ensureStyles();
  const el = document.createElement('div');
  el.className = 'planting-modal lg-modal';
  el.dataset['testid'] = 'planting-modal';
  el.style.display = 'none';

  // Step indicator (top).
  const steps = document.createElement('div');
  steps.className = 'lg-steps';
  steps.dataset['testid'] = 'wizard-steps';
  const stepLabels = ['1 Choose', '2 Tasks', '3 Plant'];
  const stepEls = stepLabels.map((label, i) => {
    const s = document.createElement('span');
    s.className = 'lg-steps__step';
    s.dataset['testid'] = `step-${String(i + 1)}`;
    s.textContent = label;
    steps.appendChild(s);
    return s;
  });

  const body = document.createElement('div');

  // The chat panel is created once and reparented into step 1 when AI is chosen.
  const panel: ChatPanel = createChatPanel();

  let openTile: TileCoord | undefined;
  let selectedType: TreeType = 'A';
  let typeBAvailable = false;
  let currentStep: Step = 1;
  let draft: GoalTemplate | undefined;
  let pendingAiDraft: GoalTemplate | undefined;
  let editor: TaskEditor | undefined;
  let dirty = false;

  function reset(): void {
    openTile = undefined;
    draft = undefined;
    pendingAiDraft = undefined;
    editor = undefined;
    dirty = false;
    currentStep = 1;
    selectedType = 'A';
    body.replaceChildren();
  }

  function close(): void {
    el.style.display = 'none';
    reset();
  }

  /** Cancel with a discard confirm once the draft has been edited (step ≥ 2). */
  function attemptClose(): void {
    if (dirty && currentStep >= 2 && !window.confirm('Discard your goal edits?')) return;
    close();
  }

  function footer(...children: HTMLElement[]): HTMLElement {
    const f = document.createElement('div');
    f.className = 'lg-footer';
    f.append(...children);
    return f;
  }

  function spacer(): HTMLElement {
    const s = document.createElement('div');
    s.className = 'lg-footer__spacer';
    return s;
  }

  // ── Step 1: choose how to start ──────────────────────────────────────────
  function renderStep1(): HTMLElement {
    const step = document.createElement('div');
    step.className = 'lg-step';
    step.dataset['testid'] = 'wizard-step-1';

    // Tree-type selector: A always; B only when unlocked.
    const typeRow = document.createElement('div');
    const typeA = button('tree-type-a', 'Tree A', 'ghost');
    const typeB = button('tree-type-b', 'Tree B', 'ghost');
    const syncType = (): void => {
      typeA.setAttribute('aria-pressed', String(selectedType === 'A'));
      typeB.setAttribute('aria-pressed', String(selectedType === 'B'));
    };
    typeA.addEventListener('click', () => {
      selectedType = 'A';
      syncType();
    });
    typeB.addEventListener('click', () => {
      selectedType = 'B';
      syncType();
    });
    typeRow.append(typeA);
    if (typeBAvailable) typeRow.append(typeB);
    syncType();

    const cards = document.createElement('div');
    cards.className = 'lg-option-cards';
    const useTemplate = button('option-template', 'Use a template');
    useTemplate.className = 'lg-option-card';
    const useAi = button('option-ai', 'Draft with AI');
    useAi.className = 'lg-option-card';
    cards.append(useTemplate, useAi);

    // Slot below the option cards holds either template cards or the chat.
    const slot = document.createElement('div');
    slot.dataset['testid'] = 'start-slot';

    const showTemplates = (): void => {
      useTemplate.setAttribute('aria-pressed', 'true');
      useAi.setAttribute('aria-pressed', 'false');
      slot.replaceChildren();
      for (const [key, template] of Object.entries(GOAL_TEMPLATES)) {
        slot.appendChild(templateCard(key, template));
      }
    };

    const showAi = (): void => {
      useTemplate.setAttribute('aria-pressed', 'false');
      useAi.setAttribute('aria-pressed', 'true');
      slot.replaceChildren(panel.el);
      pendingAiDraft = undefined;
      panel.start(deps.createGoalChat?.(onCoachDraft));
    };

    // Confirmation card shown when the coach surfaces a goal draft.
    function onCoachDraft(next: GoalTemplate): void {
      pendingAiDraft = next;
      const existing = slot.querySelector('[data-testid="ai-confirm"]');
      existing?.remove();
      const card = document.createElement('div');
      card.className = 'lg-task-card';
      card.dataset['testid'] = 'ai-confirm';
      const text = document.createElement('span');
      text.textContent = `Coach drafted: ${next.name} — ${String(TASKS_PER_TREE)} tasks`;
      const review = button('review-draft', 'Review tasks', 'primary');
      review.addEventListener('click', () => {
        draft = pendingAiDraft;
        goToStep(2);
      });
      card.append(text, review);
      slot.appendChild(card);
    }

    function templateCard(key: string, template: GoalTemplate): HTMLElement {
      const card = button(`template-${key}`, '');
      card.className = 'lg-template-card';
      const name = document.createElement('strong');
      name.textContent = template.name;
      const preview = document.createElement('div');
      preview.textContent = template.tasks
        .slice(0, 3)
        .map((task) => task.title)
        .join(' · ');
      const count = document.createElement('div');
      count.style.opacity = '0.6';
      count.textContent = `${String(TASKS_PER_TREE)} tasks`;
      card.append(name, preview, count);
      card.addEventListener('click', () => {
        draft = { name: template.name, tasks: template.tasks.map((task) => ({ ...task })) };
        goToStep(2);
      });
      return card;
    }

    useTemplate.addEventListener('click', showTemplates);
    useAi.addEventListener('click', showAi);

    step.append(typeRow, cards, slot, footer(spacer(), button('modal-cancel', 'Cancel', 'ghost')));
    step
      .querySelector<HTMLElement>('[data-testid="modal-cancel"]')
      ?.addEventListener('click', attemptClose);
    return step;
  }

  // ── Step 2: review & edit tasks ──────────────────────────────────────────
  function renderStep2(): HTMLElement {
    const step = document.createElement('div');
    step.className = 'lg-step';
    step.dataset['testid'] = 'wizard-step-2';

    const current = draft ?? { name: '', tasks: [] };
    editor = createTaskEditor({
      draft: current,
      onChange: () => {
        dirty = true;
        continueBtn.disabled = !editor?.isValid();
      },
    });

    const back = button('wizard-back', 'Back', 'ghost');
    back.addEventListener('click', () => {
      draft = editor?.value() ?? draft;
      goToStep(1);
    });
    const cancel = button('modal-cancel', 'Cancel', 'ghost');
    cancel.addEventListener('click', attemptClose);
    const continueBtn = button('wizard-continue', 'Continue', 'primary');
    continueBtn.disabled = !editor.isValid();
    continueBtn.addEventListener('click', () => {
      if (!editor?.isValid()) return;
      draft = editor.value();
      goToStep(3);
    });

    step.append(editor.el, footer(back, cancel, spacer(), continueBtn));
    return step;
  }

  // ── Step 3: confirm ──────────────────────────────────────────────────────
  function renderStep3(): HTMLElement {
    const step = document.createElement('div');
    step.className = 'lg-step';
    step.dataset['testid'] = 'wizard-step-3';

    const goal = draft ?? { name: '', tasks: [] };
    const summary = document.createElement('div');
    summary.dataset['testid'] = 'plant-summary';
    const lines = [
      `Goal: ${goal.name}`,
      `Tree: ${selectedType}`,
      `Tasks: ${String(goal.tasks.length)}`,
      `First: ${goal.tasks[0]?.title ?? ''}`,
    ];
    for (const line of lines) {
      const p = document.createElement('div');
      p.textContent = line;
      summary.appendChild(p);
    }

    const back = button('wizard-back', 'Back', 'ghost');
    back.addEventListener('click', () => {
      goToStep(2);
    });
    const cancel = button('modal-cancel', 'Cancel', 'ghost');
    cancel.addEventListener('click', attemptClose);
    const plant = button('plant-confirm', 'Plant tree', 'primary');
    plant.addEventListener('click', () => {
      const tile = openTile;
      if (tile === undefined || draft === undefined) return;
      // Capture before close(), which resets selectedType/openTile via reset().
      const goalToPlant = draft;
      const type = selectedType;
      close();
      deps.onPlant({ tile, type, goal: goalToPlant });
    });

    step.append(summary, footer(back, cancel, spacer(), plant));
    return step;
  }

  function goToStep(step: Step): void {
    currentStep = step;
    stepEls.forEach((s, i) => {
      if (i + 1 === step) s.dataset['active'] = 'true';
      else delete s.dataset['active'];
    });
    const content = step === 1 ? renderStep1() : step === 2 ? renderStep2() : renderStep3();
    body.replaceChildren(content);
  }

  el.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      attemptClose();
    }
  });

  el.append(steps, body);

  function open(state: GameplayState, tile: TileCoord): void {
    reset();
    openTile = tile;
    typeBAvailable = availableTreeTypes(state).includes('B');
    goToStep(1);
    el.style.display = 'block';
  }

  return { el, open, close, isOpen: () => openTile !== undefined };
}
