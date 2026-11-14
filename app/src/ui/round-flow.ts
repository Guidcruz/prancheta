import type { CareerService, CareerState, PlayError } from '@lib/career';
import type { HistoryLike } from './home-routes';
import { HOME_DESTINATION, hrefOf, type DestinationId } from './router';

/*
 * The flow of "Jogar rodada" in the "só resultado" mode (docs/design/telas/resumo-rodada.md,
 * "Fluxo da rodada" and "Navegação"): the round is played and stored, and only then the summary
 * opens full screen, with its own entry in the history (`#/round`); "Continuar" or the phone's
 * back gesture returns to the tab it came from, and "Jogar rodada" ignores taps for about 500 ms
 * after that (the window of the confirmations in steps, design-system.md). The browser objects
 * come in as arguments, so the tests use fakes.
 */

/** The address of the round summary. */
export const ROUND_HASH = '#/round';

/** How long "Jogar rodada" ignores taps after the summary closes. */
export const PLAY_GUARD_MS = 500;

/** The address is the round summary's. */
export function isRoundHash(hash: string): boolean {
  return hash.replace(/^#\/?/, '') === 'round';
}

/** The state of the summary's entry in the history. */
interface RoundEntry {
  readonly round: true;
  /** The tab where "Jogar rodada" was tapped. */
  readonly from: DestinationId;
}

const isRoundEntry = (state: unknown): state is RoundEntry =>
  typeof state === 'object' && state !== null && (state as { round?: unknown }).round === true;

/** What the frame does once `CareerService.playRound` answers. */
export type PlayOutcome =
  /** The round was played (stored or not): the summary opens. */
  | { readonly kind: 'summary' }
  /** Nothing: a second tap while busy, or the career ended on this tab (full-screen error). */
  | { readonly kind: 'none' }
  /** Any other refusal: the content area shows the unexpected error with its code, never silent. */
  | { readonly kind: 'error'; readonly code: PlayError };

/** What `CareerService.playRound` answers. */
export type PlayAnswer = Awaited<ReturnType<CareerService['playRound']>>;

export function playOutcome(played: PlayAnswer, status: CareerState['status']): PlayOutcome {
  if (played.ok) return status === 'open' ? { kind: 'summary' } : { kind: 'none' };
  if (played.error === 'busy') return { kind: 'none' };
  return { kind: 'error', code: played.error };
}

/**
 * The summary's moves in the history, and the window that protects "Jogar rodada" after it
 * closes. One per career frame.
 */
export class RoundFlow {
  private closedAt = Number.NEGATIVE_INFINITY;
  /** "Continuar" asked `history.back()` and its popstate has not come yet. */
  private closing = false;

  /**
   * `history` is read on each move (the browser's, or a fake in the tests), so the flow can be
   * built where there is none (rendering on the server).
   */
  private readonly historyOf: () => HistoryLike;
  private readonly now: () => number;

  constructor(historyOf: () => HistoryLike, now: () => number = () => Date.now()) {
    this.historyOf = historyOf;
    this.now = now;
  }

  private get history(): HistoryLike {
    return this.historyOf();
  }

  /** Runs `action` (a tap on "Jogar rodada") unless the summary closed less than 500 ms ago. */
  tap(action: () => void): boolean {
    if (this.now() - this.closedAt < PLAY_GUARD_MS) return false;
    action();
    return true;
  }

  /** The summary opens over `from`: its own entry, so the back gesture closes it. */
  open(from: DestinationId): void {
    this.closing = false;
    this.history.pushState({ round: true, from } satisfies RoundEntry, '', ROUND_HASH);
  }

  /**
   * "Continuar": back to the tab the summary came from. With the summary's entry on top, its entry
   * goes away (`history.back()`, and the popstate shows the tab); otherwise (an address typed or
   * restored) the address is replaced by the tab of origin (`origin`), or the Clube's, and that
   * tab is returned for the caller to show. A second tap while the first back is on its way does
   * nothing.
   */
  close(origin?: DestinationId): DestinationId | undefined {
    if (this.closing) return undefined;
    this.closedAt = this.now();
    const state: unknown = this.history.state;
    if (isRoundEntry(state)) {
      this.closing = true;
      this.history.back();
      return undefined;
    }
    const to = origin ?? HOME_DESTINATION;
    this.history.replaceState(null, '', hrefOf(to));
    return to;
  }

  /** The address left the summary (back, forward, "Continuar"): the protection window starts. */
  left(): void {
    this.closing = false;
    this.closedAt = this.now();
  }

  /**
   * An address of the summary that shows no summary (no round played this season, or a career
   * just opened, which always opens on the Clube): replaced by the Clube's, which is returned.
   */
  toClub(): DestinationId {
    this.history.replaceState(null, '', hrefOf(HOME_DESTINATION));
    return HOME_DESTINATION;
  }
}
