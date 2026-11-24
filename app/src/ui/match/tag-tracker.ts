import type { TagPlan } from './tags';

/*
 * Which tags are on the pitch after each step (docs/design/telas/partida-campo-v2.md, 9, "Tempos
 * da etiqueta do lance", and 16, items 11 to 13), apart from the screen so it can be tested: a pure
 * state machine over the steps, with no DOM, no timer and no text.
 *
 * - A play (or red card) tag enters with its step. Another player replaces it at once; the same
 *   `key` (the start and the outcome of one play) only changes the view in place.
 * - It stays at least `TAG_MIN_MS` (the sum of the durations of the steps since its entry, never
 *   the wall clock); even if its disc leaves sooner the tag stays, and the pitch holds it at the
 *   disc's last point with no thread. After that, it leaves at the first step without a tag: fading
 *   (`leaving`) or at once with reduced motion.
 * - The goal tag leaves at once at the next step, with no fade.
 * - A play of a player who is not on the pitch has no tag, and takes the one before away.
 * - The shirt of the team (`team`) is the one candidate of the step, only while no play tag is on
 *   screen, and it stays in the list while a play tag fades out.
 */

/** The least a tag of a play stays, in ms of the clock of the match (Normal and Rápido). */
export const TAG_MIN_MS = { normal: 1600, fast: 800 } as const;

export interface TrackedView {
  readonly key: string;
  readonly leaving: boolean;
}

/** What one step brings. */
export interface TagStepInput<V extends TrackedView> {
  /** The plan of the step (none: a minute, a card, a substitution...). */
  readonly plan: TagPlan | undefined;
  /** The view of that plan, built only when its player has a disc. */
  readonly view: V | undefined;
  /** How long the step lasts at the speed it is shown at. */
  readonly duration: number;
  readonly speed: 'normal' | 'fast';
  /** Whether a tag that goes away fades (no, with reduced motion). */
  readonly fade: boolean;
  /** The shirt over the ball, if the step asks for one. */
  readonly team: V | undefined;
}

export class TagTracker<V extends TrackedView> {
  private held: { plan: TagPlan; view: V; age: number } | undefined;
  private leaving: V | undefined;
  private team: V | undefined;
  private lastDuration = 0;

  /** The tags to show now: the team shirt, the one fading out, the one on screen. */
  get tags(): readonly V[] {
    const out: V[] = [];
    if (this.team !== undefined) out.push(this.team);
    if (this.leaving !== undefined) out.push(this.leaving);
    if (this.held !== undefined) out.push(this.held.view);
    return out;
  }

  /** The key of the tag fading out, if any (the screen times its removal). */
  get leavingKey(): string | undefined {
    return this.leaving?.key;
  }

  /** How long the tag on screen has been there, in ms of the clock of the match. */
  get age(): number | undefined {
    return this.held?.age;
  }

  /** The fade of `key` ended (or its time ran out): takes it away. Whether it was there. */
  left(key: string): boolean {
    if (this.leaving?.key !== key) return false;
    this.leaving = undefined;
    return true;
  }

  /** The step just revealed. Returns whether the tags on screen changed. */
  step(input: TagStepInput<V>): boolean {
    const before = this.signature();
    this.leaving = undefined;
    if (this.held !== undefined) this.held.age += this.lastDuration;
    this.lastDuration = input.duration;

    if (input.plan !== undefined && input.view !== undefined) {
      if (this.held?.plan.key === input.plan.key) {
        this.held.plan = input.plan;
        this.held.view = input.view;
      } else {
        this.held = { plan: input.plan, view: input.view, age: 0 };
      }
    } else if (input.plan !== undefined) {
      this.held = undefined;
    } else if (this.held !== undefined) {
      if (this.held.plan.tone === 'goal') {
        this.held = undefined;
      } else if (this.held.age >= TAG_MIN_MS[input.speed]) {
        if (input.fade) this.leaving = { ...this.held.view, leaving: true };
        this.held = undefined;
      }
    }
    this.team = this.held === undefined ? input.team : undefined;
    return before !== this.signature();
  }

  private signature(): string {
    return this.tags.map((v) => `${v.key}/${v.leaving}`).join('|');
  }
}
