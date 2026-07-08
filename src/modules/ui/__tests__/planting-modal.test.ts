// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { GOAL_TEMPLATES } from '../../config/index.ts';
import type { TileCoord } from '../../config/index.ts';
import type { GameplayState } from '../../systems/index.ts';
import { createWorld, unlockSection } from '../../world/index.ts';
import { createPlantingModal } from '../index.ts';
import type { PlantChoice } from '../index.ts';

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

describe('ui / planting modal', () => {
  it('is hidden initially and open() without a chat factory shows the offline chat', () => {
    const modal = createPlantingModal({ onPlant: () => {} });

    expect(modal.el.dataset['testid']).toBe('planting-modal');
    expect(modal.isOpen()).toBe(false);
    expect(modal.el.style.display).toBe('none');

    modal.open(stateWith(), TILE);

    expect(modal.isOpen()).toBe(true);
    expect(modal.el.style.display).not.toBe('none');
    expect(query(modal.el, 'chat-panel')).not.toBeNull();
    expect(query(modal.el, 'chat-log')?.textContent).toContain('Chat is unavailable.');
    expect((query(modal.el, 'chat-input') as HTMLInputElement).disabled).toBe(true);
    expect((query(modal.el, 'chat-send') as HTMLButtonElement).disabled).toBe(true);
  });

  it('open() with a chat factory shows the opening message and relays the session reply', async () => {
    const send = vi.fn(async () => 'Nice goal!');
    const modal = createPlantingModal({
      onPlant: () => {},
      createGoalChat: () => ({ opening: 'What do you want to grow?', send }),
    });
    modal.open(stateWith(), TILE);

    const log = query(modal.el, 'chat-log')!;
    expect(log.textContent).toContain('What do you want to grow?');

    const input = query(modal.el, 'chat-input') as HTMLTextAreaElement;
    input.value = 'Sleep more';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    click(query(modal.el, 'chat-send'));

    expect(send).toHaveBeenCalledWith('Sleep more');
    expect(log.textContent).toContain('Sleep more');
    await vi.waitFor(() => {
      expect(log.textContent).toContain('Nice goal!');
    });
  });

  it('reveals the template options named from config only after Autofill is activated', () => {
    const modal = createPlantingModal({ onPlant: () => {} });
    modal.open(stateWith(), TILE);

    expect(query(modal.el, 'template-sleep')).toBeNull();
    expect(query(modal.el, 'template-workout')).toBeNull();

    click(query(modal.el, 'autofill'));

    expect(query(modal.el, 'template-sleep')?.textContent).toBe(GOAL_TEMPLATES.sleep.name);
    expect(query(modal.el, 'template-workout')?.textContent).toBe(GOAL_TEMPLATES.workout.name);
  });

  it('choosing Sleep plan calls onPlant with the opened tile, sleep, and the selected type, then closes', () => {
    const onPlant = vi.fn<(choice: PlantChoice) => void>();
    const modal = createPlantingModal({ onPlant });
    modal.open(stateWith(), TILE);

    click(query(modal.el, 'autofill'));
    click(query(modal.el, 'template-sleep'));

    expect(onPlant).toHaveBeenCalledTimes(1);
    expect(onPlant).toHaveBeenCalledWith({
      tile: TILE,
      templateKey: 'sleep',
      type: 'A',
      grown: false,
    });
    expect(modal.isOpen()).toBe(false);
  });

  it('does not offer type B before the first section unlock and offers it after', () => {
    const modal = createPlantingModal({ onPlant: () => {} });

    modal.open(stateWith(), TILE);
    expect(query(modal.el, 'tree-type-a')).not.toBeNull();
    expect(query(modal.el, 'tree-type-b')).toBeNull();
    modal.close();

    modal.open(stateWith([2]), TILE);
    expect(query(modal.el, 'tree-type-a')).not.toBeNull();
    expect(query(modal.el, 'tree-type-b')).not.toBeNull();
  });

  it('defaults the selection to type A even when B is offered', () => {
    const onPlant = vi.fn<(choice: PlantChoice) => void>();
    const modal = createPlantingModal({ onPlant });
    modal.open(stateWith([2]), TILE);

    click(query(modal.el, 'autofill'));
    click(query(modal.el, 'template-workout'));

    expect(onPlant).toHaveBeenCalledWith({
      tile: TILE,
      templateKey: 'workout',
      type: 'A',
      grown: false,
    });
  });

  it('plants with type B when the player selects it', () => {
    const onPlant = vi.fn<(choice: PlantChoice) => void>();
    const modal = createPlantingModal({ onPlant });
    modal.open(stateWith([2]), TILE);

    click(query(modal.el, 'tree-type-b'));
    click(query(modal.el, 'autofill'));
    click(query(modal.el, 'template-sleep'));

    expect(onPlant).toHaveBeenCalledWith({
      tile: TILE,
      templateKey: 'sleep',
      type: 'B',
      grown: false,
    });
  });

  it('plants fully grown when the dev toggle is on, and the toggle resets on re-open', () => {
    const onPlant = vi.fn<(choice: PlantChoice) => void>();
    const modal = createPlantingModal({ onPlant });
    modal.open(stateWith(), TILE);

    click(query(modal.el, 'plant-grown-toggle'));
    expect(query(modal.el, 'plant-grown-toggle')?.getAttribute('aria-pressed')).toBe('true');
    click(query(modal.el, 'autofill'));
    click(query(modal.el, 'template-sleep'));

    expect(onPlant).toHaveBeenCalledWith({
      tile: TILE,
      templateKey: 'sleep',
      type: 'A',
      grown: true,
    });

    modal.open(stateWith(), TILE);
    expect(query(modal.el, 'plant-grown-toggle')?.getAttribute('aria-pressed')).toBe('false');
    click(query(modal.el, 'autofill'));
    click(query(modal.el, 'template-workout'));
    expect(onPlant).toHaveBeenLastCalledWith({
      tile: TILE,
      templateKey: 'workout',
      type: 'A',
      grown: false,
    });
  });

  it('Cancel closes the modal without calling onPlant', () => {
    const onPlant = vi.fn<(choice: PlantChoice) => void>();
    const modal = createPlantingModal({ onPlant });
    modal.open(stateWith(), TILE);

    click(query(modal.el, 'modal-cancel'));

    expect(onPlant).not.toHaveBeenCalled();
    expect(modal.isOpen()).toBe(false);
  });

  it('re-opening resets the modal: no leftover template list and no stale type selection', () => {
    const onPlant = vi.fn<(choice: PlantChoice) => void>();
    const modal = createPlantingModal({ onPlant });

    modal.open(stateWith([2]), TILE);
    click(query(modal.el, 'tree-type-b'));
    click(query(modal.el, 'autofill'));
    expect(query(modal.el, 'template-sleep')).not.toBeNull();
    modal.close();

    modal.open(stateWith([2]), TILE);
    expect(query(modal.el, 'template-sleep')).toBeNull();
    expect(query(modal.el, 'template-workout')).toBeNull();

    click(query(modal.el, 'autofill'));
    click(query(modal.el, 'template-sleep'));
    expect(onPlant).toHaveBeenCalledWith({
      tile: TILE,
      templateKey: 'sleep',
      type: 'A',
      grown: false,
    });
  });

  it('repeated opens do not duplicate DOM', () => {
    const modal = createPlantingModal({ onPlant: () => {} });
    const state = stateWith([2]);

    modal.open(state, TILE);
    modal.close();
    modal.open(state, TILE);
    modal.open(state, TILE);
    click(query(modal.el, 'autofill'));

    expect(modal.el.querySelectorAll('[data-testid="chat-panel"]')).toHaveLength(1);
    expect(modal.el.querySelectorAll('[data-testid="autofill"]')).toHaveLength(1);
    expect(modal.el.querySelectorAll('[data-testid="tree-type-a"]')).toHaveLength(1);
    expect(modal.el.querySelectorAll('[data-testid="tree-type-b"]')).toHaveLength(1);
    expect(modal.el.querySelectorAll('[data-testid="template-sleep"]')).toHaveLength(1);
    expect(modal.el.querySelectorAll('[data-testid="plant-grown-toggle"]')).toHaveLength(1);
    expect(modal.el.querySelectorAll('[data-testid="modal-cancel"]')).toHaveLength(1);
  });
});
