import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOLD_MS,
  MOUSE_SLOP,
  TOUCH_SLOP,
  isDragging,
  pressPlace,
  type DragCallbacks,
} from './lineup-drag';

/*
 * The drag gesture of the lineup (escalacao.md, "Arrastar e soltar"; US-017): 6 px with the mouse,
 * 300 ms of hold on touch, a swipe scrolls instead, and Esc, a second finger or a cancelled
 * pointer drop nothing. Node has no DOM, so `window` is a bare EventTarget.
 */

type Ev = Record<string, unknown>;

let win: EventTarget & { innerHeight: number; scrollBy: ReturnType<typeof vi.fn> };

function fire(type: string, props: Ev = {}): Ev {
  const e = new Event(type, { cancelable: true }) as Event & Ev;
  Object.assign(e, props);
  win.dispatchEvent(e);
  return e;
}

function pointer(type: string, id: number, x: number, y: number, pointerType = 'touch'): Ev {
  return fire(type, { pointerId: id, clientX: x, clientY: y, pointerType, button: 0 });
}

function down(id: number, x: number, y: number, pointerType: string, cb: DragCallbacks<string>) {
  const e = { pointerId: id, clientX: x, clientY: y, pointerType, button: 0 } as PointerEvent;
  pressPlace(e, cb);
}

function callbacks() {
  const log: string[] = [];
  const cb: DragCallbacks<string> = {
    placeAt: (x) => (x >= 100 ? 'slot' : undefined),
    start: () => log.push('start'),
    move: (_x, _y, t) => log.push(`move:${t ?? '-'}`),
    drop: (t) => log.push(`drop:${t ?? '-'}`),
    cancel: () => log.push('cancel'),
  };
  return { cb, log };
}

