import type { CareerService, CareerState, PlayError } from '@lib/career';
import type { HistoryLike } from './home-routes';
import { PLAY_GUARD_MS } from './play-guard';
import { HOME_DESTINATION, hrefOf, type DestinationId } from './router';

export { PLAY_GUARD_MS };

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

/** The address is the round summary's. */
export function isRoundHash(hash: string): boolean {
  return hash.replace(/^#\/?/, '') === 'round';
}

/** The state of the summary's entry in the history (the tab under it is the entry before). */
interface RoundEntry {
  readonly round: true;
}

/** An entry of a sheet (`sheet-history.ts`, the "Mais" sheet, the card of a player...). */
const isSheetEntry = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && Boolean((state as { sheet?: unknown }).sheet);

const isRoundEntry = (state: unknown): state is RoundEntry =>
  typeof state === 'object' && state !== null && (state as { round?: unknown }).round === true;

/** The history the flow moves: `go` takes away the summary's entry with a sheet over it. */
export type RoundHistory = HistoryLike & Pick<History, 'go'>;

/** What the frame does once `CareerService.playRound` answers. */
export type PlayOutcome =
  /** The round was played (stored or not): the summary opens. */
  | { readonly kind: 'summary' }
  /** Nothing: a second tap while busy, or the career ended on this tab (full-screen error). */
  | { readonly kind: 'none' }
  /** Any other refusal: the content area shows the unexpected error with its code, never silent. */
  | { readonly kind: 'error'; readonly code: PlayError };

/**
 * The error the content area of the frame shows, by its code, or none: a bug while playing
 * (`crash`), a refusal of `playRound` other than busy (`playError`), or a save the store refused
 * as not of the format (`invalid-save`).
 */
export function areaErrorOf(
  career: Pick<CareerState, 'crash' | 'unsaved'>,
  playError: PlayError | undefined,
): PlayError | 'invalid-save' | undefined {
  if (career.crash !== undefined) return 'unexpected';
  if (playError !== undefined) return playError;
  return career.unsaved === 'invalid-save' ? 'invalid-save' : undefined;
}

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
  private readonly historyOf: () => RoundHistory;
  private readonly now: () => number;

  constructor(historyOf: () => RoundHistory, now: () => number = () => Date.now()) {
    this.historyOf = historyOf;
    this.now = now;
  }

  private get history(): RoundHistory {
    return this.historyOf();
  }

  /** Runs `action` (a tap on "Jogar rodada") unless the summary closed less than 500 ms ago. */
  tap(action: () => void): boolean {
    if (this.now() - this.closedAt < PLAY_GUARD_MS) return false;
    action();
    return true;
  }

  /**
   * The summary opens over the tab: its own entry, so the back gesture closes it. A sheet opened
   * while the round was computed (the "Mais" menu, a player's card) closes with it: its entry
   * becomes the summary's, so no entry of a sheet is left behind and back returns to the tab.
   */
  open(): void {
    this.closing = false;
    const entry: RoundEntry = { round: true };
    if (isSheetEntry(this.history.state)) this.history.replaceState(entry, '', ROUND_HASH);
    else this.history.pushState(entry, '', ROUND_HASH);
  }

  /**
   * The summary in place of the match (T-032; partida.md, "Fluxo da rodada nos modos assistidos",
   * step 6): the match's entry becomes the summary's, so back from the summary returns to the tab
   * under the match, never to the match.
   */
  replace(): void {
    this.closing = false;
    const entry: RoundEntry = { round: true };
    this.history.replaceState(entry, '', ROUND_HASH);
  }

  /**
   * "Continuar": back to the tab the summary came from. With the summary's entry on top, its entry
   * goes away (`history.back()`, and the popstate shows the tab); otherwise (an address typed or
   * restored) the address is replaced by the tab of origin (`origin`), or the Clube's, and that
   * tab is returned for the caller to show. `address` is the full address of the origin when it
   * is not the tab's own (the Rodada of the Calendário, `#/calendar/round/N`). With the entry of
   * a sheet opened over the summary on top (its match report, when the summary failed to draw
   * with the sheet open), both entries go away at once, so none is left behind. A second tap
   * while the first back is on its way does nothing.
   */
  close(origin?: DestinationId, address?: string): DestinationId | undefined {
    if (this.closing) return undefined;
    this.closedAt = this.now();
    const state: unknown = this.history.state;
    if (isRoundEntry(state)) {
      this.closing = true;
      // A sheet's entry keeps the state below it (`pushSheet`): the summary's is right under it.
      if (isSheetEntry(state)) this.history.go(-2);
      else this.history.back();
      return undefined;
    }
    const to = origin ?? HOME_DESTINATION;
    this.history.replaceState(null, '', address ?? hrefOf(to));
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
