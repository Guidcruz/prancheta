import { SEASON_ROUNDS, type ClubId, type Fixture, type GameState } from '@engine';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import type { StatusBadgeItem } from './components/StatusBadge.svelte';
import { matchDate } from './club';
import { isDerby, resultOf, shortNameOf, type PlayedFixture, type ResultLetter } from './round';
import { centredScroll, type OpeningLayout } from './table';

/*
 * What the Calendário tab reads of the career (docs/design/telas/calendario.md, "O que a tela
 * lê"; US-024): the 38 rounds of the coach's club in two halves, the next round, the result on
 * the coach's side and the derbies, the ten matches of a round already played, the address of the
 * Rodada subscreen and where the list opens. Pure reads of the GameState; the texts come from the
 * content (`t`), never from here.
 */

const played = (fixture: Fixture): fixture is PlayedFixture => fixture.result !== undefined;

/** The half of the season a round is in (`round ≤ SEASON_ROUNDS / 2`: the first). */
export type Half = 'first' | 'second';

export const halfOf = (round: number): Half => (round <= SEASON_ROUNDS / 2 ? 'first' : 'second');

/** The round to play next, or `undefined` with the season over (no card has the highlight). */
export function nextRoundOf(game: GameState): number | undefined {
  return game.phase === 'season' && game.round >= 1 && game.round <= SEASON_ROUNDS
    ? game.round
    : undefined;
}

/** One round of the coach's club, as the list reads it. */
export interface CalendarEntry {
  readonly round: number;
  readonly fixture: Fixture;
  /** The coach's venue. */
  readonly venue: 'home' | 'away';
  /** The opponent is in the club's `rivals` (they are mutual). */
  readonly derby: boolean;
  /** The result on the coach's side, once played. */
  readonly result?: ResultLetter;
  /** The next round to play (the card with the highlight). */
  readonly next: boolean;
}

/** The rounds of the coach's club in the order of the round (one per round in the Série A). */
export function clubCalendar(game: GameState, clubId: ClubId): CalendarEntry[] {
  const next = nextRoundOf(game);
  return game.fixtures
    .filter((f) => f.homeId === clubId || f.awayId === clubId)
    .sort((a, b) => a.round - b.round)
    .map((fixture): CalendarEntry => {
      const venue = fixture.homeId === clubId ? 'home' : 'away';
      return {
        round: fixture.round,
        fixture,
        venue,
        derby: isDerby(game, fixture),
        ...(fixture.result === undefined ? {} : { result: resultOf(fixture.result.score, venue) }),
        next: fixture.round === next,
      };
    });
}

/** The list split in its two halves, each in the order of the round. */
export function calendarHalves(
  entries: readonly CalendarEntry[],
): Readonly<Record<Half, CalendarEntry[]>> {
  return {
    first: entries.filter((e) => halfOf(e.round) === 'first'),
    second: entries.filter((e) => halfOf(e.round) === 'second'),
  };
}

/** Every match of the round is played: the round opens (rounds still to play do not). */
export function roundPlayed(game: GameState, round: number): boolean {
  const fixtures = game.fixtures.filter((f) => f.round === round);
  return fixtures.length > 0 && fixtures.every(played);
}

/**
 * The round of an address of the Rodada subscreen (the text after `#/calendar/round/`), when it
 * is a whole number from 1 to {@link SEASON_ROUNDS} written plainly and that round of the current
 * season is already played; otherwise `undefined`, and the address becomes `#/calendar`.
 */
export function roundFromAddress(game: GameState, text: string | undefined): number | undefined {
  if (text === undefined || !/^[1-9]\d*$/.test(text)) return undefined;
  const round = Number(text);
  if (round > SEASON_ROUNDS) return undefined;
  return roundPlayed(game, round) ? round : undefined;
}

/**
 * The ten matches of a round already played as the Rodada shows them: the coach's first, then
 * the other nine in the order of the calendar (CEO decision 5). `undefined` when the round is not
 * played (or does not exist).
 */
