import {
  getStandings,
  type ClubId,
  type Fixture,
  type GameState,
  type MatchGoal,
  type MatchSummary,
  type StandingRow,
} from '@engine';
import type { Lang } from '@lib/config';
import type { ShieldClub } from '@lib/generators/shield';
import { t, tPlural } from '@lib/i18n';
import type { GoalColumn } from './components/GoalList.svelte';
import type { IconName } from './components/Icon.svelte';

/*
 * What the round summary reads of the career (docs/design/telas/resumo-rodada.md, "O que a tela
 * lê"; US-019): the last round played, the coach's match, the other nine and the position with
 * its change. Only the stored state (`Fixture.result`, `getStandings`), never the `RoundReport`
 * in memory nor `career.lastRound`, so the summary before and after a reload is the same. Pure
 * reads; the texts come from the content (`t`), never from here.
 */

export type ResultLetter = 'W' | 'D' | 'L';

/** A fixture already played: its result is there. */
export type PlayedFixture = Fixture & { readonly result: MatchSummary };

const played = (fixture: Fixture): fixture is PlayedFixture => fixture.result !== undefined;

/**
 * The round the summary shows: always the last one played (`game.round − 1`; after round 38,
 * `game.round` is 39), or `undefined` when the season has no round played yet.
 */
export function summaryRound(game: GameState): number | undefined {
  const round = game.round - 1;
  if (round < 1) return undefined;
  return game.fixtures.some((f) => f.round === round && played(f)) ? round : undefined;
}

/** The result of a score from one side's point of view. */
export function resultOf(score: readonly [number, number], side: 'home' | 'away'): ResultLetter {
  const [mine, theirs] = side === 'home' ? score : [score[1], score[0]];
  return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
}

/**
 * How many places the club moved in the round: positive up, negative down, 0 the same. Compares
 * the table after `round` with the table after the round before; round 1 has no change (the
 * table before it is all zeros; tabela.md, "Vazio"), and neither has a club not in the table.
 */
export function positionChange(game: GameState, clubId: ClubId, round: number): number | undefined {
  if (round <= 1) return undefined;
  const before = getStandings(game, round - 1).find((r) => r.clubId === clubId);
  const after = getStandings(game, round).find((r) => r.clubId === clubId);
  if (before === undefined || after === undefined) return undefined;
  return before.position - after.position;
}

/** The text of a change of position, and the arrow that reinforces it (none for "the same"). */
export function changeLine(change: number, lang: Lang): { text: string; icon?: IconName } {
  if (change > 0) return { text: tPlural('round.table.up', change, lang), icon: 'arrow-up' };
  if (change < 0) return { text: tPlural('round.table.down', -change, lang), icon: 'arrow-down' };
  return { text: t('round.table.same', lang) };
}

/** The minute of a goal as shown ("23'", "45+2'") and as read ("minuto 23"). */
export function minuteLabel(
  goal: Pick<MatchGoal, 'minute' | 'added'>,
  lang: Lang,
): { text: string; a11y: string } {
  const added = goal.added ?? 0;
  if (added > 0) {
    const vars = { minute: goal.minute, added };
    return {
      text: t('match.minuteAdded', lang, vars),
      a11y: t('match.minuteAdded.a11y', lang, vars),
    };
  }
  const vars = { minute: goal.minute };
  return { text: t('match.minute', lang, vars), a11y: t('match.minute.a11y', lang, vars) };
}

const KIND_KEYS = { penalty: 'match.goal.penalty', freeKick: 'match.goal.freeKick' } as const;

/** The short name of a club, as in every list. */
export const shortNameOf = (game: GameState, id: ClubId): string =>
  game.clubs[id]?.def.shortName ?? id;

/** The crest fields of a club (its `def`), or `undefined` when it is not in the state. */
export const crestOf = (game: GameState, id: ClubId): ShieldClub | undefined => game.clubs[id]?.def;

/**
 * The real goals of a played match (`result.goals`; in an abandoned match they may not add up to
 * the awarded score) in two columns, home first, each in the order of the minute (added time
 * after its minute). The scorer by `name.display`, or a neutral word when he is no longer in the
 * state.
 */