beforeEach(() => {
  vi.useFakeTimers();
  const target = new EventTarget();
  win = Object.assign(target, { innerHeight: 800, scrollBy: vi.fn() });
  vi.stubGlobal('window', win);
  vi.stubGlobal('navigator', { vibrate: vi.fn() });
  vi.stubGlobal('requestAnimationFrame', (f: () => void) => setTimeout(f, 16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (h: number) => clearTimeout(h));
});

afterEach(() => {
  // Leaves no press open for the next test.
  pointer('pointerup', 1, 0, 0);
  pointer('pointerup', 1, 0, 0, 'mouse');
  vi.runAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the constants of the design (escalacao.md)', () => {
  it('300 ms on touch, 8 px of slop on touch, 6 px with the mouse', () => {
    expect(HOLD_MS).toBe(300);
    expect(TOUCH_SLOP).toBe(8);
    expect(MOUSE_SLOP).toBe(6);
  });
});

describe('mouse', () => {
  it('5 px does not start; 6 px does; the drop gives the place under the pointer', () => {
    const { cb, log } = callbacks();
    down(1, 10, 10, 'mouse', cb);
    pointer('pointermove', 1, 15, 10, 'mouse');
    expect(isDragging()).toBe(false);
    pointer('pointermove', 1, 16, 10, 'mouse');
    expect(isDragging()).toBe(true);
    pointer('pointermove', 1, 150, 10, 'mouse');
    pointer('pointerup', 1, 150, 10, 'mouse');
    expect(isDragging()).toBe(false);
    expect(log[0]).toBe('start');
    expect(log.at(-1)).toBe('drop:slot');
  });

  it('a press without movement is a click: no drag, no drop', () => {
    const { cb, log } = callbacks();
    down(1, 10, 10, 'mouse', cb);
    pointer('pointerup', 1, 10, 10, 'mouse');
    vi.advanceTimersByTime(1000);
    expect(log).toEqual([]);
  });

  it('a right button never starts a press', () => {
    const { cb, log } = callbacks();
    pressPlace(
      { pointerId: 1, clientX: 0, clientY: 0, pointerType: 'mouse', button: 2 } as PointerEvent,
      cb,
    );
    pointer('pointermove', 1, 100, 0, 'mouse');
    expect(log).toEqual([]);
  });

  it('dropped outside any place: the drop has no target (no swap)', () => {
    const { cb, log } = callbacks();
    down(1, 10, 10, 'mouse', cb);
    pointer('pointermove', 1, 50, 10, 'mouse');
    pointer('pointerup', 1, 50, 10, 'mouse');
    expect(log.at(-1)).toBe('drop:-');
  });

  it('Esc while dragging cancels and the drop never happens', () => {
    const { cb, log } = callbacks();
    down(1, 10, 10, 'mouse', cb);
    pointer('pointermove', 1, 150, 10, 'mouse');
    fire('keydown', { key: 'Escape' });
    pointer('pointerup', 1, 150, 10, 'mouse');
    expect(log.at(-1)).toBe('cancel');
    expect(log.some((l) => l.startsWith('drop'))).toBe(false);
  });

  it('a cancelled pointer cancels the drag', () => {
    const { cb, log } = callbacks();
    down(1, 10, 10, 'mouse', cb);
    pointer('pointermove', 1, 150, 10, 'mouse');
    pointer('pointercancel', 1, 150, 10, 'mouse');
    expect(log.at(-1)).toBe('cancel');
    expect(isDragging()).toBe(false);
  });
});

describe('touch', () => {
  it('holding for 300 ms starts the drag (and vibrates once); the drop swaps', () => {
    const { cb, log } = callbacks();
    down(1, 10, 10, 'touch', cb);
    vi.advanceTimersByTime(HOLD_MS - 1);
    expect(isDragging()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(isDragging()).toBe(true);
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
    pointer('pointermove', 1, 150, 10);
    pointer('pointerup', 1, 150, 10);
    expect(log.at(-1)).toBe('drop:slot');
  });

  it('moving more than 8 px before the hold is a swipe: the drag never starts', () => {
    const { cb, log } = callbacks();
    down(1, 10, 10, 'touch', cb);
    pointer('pointermove', 1, 10, 30);
    vi.advanceTimersByTime(1000);
    expect(isDragging()).toBe(false);
    pointer('pointerup', 1, 10, 30);
    expect(log).toEqual([]);
  });

  it('a small tremor (under 8 px) does not break the hold', () => {
    const { cb } = callbacks();
    down(1, 10, 10, 'touch', cb);
    pointer('pointermove', 1, 14, 14);
    vi.advanceTimersByTime(HOLD_MS);
    expect(isDragging()).toBe(true);
  });

  it('a second finger during the drag cancels it, and that finger starts nothing until it lifts', async () => {
    const { cb, log } = callbacks();
    down(1, 10, 10, 'touch', cb);
    vi.advanceTimersByTime(0); // the other-pointer listener is added after this pointerdown
    vi.advanceTimersByTime(HOLD_MS);
    expect(isDragging()).toBe(true);
    pointer('pointerdown', 2, 200, 10);
    expect(log.at(-1)).toBe('cancel');
    expect(isDragging()).toBe(false);
    // The second finger cannot begin a new press in the same gesture.
    const second = callbacks();
    down(2, 200, 10, 'touch', second.cb);
    vi.advanceTimersByTime(HOLD_MS * 2);
    expect(second.log).toEqual([]);
    pointer('pointerup', 2, 200, 10);
    pointer('pointerup', 1, 10, 10);
  });

  it('near the bottom edge the page scrolls by itself, in steps', () => {
    const { cb } = callbacks();
    down(1, 10, 790, 'touch', cb);
    vi.advanceTimersByTime(HOLD_MS);
    pointer('pointermove', 1, 10, 795);
    vi.advanceTimersByTime(100);
    expect(win.scrollBy).toHaveBeenCalled();
    expect(win.scrollBy.mock.calls[0]?.[1]).toBeGreaterThan(0);
  });

  it('the bottom inset (tab bar and "Jogar rodada") moves the scroll edge up', () => {
    const { cb } = callbacks();
    const covered: DragCallbacks<string> = { ...cb, bottomInset: () => 200 };
    down(1, 10, 700, 'touch', covered);
    vi.advanceTimersByTime(HOLD_MS);
    pointer('pointermove', 1, 10, 705);
    vi.advanceTimersByTime(100);
    expect(win.scrollBy).toHaveBeenCalled();
  });
});
