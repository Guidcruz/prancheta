import { describe, expect, it } from 'vitest';
import { INPUT_MODALITY_ATTRIBUTE, modalityOfKey, trackInputModality } from './input-modality';

function fakeRoot() {
  const attributes = new Map<string, string>();
  return {
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
  };
}
const key = (init: Record<string, unknown>) => Object.assign(new Event('keydown'), init);

describe('input modality', () => {
  it('writes pointer on pointerdown and keyboard on a navigation key', () => {
    const target = new EventTarget();
    const root = fakeRoot();
    trackInputModality(target, root);
    expect(root.attributes.get(INPUT_MODALITY_ATTRIBUTE)).toBeUndefined();
    target.dispatchEvent(new Event('pointerdown'));
    expect(root.attributes.get(INPUT_MODALITY_ATTRIBUTE)).toBe('pointer');
    target.dispatchEvent(key({ key: 'Tab' }));
    expect(root.attributes.get(INPUT_MODALITY_ATTRIBUTE)).toBe('keyboard');
  });

  it('stops listening after the returned function', () => {
    const target = new EventTarget();
    const root = fakeRoot();
    const stop = trackInputModality(target, root);
    stop();
    target.dispatchEvent(new Event('pointerdown'));
    expect(root.attributes.size).toBe(0);
  });

  it('ignores modifiers, shortcuts, composition and the virtual keyboard', () => {
    expect(modalityOfKey({ key: 'Shift' })).toBeUndefined();
    expect(modalityOfKey({ key: 'c', ctrlKey: true })).toBeUndefined();
    expect(modalityOfKey({ key: 'Tab', metaKey: true })).toBeUndefined();
    expect(modalityOfKey({ key: 'a', isComposing: true })).toBeUndefined();
    expect(modalityOfKey({ key: 'Unidentified' })).toBeUndefined();
    expect(modalityOfKey({ key: 'Enter' })).toBe('keyboard');
    expect(modalityOfKey({ key: 'ArrowDown' })).toBe('keyboard');
    expect(modalityOfKey({ key: 'Escape' })).toBe('keyboard');
  });

  it('counts only Tab and Esc while typing in a field', () => {
    const field = { tagName: 'INPUT' } as unknown as EventTarget;
    const editor = { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget;
    expect(modalityOfKey({ key: 'a', target: field })).toBeUndefined();
    expect(modalityOfKey({ key: 'Enter', target: editor })).toBeUndefined();
    expect(modalityOfKey({ key: 'Tab', target: field })).toBe('keyboard');
    // No virtual keyboard sends Esc, so it is a physical keyboard even inside a field.
    expect(modalityOfKey({ key: 'Escape', target: field })).toBe('keyboard');
    expect(modalityOfKey({ key: 'Escape', target: editor })).toBe('keyboard');
  });
});