export function goalColumns(
  game: GameState,
  fixture: PlayedFixture,
  lang: Lang,
): [GoalColumn, GoalColumn] {
  const ordered = [...fixture.result.goals].sort(
    (a, b) => a.minute - b.minute || (a.added ?? 0) - (b.added ?? 0),
  );
  const column = (side: 'home' | 'away'): GoalColumn => ({
    label: t('round.goals.of', lang, {
      club: shortNameOf(game, side === 'home' ? fixture.homeId : fixture.awayId),
    }),
    goals: ordered
      .filter((goal) => goal.side === side)
      .map((goal) => {
        const minute = minuteLabel(goal, lang);
        const kind = goal.kind === 'open' ? undefined : KIND_KEYS[goal.kind];
        return {
          minute: minute.text,
          minuteA11y: minute.a11y,
          name: game.players[goal.scorer]?.name.display ?? t('match.player.unknown', lang),
          ...(kind === undefined ? {} : { kind: t(kind, lang), kindA11y: t(`${kind}.a11y`, lang) }),
        };
      }),
  });
  return [column('home'), column('away')];
}

/** The club that ended an abandoned match short of players: the loser by the awarded score. */
export function shortHandedClub(fixture: PlayedFixture): ClubId | undefined {
  if (!fixture.result.abandoned) return undefined;
  const [home, away] = fixture.result.score;
  if (home === away) return undefined;
  return home < away ? fixture.homeId : fixture.awayId;
}

/** Everything the summary shows of one round. */
export interface RoundSummary {
  readonly round: number;
  readonly mine: {
    readonly fixture: PlayedFixture;
    readonly venue: 'home' | 'away';
    readonly result: ResultLetter;
  };
  /** The other matches of the round, in the order of the calendar. */
  readonly others: readonly PlayedFixture[];
  readonly standing: StandingRow;
  /** Places moved in the round (`positionChange`); absent in round 1. */
  readonly change?: number;
}

/**
 * The summary of the last round played for the coach's club, or `undefined` when there is none
 * to show (no round played, or the club had no match in it).
 */
export function roundSummary(game: GameState, clubId: ClubId): RoundSummary | undefined {
  const round = summaryRound(game);
  if (round === undefined) return undefined;
  const fixtures = game.fixtures.filter((f) => f.round === round).filter(played);
  const fixture = fixtures.find((f) => f.homeId === clubId || f.awayId === clubId);
  const standing = getStandings(game, round).find((r) => r.clubId === clubId);
  if (fixture === undefined || standing === undefined) return undefined;
  const venue = fixture.homeId === clubId ? 'home' : 'away';
  const change = positionChange(game, clubId, round);
  return {
    round,
    mine: { fixture, venue, result: resultOf(fixture.result.score, venue) },
    others: fixtures.filter((f) => f !== fixture),
    standing,
    ...(change === undefined ? {} : { change }),
  };
}

/** The `rivals` of the home club hold the away one (the "Clássico" badge). */
export function isDerby(game: GameState, fixture: Fixture): boolean {
  return game.clubs[fixture.homeId]?.def.rivals.includes(fixture.awayId) ?? false;
}

/**
 * The accessible name of the card of another match, a button that opens its report (T-083):
 * `round.others.open` holds the visible names and goals in the order shown, and after them, as
 * on the card, the "Clássico" badge and the note of a match ended early (WCAG 2.5.3).
 */
export function otherCardLabel(game: GameState, fixture: PlayedFixture, lang: Lang): string {
  const parts = [
    t('round.others.open', lang, {
      home: shortNameOf(game, fixture.homeId),
      homeGoals: fixture.result.score[0],
      away: shortNameOf(game, fixture.awayId),
      awayGoals: fixture.result.score[1],
    }),
  ];
  if (isDerby(game, fixture)) parts.push(t('match.derby', lang));
  if (fixture.result.abandoned) parts.push(t('match.abandoned.short', lang));
  return parts.join(', ');
}
