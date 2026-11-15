import type { MatchSpeed } from '@lib/career';
import type { MatchStep } from './steps';
import { timingOf } from './timing';

/*
 * Runs the steps of the match (steps.ts) on a timer (docs/design/telas/partida.md, "Relógio da
 * partida"): each step is shown, waits for its duration at the speed in force when it was shown,
 * and gives way to the next. The timer functions come in (the browser's by default), so the tests
 * use fake ones; no DOM.
 *
 * - Pause: asked in the middle of a minute, the minute ends (with the outcome of a dramatic pause)
 *   and the match stops before the next one. Until then the pause is only asked (`pausing`).
 * - Resume: the next minute starts at once.
 * - Speed: counts from the next step; the step being shown keeps its duration.
 * - Stop (Pular, leaving): no step is shown any more.
 *
 * `onreveal` is the one point where each play is revealed: the commentary, the board and the
 * screen reader read the step there, and the pitch (T-085), the sound (T-047) and the vibration
 * (T-041) subscribe to the same point, so none of them ever runs ahead of the text.
 */

export interface PlayerTimers {
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const browserTimers: PlayerTimers = {
  setTimeout: (run, ms) => globalThis.setTimeout(run, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface PlayerState {
  /** The last step shown. */
  readonly index: number;
  /** Stopped between two minutes, waiting for "Retomar". */
  readonly paused: boolean;
  /** A pause was asked and the minute is still ending. */
  readonly pausing: boolean;
  readonly speed: MatchSpeed;
  /** The final whistle is shown. */
  readonly ended: boolean;
  /** Stopped for good (Pular, leaving the screen). */
  readonly stopped: boolean;
}

export interface PlayerOptions {
  readonly speed: MatchSpeed;
  /** Every change of state (a step shown, a pause, the speed). */
  readonly onchange?: (state: PlayerState) => void;
  /** A step is shown: the one point where each play is revealed (see the header). */
  readonly onreveal?: (step: MatchStep, index: number) => void;
  /** The final whistle was shown. */
  readonly onend?: () => void;
  readonly timers?: PlayerTimers;
}

export class MatchPlayer {
  private readonly steps: readonly MatchStep[];
  private readonly options: PlayerOptions;
  private readonly timers: PlayerTimers;
  private handle: unknown;
  private current: PlayerState;

  constructor(steps: readonly MatchStep[], options: PlayerOptions) {
    this.steps = steps;
    this.options = options;
    this.timers = options.timers ?? browserTimers;
    this.current = {
      index: -1,
      paused: false,
      pausing: false,
      speed: options.speed,
      ended: false,
      stopped: false,
    };
  }

  get state(): PlayerState {
    return this.current;
  }

  /** Shows the first step (0', the kick-off) and starts the clock. */
  start(): void {
    if (this.current.index !== -1 || this.current.stopped) return;
    this.show(0);
  }

  /** Asks for a pause: the minute being played ends first. */
  pause(): void {
    const { paused, pausing, ended, stopped, index } = this.current;
    if (paused || pausing || ended || stopped || index === -1) return;
    this.set({ pausing: true });
  }

  /** Back to the clock: a pause still being asked is dropped; a real one starts the next minute. */
  resume(): void {
    const { paused, pausing, stopped } = this.current;
    if (stopped) return;
    if (pausing) {
      this.set({ pausing: false });
      return;
    }
    if (!paused) return;
    this.set({ paused: false });
    this.show(this.current.index + 1);
  }

  /** "Pausar" and "Retomar" are the same button. */
  toggle(): void {
    if (this.current.paused || this.current.pausing) this.resume();
    else this.pause();
  }

  /** The speed of the next steps. */
  setSpeed(speed: MatchSpeed): void {
    if (speed !== this.current.speed) this.set({ speed });
  }

  /** No more steps (Pular, leaving). */
  stop(): void {
    if (this.current.stopped) return;
    if (this.handle !== undefined) this.timers.clearTimeout(this.handle);
    this.handle = undefined;
    this.set({ stopped: true, pausing: false });
  }

  private show(index: number): void {
    const step = this.steps[index];
    if (step === undefined) return;
    this.set({ index });
    this.options.onreveal?.(step, index);
    if (step.timing === undefined || index === this.steps.length - 1) {
      this.set({ ended: true, pausing: false });
      this.options.onend?.();
      return;
    }
    this.handle = this.timers.setTimeout(
      () => this.next(),
      timingOf(step.timing, this.current.speed),
    );
  }

  private next(): void {
    this.handle = undefined;
    if (this.current.stopped) return;
    const { index, pausing } = this.current;
    const step = this.steps[index]!;
    const following = this.steps[index + 1];
    if (following === undefined) return;
    if (pausing && following.slot !== step.slot) {
      this.set({ paused: true, pausing: false });
      return;
    }
    this.show(index + 1);
  }

  private set(change: Partial<PlayerState>): void {
    this.current = { ...this.current, ...change };
    this.options.onchange?.(this.current);
  }
}
