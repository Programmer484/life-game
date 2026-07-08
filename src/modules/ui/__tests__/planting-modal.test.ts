// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { GOAL_TEMPLATES, TASKS_PER_TREE } from '../../config/index.ts';
import type { GoalTemplate, TileCoord } from '../../config/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import { createWorld, unlockSection } from '../../world/index.ts';
import { createPlantingModal } from '../index.ts';
import type { PlantChoice } from '../index.ts';
import type { ChatSession } from '../internal/chat-panel.ts';

/** A gameplay state with no trees and the given sections unlocked. */
function stateWith(unlockedSections: number[] = []): GameplayState {
  const world = unlockedSections.reduce((acc, id) => unlockSection(acc, id), createWorld());
  return { trees: [], goals: {}, world };
}

function query(el: HTMLElement, testid: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

function click(el: HTMLElement | null): void {
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const TILE: TileCoord = { x: 2, y: 3 };

/** Advance the modal to step 2 by picking the sleep template. */
function pickSleepTemplate(el: HTMLElement): void {
  click(query(el, 'option-template'));
  click(query(el, 'template-sleep'));
}

describe('ui / planting wizard', () => {
  it('is hidden initially and opens on step 1 with the two start options', () => {
    const modal = createPlantingModal({ onPlant: () => {} });
    expect(modal.el.style.display).toBe('none');
    expect(modal.isOpen()).toBe(false);

    modal.open(stateWith(), TILE);
    expect(modal.isOpen()).toBe(true);
    expect(query(modal.el, 'wizard-step-1')).not.toBeNull();
    expect(query(modal.el, 'option-template')).not.toBeNull();
    expect(query(modal.el, 'option-ai')).not.toBeNull();
    expect(query(modal.el, 'step-1')?.dataset['active']).toBe('true');
  });

  it('picking a template reveals its preview then advances to the task editor', () => {
    const modal = createPlantingModal({ onPlant: () => {} });
    modal.open(stateWith(), TILE);

    expect(query(modal.el, 'template-sleep')).toBeNull();
    click(query(modal.el, 'option-template'));
    const card = query(modal.el, 'template-sleep')!;
    expect(card.textContent).toContain(GOAL_TEMPLATES.sleep.name);
    expect(card.textContent).toContain(GOAL_TEMPLATES.sleep.tasks[0]!.title);
    expect(card.textContent).toContain(`${String(TASKS_PER_TREE)} tasks`);

    click(card);
    expect(query(modal.el, 'wizard-step-2')).not.toBeNull();
    expect(query(modal.el, 'task-editor')).not.toBeNull();
    expect(modal.el.querySelectorAll('[data-testid="task-row"]')).toHaveLength(TASKS_PER_TREE);
  });

  it('walks all three steps and plants with the chosen tile, type, and goal', () => {
    const onPlant = vi.fn<(choice: PlantChoice) => void>();
    const modal = createPlantingModal({ onPlant });
    modal.open(stateWith([2]), TILE);

    click(query(modal.el, 'tree-type-b'));
    pickSleepTemplate(modal.el);
    click(query(modal.el, 'wizard-continue'));

    expect(query(modal.el, 'wizard-step-3')).not.toBeNull();
    expect(query(modal.el, 'plant-summary')?.textContent).toContain(GOAL_TEMPLATES.sleep.name);

    click(query(modal.el, 'plant-confirm'));
    expect(onPlant).toHaveBeenCalledTimes(1);
    const choice = onPlant.mock.calls[0]![0];
    expect(choice.tile).toEqual(TILE);
    expect(choice.type).toBe('B');
    expect(choice.goal.name).toBe(GOAL_TEMPLATES.sleep.name);
    expect(choice.goal.tasks).toHaveLength(TASKS_PER_TREE);
    expect(modal.isOpen()).toBe(false);
  });

  it('Back from the editor preserves the draft and returns to step 1', () => {
    const modal = createPlantingModal({ onPlant: () => {} });
    modal.open(stateWith(), TILE);
    pickSleepTemplate(modal.el);
    click(query(modal.el, 'wizard-back'));
    expect(query(modal.el, 'wizard-step-1')).not.toBeNull();
    // Re-entering the editor still has the draft.
    pickSleepTemplate(modal.el);
    expect(modal.el.querySelectorAll('[data-testid="task-row"]')).toHaveLength(TASKS_PER_TREE);
  });

  it('surfaces the coach goal draft as a confirmation card that opens the editor', () => {
    let captured: ((draft: GoalTemplate) => void) | undefined;
    const session: ChatSession = { opening: 'What do you want to grow?', send: vi.fn() };
    const modal = createPlantingModal({
      onPlant: () => {},
      createGoalChat: (onDraft) => {
        captured = onDraft;
        return session;
      },
    });
    modal.open(stateWith(), TILE);

    click(query(modal.el, 'option-ai'));
    expect(query(modal.el, 'chat-panel')).not.toBeNull();
    expect(query(modal.el, 'ai-confirm')).toBeNull();

    // Simulate the coach surfacing a create_goal_template effect.
    captured!({
      name: 'AI sleep goal',
      tasks: Array.from({ length: TASKS_PER_TREE }, (_, i) => ({
        title: `ai task ${String(i)}`,
        estimatedMinutes: 20,
      })),
    });
    expect(query(modal.el, 'ai-confirm')?.textContent).toContain('AI sleep goal');

    click(query(modal.el, 'review-draft'));
    expect(query(modal.el, 'wizard-step-2')).not.toBeNull();
    const firstTitle = modal.el.querySelector<HTMLInputElement>('[data-testid="task-title"]')!;
    expect(firstTitle.value).toBe('ai task 0');
  });

  it('offers type B only after the unlocking section, defaulting to A', () => {
    const modal = createPlantingModal({ onPlant: () => {} });
    modal.open(stateWith(), TILE);
    expect(query(modal.el, 'tree-type-a')).not.toBeNull();
    expect(query(modal.el, 'tree-type-b')).toBeNull();
    modal.close();

    modal.open(stateWith([2]), TILE);
    expect(query(modal.el, 'tree-type-b')).not.toBeNull();
  });

  it('Cancel on step 1 closes without confirm or onPlant', () => {
    const onPlant = vi.fn<(choice: PlantChoice) => void>();
    const modal = createPlantingModal({ onPlant });
    modal.open(stateWith(), TILE);
    click(query(modal.el, 'modal-cancel'));
    expect(onPlant).not.toHaveBeenCalled();
    expect(modal.isOpen()).toBe(false);
  });

  it('cancelling an edited draft asks to discard; declining keeps the modal open', () => {
    const modal = createPlantingModal({ onPlant: () => {} });
    modal.open(stateWith(), TILE);
    pickSleepTemplate(modal.el);
    // Edit a task so the draft is dirty.
    const title = modal.el.querySelector<HTMLInputElement>('[data-testid="task-title"]')!;
    title.value = 'changed';
    title.dispatchEvent(new Event('input', { bubbles: true }));

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    click(query(modal.el, 'modal-cancel'));
    expect(modal.isOpen()).toBe(true);
    confirm.mockReturnValue(true);
    click(query(modal.el, 'modal-cancel'));
    expect(modal.isOpen()).toBe(false);
    confirm.mockRestore();
  });

  it('repeated opens reset to step 1 without stacking DOM', () => {
    const modal = createPlantingModal({ onPlant: () => {} });
    modal.open(stateWith([2]), TILE);
    pickSleepTemplate(modal.el);
    modal.open(stateWith([2]), TILE);

    expect(query(modal.el, 'wizard-step-1')).not.toBeNull();
    expect(modal.el.querySelectorAll('[data-testid="option-template"]')).toHaveLength(1);
    expect(modal.el.querySelectorAll('[data-testid="wizard-steps"]')).toHaveLength(1);
  });
});
