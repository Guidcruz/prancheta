import { writable, type Readable } from 'svelte/store';
import type { CareerSummary } from '@lib/career';

/*
 * Deleting a career in two steps (US-034; docs/design/telas/inicio.md, "Apagar com confirmação
 * dupla"; saves.md). The same flow serves the home screen and Carreiras e backup:
 *
 *   idle -> actions ("Mais ações") -> step1 ("Quero apagar") -> step2 ("Apagar carreira")
 *
 * Only the confirm of step 2 calls `remove`. Cancel, close, Esc, a tap outside or the back
 * gesture, at any step, end the flow without deleting and give the focus back to the career's
 * "Mais ações" button. A protected career (the one open in the frame) never leaves `actions`.
 * Before T-020 step 1 has no "Exportar carreira" (CEO decision 5 of T-025).
 *
 * A double tap must never delete (T-025 review, BLOCKER): each sheet opens where the player's
 * finger still is, so the step buttons ignore taps for {@link STEP_GUARD_MS} after their sheet
 * opens. The clock is injected, so the tests are deterministic.
 */

/** How long after a sheet opens its step button ignores taps (a double or triple tap). */
export const STEP_GUARD_MS = 500;

export interface DeleteFlowOptions {
  /** A career that cannot be deleted from here (the open one, in Carreiras e backup). */
  readonly protectedId?: () => string | undefined;
  /** A monotonic clock in ms (`performance.now` by default). */
  readonly now?: () => number;
}

export type DeleteState =
  | { readonly stage: 'idle' }
  | { readonly stage: 'actions' | 'step1'; readonly career: CareerSummary }
  | {
      readonly stage: 'step2';
      readonly career: CareerSummary;
      readonly busy: boolean;
      /** `remove` failed: nothing was deleted, the sheet says so and stays open. */
      readonly failed: boolean;
    };

/** Where the focus goes when the flow ends. */
export type FocusTarget =
  | { readonly kind: 'actions'; readonly careerId: string }
  /** The heading of the list (or the empty state when the list is now empty). */
  | { readonly kind: 'list' };

export type DeleteOutcome =
  | { readonly kind: 'deleted'; readonly career: CareerSummary }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ignored' };

const IDLE: DeleteState = { stage: 'idle' };

export class DeleteFlow {
  private readonly store = writable<DeleteState>(IDLE);
  private current: DeleteState = IDLE;
  private readonly remove: (careerId: string) => Promise<{ readonly ok: boolean }>;
  private readonly protectedId: () => string | undefined;
  private readonly now: () => number;
  /** When the sheet of the current stage opened. */
  private openedAt = 0;
  readonly state: Readable<DeleteState> = { subscribe: this.store.subscribe };

  /** @param remove `CareerService.remove`. */
  constructor(
    remove: (careerId: string) => Promise<{ readonly ok: boolean }>,
    options: DeleteFlowOptions = {},
  ) {
    this.remove = remove;
    this.protectedId = options.protectedId ?? (() => undefined);
    this.now = options.now ?? (() => performance.now());
  }

  /** The sheet of the current stage opened too recently: the tap is the end of a double tap. */
  private tooSoon(): boolean {
    return this.now() - this.openedAt < STEP_GUARD_MS;
  }

  get snapshot(): DeleteState {
    return this.current;
  }

  get open(): boolean {
    return this.current.stage !== 'idle';
  }

  /** Whether the career of the open flow can be deleted here. */
  canDelete(career: CareerSummary): boolean {
    return career.id !== this.protectedId();
  }

  /** "Mais ações" of a career. Ignored while another flow is open. */
  openActions(career: CareerSummary): boolean {
    if (this.open) return false;
    this.enter({ stage: 'actions', career });
    return true;
  }

  /** "Apagar carreira" in the actions sheet: step 1, which destroys nothing yet. */
  chooseDelete(): void {
    const now = this.current;
    if (now.stage !== 'actions' || !this.canDelete(now.career) || this.tooSoon()) return;
    this.enter({ stage: 'step1', career: now.career });
  }

  /** "Quero apagar" in step 1: the explicit second confirmation. */
  proceed(): void {
    const now = this.current;
    if (now.stage !== 'step1' || this.tooSoon()) return;
    this.enter({ stage: 'step2', career: now.career, busy: false, failed: false });
  }

  /**
   * Cancel, close, Esc, a tap outside or back, at any step: nothing is deleted. While the delete
   * is running the flow waits for it (the sheet's cancel is disabled), so nothing changes.
   */
  cancel(): FocusTarget | undefined {
    const now = this.current;
    if (now.stage === 'idle') return undefined;
    if (now.stage === 'step2' && now.busy) return undefined;
    this.set(IDLE);
    return { kind: 'actions', careerId: now.career.id };
  }

  /** "Apagar carreira" in step 2: the only call to `remove`. A second tap while busy is ignored. */
  async confirm(): Promise<DeleteOutcome> {
    const now = this.current;
    if (now.stage !== 'step2' || now.busy || !this.canDelete(now.career) || this.tooSoon()) {
      return { kind: 'ignored' };
    }
    const career = now.career;
    this.set({ stage: 'step2', career, busy: true, failed: false });
    let ok = false;
    try {
      ok = (await this.remove(career.id)).ok;
    } catch {
      // The service never throws for a storage situation; if it ever does, nothing was deleted
      // as far as the player can tell, and the button must not stay busy.
      ok = false;
    }
    if (!ok) {
      this.set({ stage: 'step2', career, busy: false, failed: true });
      return { kind: 'failed' };
    }
    this.set(IDLE);
    return { kind: 'deleted', career };
  }

  /** A new sheet opens: its step button waits for the guard. */
  private enter(next: DeleteState): void {
    this.openedAt = this.now();
    this.set(next);
  }

  private set(next: DeleteState): void {
    this.current = next;
    this.store.set(next);
  }
}
