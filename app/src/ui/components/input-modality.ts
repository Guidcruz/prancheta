/*
 * The way of the last interaction, pointer (tap, click, pen) or keyboard, written on the root
 * element as `data-input`, so the focus ring shows for the keyboard and never after a tap
 * (design-system.md, "Foco: anel só para o teclado"). Why not `:focus-visible` alone: WebKit
 * (Safari, every browser on iOS) does not move the focus on a tap, so a focus given by script
 * right after a tap (the native dialog's close button, the name that opened the card) matches
 * `:focus-visible` and draws the ring; Chromium does not. `focus({ focusVisible: false })` does
 * not cover the dialog's own focus and is not in every browser. app.css hides the ring while
 * the root says `pointer`; without the attribute (before any interaction) nothing changes.
 */

export type InputModality = 'pointer' | 'keyboard';

/** The root's attribute: `html[data-input="pointer"]`. */
export const INPUT_MODALITY_ATTRIBUTE = 'data-input';

interface Target {
  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options: { capture: boolean },
  ): void;
  removeEventListener(
    type: string,
    listener: (event: Event) => void,
    options: { capture: boolean },
  ): void;
}
interface Root {
  setAttribute(name: string, value: string): void;
}

/** Keys that are not a keyboard user moving around: modifiers alone, virtual keyboards. */
const IGNORED_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'Unidentified', 'Process']);

function editable(target: EventTarget | null): boolean {
  const el = target as { isContentEditable?: boolean; tagName?: string } | null;
  if (el === null || typeof el.tagName !== 'string') return false;
  return el.isContentEditable === true || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** What a key press says, or `undefined` when it says nothing about the modality. */
export function modalityOfKey(event: {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  target?: EventTarget | null;
}): InputModality | undefined {
  if (event.isComposing || IGNORED_KEYS.has(event.key)) return undefined;
  // Shortcuts (Ctrl+C, Cmd+Tab) are not navigation.
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined;
  // Typing in a field (the phone's keyboard included) is not moving the focus; Tab out of it is.
  if (editable(event.target ?? null) && event.key !== 'Tab') return undefined;
  return 'keyboard';
}

/**
 * Starts writing the modality on `root` (the `<html>`), listening on `target` (the document) in
 * the capture phase, before any component handles the event. Returns the function that stops.
 */
export function trackInputModality(target: Target, root: Root): () => void {
  let current: InputModality | undefined;
  const set = (modality: InputModality) => {
    if (modality === current) return;
    current = modality;
    root.setAttribute(INPUT_MODALITY_ATTRIBUTE, modality);
  };
  const onPointer = () => set('pointer');
  const onKey = (event: Event) => {
    const modality = modalityOfKey(event as unknown as Parameters<typeof modalityOfKey>[0]);
    if (modality !== undefined) set(modality);
  };
  // The options object, not the bare `true`: Node's EventTarget (the unit tests) does not match
  // a boolean capture on removal.
  const capture = { capture: true };
  target.addEventListener('pointerdown', onPointer, capture);
  target.addEventListener('keydown', onKey, capture);
  return () => {
    target.removeEventListener('pointerdown', onPointer, capture);
    target.removeEventListener('keydown', onKey, capture);
  };
}
