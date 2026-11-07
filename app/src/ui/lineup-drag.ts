/*
 * Drag and drop of the lineup (design-system.md, "Arrastar e soltar"; escalacao.md, "Arrastar e
 * soltar"). Never the only way: a drop does the same swap as the two taps and the keyboard.
 *
 * - Mouse: the drag starts once the pointer moves 6px with the button down.
 * - Touch and pen: after holding 300ms without moving more than 8px; moving before that is a
 *   swipe and the page scrolls (the pitch takes most of the screen and must not trap it). At the
 *   start, a short vibration where there is one.
 * - While dragging, the page does not scroll by the finger (the screen calls `blockTouchScroll`
 *   on its root, whose `touchmove` listener is registered once, not passive); near the top or the
 *   bottom of the window it scrolls by itself, in steps.
 * - A drop on a place swaps; a drop elsewhere, Esc, a second finger or a cancelled pointer drop
 *   nothing. The click that may follow a drag is swallowed, so it never picks a player.
 *
 * The hit test is the element under the finger (not under the copy, which has no pointer
 * events): `data-slot` (pitch) or `data-place` (bench and out), read by the caller.
 */

export const HOLD_MS = 300;
export const TOUCH_SLOP = 8;
export const MOUSE_SLOP = 6;
/** Distance from the window's top or bottom edge where the page scrolls by itself. */
const EDGE = 64;
const SCROLL_STEP = 12;

export interface DragCallbacks<P> {
  /** The place under the point, or undefined. */
  readonly placeAt: (x: number, y: number) => P | undefined;
  /** The drag started (show the copy and the origin). */
  readonly start: (x: number, y: number) => void;
  /** The pointer moved while dragging, over `target` (or nothing). */
  readonly move: (x: number, y: number, target: P | undefined) => void;
  /** Dropped over `target` (or nothing: no swap). */
  readonly drop: (target: P | undefined) => void;
  /** Esc, a second finger or a cancelled pointer: no swap. */
  readonly cancel: () => void;
  /**
   * What covers the bottom of the window (on the phone, the tab bar and "Jogar rodada", read from
   * `--tabbar-h` and `--play-h`): the automatic scroll starts above it. Asked when a drag starts.
   */
  readonly bottomInset?: () => number;
}

let dragging = false;
let stopCurrent: (() => void) | undefined;
/**
 * Pointers of a gesture cancelled by a second finger: until each one lifts, it starts nothing
 * (the second finger landing on a place would otherwise begin a new press in the same gesture).
 */
const blocked = new Set<number>();

function block(pointerId: number): void {
  if (blocked.has(pointerId)) return;
  blocked.add(pointerId);
  const release = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    blocked.delete(pointerId);
    window.removeEventListener('pointerup', release, { capture: true });
    window.removeEventListener('pointercancel', release, { capture: true });
  };
  window.addEventListener('pointerup', release, { capture: true });
  window.addEventListener('pointercancel', release, { capture: true });
}

/** A drag is on: the page must not scroll by the finger. */
export function isDragging(): boolean {
  return dragging;
}

/**
 * Keeps the finger from scrolling the page while a drag is on. Register once on the screen's root
 * (not passive); returns the function that removes it.
 */
export function blockTouchScroll(root: HTMLElement): () => void {
  const onTouchMove = (event: TouchEvent) => {
    if (dragging && event.cancelable) event.preventDefault();
  };
  root.addEventListener('touchmove', onTouchMove, { passive: false });
  return () => root.removeEventListener('touchmove', onTouchMove);
}

function swallowNextClick(): void {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  // A click comes right after the pointerup, or never.
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
}

/** A press on a place: maybe the start of a drag. Call from the place's `pointerdown`. */
export function pressPlace<P>(event: PointerEvent, callbacks: DragCallbacks<P>): void {
  // A press still open (its pointerup was lost): drop it, without a swap.
  if (stopCurrent !== undefined) {
    const wasDragging = dragging;
    stopCurrent();
    if (wasDragging) callbacks.cancel();
    return;
  }
  if (blocked.has(event.pointerId)) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const touch = event.pointerType !== 'mouse';
  const pointerId = event.pointerId;
  const x0 = event.clientX;
  const y0 = event.clientY;
  let x = x0;
  let y = y0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame: number | undefined;
  /** Bottom of the area where the finger can drop: above the dock of the frame. */
  let bottom = window.innerHeight;

  const scrollStep = () => {
    frame = undefined;
    if (!dragging) return;
    const by = y < EDGE ? -SCROLL_STEP : y > bottom - EDGE ? SCROLL_STEP : 0;
    if (by === 0) return;
    window.scrollBy(0, by);
    callbacks.move(x, y, callbacks.placeAt(x, y));
    frame = requestAnimationFrame(scrollStep);
  };

  const begin = () => {
    timer = undefined;
    dragging = true;
    bottom = window.innerHeight - Math.max(0, callbacks.bottomInset?.() ?? 0);
    if (touch && typeof navigator.vibrate === 'function') navigator.vibrate(10);
    callbacks.start(x, y);
    callbacks.move(x, y, callbacks.placeAt(x, y));
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    x = e.clientX;
    y = e.clientY;
    if (!dragging) {
      const distance = Math.hypot(x - x0, y - y0);
      if (touch) {
        // Moved before the hold: a swipe, the page scrolls.
        if (distance > TOUCH_SLOP) stop();
      } else if (distance >= MOUSE_SLOP) begin();
      return;
    }
    e.preventDefault();
    callbacks.move(x, y, callbacks.placeAt(x, y));
    if (frame === undefined) frame = requestAnimationFrame(scrollStep);
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    const was = dragging;
    stop();
    if (!was) return;
    swallowNextClick();
    callbacks.drop(callbacks.placeAt(e.clientX, e.clientY));
  };

  const onCancel = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    const was = dragging;
    stop();
    if (was) callbacks.cancel();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !dragging) return;
    e.preventDefault();
    stop();
    callbacks.cancel();
  };

  // A second finger, anywhere: no swap.
  const onOtherDown = (e: PointerEvent) => {
    if (e.pointerId === pointerId) return;
    // Neither finger starts anything else until it lifts.
    block(e.pointerId);
    block(pointerId);
    const was = dragging;
    stop();
    if (was) callbacks.cancel();
  };

  // The long press of a touch would open the context menu (Android) or the callout (iOS).
  const onContextMenu = (e: Event) => {
    if (touch) e.preventDefault();
  };

  function stop(): void {
    if (timer !== undefined) clearTimeout(timer);
    if (frame !== undefined) cancelAnimationFrame(frame);
    timer = undefined;
    frame = undefined;
    dragging = false;
    stopCurrent = undefined;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey, { capture: true });
    window.removeEventListener('contextmenu', onContextMenu, { capture: true });
    window.removeEventListener('pointerdown', onOtherDown, { capture: true });
  }

  stopCurrent = stop;
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey, { capture: true });
  window.addEventListener('contextmenu', onContextMenu, { capture: true });
  // Added after this pointerdown has gone by, so it only sees the next ones.
  setTimeout(() => {
    if (stopCurrent === stop)
      window.addEventListener('pointerdown', onOtherDown, { capture: true });
  }, 0);
  if (touch) timer = setTimeout(begin, HOLD_MS);
}

/** The place element under a point: a pitch slot (`data-slot`) or a row (`data-place`). */
export function placeElementAt(x: number, y: number): HTMLElement | undefined {
  const hit = document.elementFromPoint(x, y);
  return hit?.closest<HTMLElement>('[data-slot], [data-place]') ?? undefined;
}