export function roundMatches(
  game: GameState,
  clubId: ClubId,
  round: number,
): PlayedFixture[] | undefined {
  if (!roundPlayed(game, round)) return undefined;
  const fixtures = game.fixtures.filter((f) => f.round === round).filter(played);
  const mine = fixtures.filter((f) => f.homeId === clubId || f.awayId === clubId);
  return [...mine, ...fixtures.filter((f) => !mine.includes(f))];
}

const RESULT_KIND = { W: 'win', D: 'draw', L: 'loss' } as const;

/** The props of one card of the list, every text ready. */
export interface CalendarCardView {
  readonly round: number;
  readonly meta: string;
  readonly venueLabel: string;
  /** "Clássico", then the result word (calendario.md, "Conteúdo da lista", item 4). */
  readonly badges: readonly StatusBadgeItem[];
  readonly note?: string;
  /** The highlight word of the next round ("Próximo jogo"). */
  readonly highlight?: string;
  /** The accessible name of a played card (a button); none for a card only to read. */
  readonly a11yLabel?: string;
  readonly homeGoals?: number;
  readonly awayGoals?: number;
}

/**
 * The texts of one card of the list. The name of a played card is `calendar.match.open` (the
 * round, the names and goals in the order shown, the result), and after it, as on the card, the
 * venue, the "Clássico" badge and the note of a match ended early (WCAG 2.5.3).
 */
export function cardView(game: GameState, entry: CalendarEntry, lang: Lang): CalendarCardView {
  const { fixture } = entry;
  const venueLabel = t(`match.venue.${entry.venue}`, lang);
  const derby = t('match.derby', lang);
  const badges: StatusBadgeItem[] = entry.derby ? [{ kind: 'derby', label: derby }] : [];
  const base = {
    round: entry.round,
    meta: t('club.next.meta', lang, {
      round: entry.round,
      date: matchDate(fixture.date, lang),
    }),
    venueLabel,
  };
  if (fixture.result === undefined || entry.result === undefined) {
    return {
      ...base,
      badges,
      ...(entry.next ? { highlight: t('club.next.title', lang) } : {}),
    };
  }
  const word = t(`result.${entry.result}`, lang);
  const [homeGoals, awayGoals] = fixture.result.score;
  const note = fixture.result.abandoned ? t('match.abandoned.short', lang) : undefined;
  const parts = [
    t('calendar.match.open', lang, {
      round: entry.round,
      home: shortNameOf(game, fixture.homeId),
      homeGoals,
      away: shortNameOf(game, fixture.awayId),
      awayGoals,
      result: word,
    }),
    venueLabel,
  ];
  if (entry.derby) parts.push(derby);
  if (note !== undefined) parts.push(note);
  return {
    ...base,
    badges: [...badges, { kind: RESULT_KIND[entry.result], label: word }],
    ...(note === undefined ? {} : { note }),
    a11yLabel: parts.join(', '),
    homeGoals,
    awayGoals,
  };
}

/**
 * The round whose card the list shows when it opens: the round the player came back from (the
 * Rodada), or else the next round, or else (season over) the last one.
 */
export function listTarget(game: GameState, origin?: number): number {
  if (origin !== undefined && origin >= 1 && origin <= SEASON_ROUNDS) return origin;
  return nextRoundOf(game) ?? SEASON_ROUNDS;
}

/**
 * The scroll of the page when the list opens (calendario.md, item 5 and "De volta à lista"): the
 * card of {@link listTarget} in the middle of the area between the header and "Jogar rodada",
 * clamped to what the page can scroll, so round 1 leaves the list at the top and round 38 at the
 * end. No animation: the caller jumps.
 */
export function calendarScroll(layout: OpeningLayout): number {
  return centredScroll(layout);
}

/** The state of the list's entry in the history: the round the player opened from it. */
export interface CalendarListEntry {
  readonly calendarFrom: number;
}

/** The round the list's entry was left for (`history.state.calendarFrom`), if any. */
export function originOf(state: unknown): number | undefined {
  if (typeof state !== 'object' || state === null) return undefined;
  const from: unknown = (state as { calendarFrom?: unknown }).calendarFrom;
  return typeof from === 'number' && Number.isInteger(from) ? from : undefined;
}

/** The entry of the Rodada was pushed from the list: the entry below it is the list. */
export function cameFromList(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as { calendarList?: unknown }).calendarList === true
  );
}
