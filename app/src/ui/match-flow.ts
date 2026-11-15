import type { MatchMode } from '@engine';
import type { CareerState } from '@lib/career';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import type { OptionItem } from './components/OptionGroup.svelte';
import { lazyChunk } from './lazy-chunk';
import type { WatchMode } from './match/steps';
import { OFFERED_MATCH_MODES } from './new-game';

/*
 * The flow of "Jogar rodada" in the assisted modes (docs/design/telas/partida.md, "Fluxo da rodada
 * nos modos assistidos", "Seletor de tipo de partida" and "Navegação"): the match takes the whole
 * screen with its own address (`#/match`, pushed); at the end the summary replaces it (`#/round`
 * with `replaceState`), so the history is "tab → summary", as in "Só resultado". The phone's back
 * during the match pauses it and asks; there is no way out without playing.
 */

/**
 * The chunk of the match screen (docs/02-architecture.md, 4.7): the MatchScreen and what only it
 * imports (the clock, the player, the commentary, the loader of the pitch), asked when "Jogar
 * rodada" opens a match, once per session. This is the only way into it (the lint refuses a static
 * import of the screen).
 */
export const loadMatchScreen = lazyChunk(() => import('./screens/MatchScreen.svelte'));

/** The address of the match. */
export const MATCH_HASH = '#/match';

/** The state of the match's entry in the history. */
export const MATCH_ENTRY = { match: true } as const;

/** The address is the match's. */
export function isMatchHash(hash: string): boolean {
  return hash.replace(/^#\/?/, '') === 'match';
}

/** The mode opens the match screen ("Animada completa" or "Só lances principais"). */
export function watchModeOf(mode: MatchMode): WatchMode | undefined {
  return mode === 'result' ? undefined : mode;
}

/**
 * The round of the match was already stored when `playRound` failed (it threw after the write:
 * the career in memory is past the match's round, `matchRound`): "Tentar de novo" must not play
 * again, which would play the next round; the round goes to the summary as stored, or as not
 * stored when the write was refused. `undefined`: the round is still to play.
 */
export function storedOutcome(
  matchRound: number,
  career: Pick<CareerState, 'save' | 'unsaved'>,
): 'saved' | 'unsaved' | undefined {
  const round = career.save?.game.round;
  if (round === undefined || round <= matchRound) return undefined;
  return career.unsaved === undefined ? 'saved' : 'unsaved';
}

const ORDER: readonly MatchMode[] = ['full', 'highlights', 'result'];

/**
 * The cards of the sheet of the match mode: the modes offered (since T-085 the three, "Animada
 * completa" first), plus the career's own when it is not offered (it shows checked anyway), in the
 * order of the new game, with the texts of its cards.
 */
export function playModeOptions(current: MatchMode, lang: Lang): OptionItem[] {
  const modes = ORDER.filter((mode) => OFFERED_MATCH_MODES.includes(mode) || mode === current);
  return modes.map((value) => ({
    value,
    title: t(`newGame.match.${value}`, lang),
    description: t(`newGame.match.${value}.body`, lang),
  }));
}
