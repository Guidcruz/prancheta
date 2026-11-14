import type {
  ClubId,
  FixtureId,
  GameState,
  MatchGoal,
  MatchSheet,
  MatchSheetEvent,
  MatchStats,
  Side,
} from '@engine';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import type { MatchSide } from './components/MatchCard.svelte';
import type { StatsRow } from './components/MatchStatsTable.svelte';
import type { TimelineItem } from './components/MatchTimeline.svelte';
import { matchDate } from './club';
import {
  minuteLabel,
  resultOf,
  shortHandedClub,
  shortNameOf,
  type PlayedFixture,
  type ResultLetter,
} from './round';

/*
 * What the match report shows (docs/design/telas/resumo-rodada.md, "Súmula (folha) — T-083";
 * US-019): the report of a match already played is `Fixture.result` plus the match sheet kept
 * outside the state (`career.matchSheets[fixture.id]`; docs/02-architecture.md, 4.1, "Relatório da
 * rodada fora do estado"). Without that sheet (a round in `missingSheetRounds`, or a row that is
 * not there), the events give way to a notice and the goals come from `Fixture.result.goals`;
 * the rest comes from the result and stays. Pure reads of any played fixture of the season, so the
 * round summary (T-083) and the Calendário (T-031) share it; the texts come from the content.
 */

/** Everything the report of one played match shows, already translated and formatted. */
export interface MatchReport {
  readonly fixture: PlayedFixture;
  /** The two sides of the board: crest, short name and goals of the awarded score. */
  readonly home: MatchSide;
  readonly away: MatchSide;
  /** "Rodada 5 · dom., 10 de mai." */
  readonly meta: string;
  /** The board's accessible name: "Placar: Leões 2, Tubarões 1". */
  readonly scoreA11y: string;
  /** The coach's side, when his club played: his name in bold and the result badge. */
  readonly mine?: Side;
  readonly result?: ResultLetter;
  /** The note of a match ended early (`match.abandoned`), naming the club short of players. */
  readonly abandoned?: string;
  /**
   * The events of the match sheet in match order or, with no sheet (`missing`), only the goals of
   * the result, in the order of the minute.
   */
  readonly events: readonly TimelineItem[];
  /** No match sheet stored for this match: the notice takes the place of the events. */
  readonly missing: boolean;
  /** The best on the pitch, with the rating only when the sheet has it. */
  readonly motm?: { readonly name: string; readonly rating?: string };
  readonly stats: {
    readonly caption: string;
    readonly home: string;
    readonly away: string;
    readonly rows: readonly StatsRow[];
  };
  /** "Estádio · Público: 23.456" */
  readonly place: string;
}

/** A played fixture of the season by its id, or `undefined` (unknown, or not played yet). */
export function playedFixture(game: GameState, id: FixtureId): PlayedFixture | undefined {
  const fixture = game.fixtures.find((f) => f.id === id);
  return fixture?.result === undefined ? undefined : (fixture as PlayedFixture);
}

const playerName = (game: GameState, id: string, lang: Lang): string =>
  game.players[id]?.name.display ?? t('match.player.unknown', lang);

const KIND_KEYS = { penalty: 'match.goal.penalty', freeKick: 'match.goal.freeKick' } as const;

/** The short kind of a goal ("pênalti") and its reading ("de pênalti"); none from open play. */
function goalKind(kind: MatchGoal['kind'], lang: Lang): Pick<TimelineItem, 'note' | 'noteA11y'> {
  if (kind === 'open') return {};
  const key = KIND_KEYS[kind];
  return { note: t(key, lang), noteA11y: t(`${key}.a11y`, lang) };
}

/** The common part of a line: the minute (shown and read) and the club, by its short name. */
function lineBase(
  game: GameState,
  fixture: PlayedFixture,
  at: { readonly minute: number; readonly added?: number; readonly side: Side },
  lang: Lang,
): Pick<TimelineItem, 'minute' | 'minuteA11y' | 'club'> {
  const minute = minuteLabel(at, lang);
  return {
    minute: minute.text,
    minuteA11y: minute.a11y,
    club: shortNameOf(game, at.side === 'home' ? fixture.homeId : fixture.awayId),
  };
}

/** A goal as a line: the scorer, the short kind and the assist, when there is one. */
function goalLine(
  game: GameState,
  fixture: PlayedFixture,
  goal: Pick<MatchGoal, 'minute' | 'added' | 'side' | 'scorer' | 'assist' | 'kind'>,
  lang: Lang,
): TimelineItem {
  return {
    ...lineBase(game, fixture, goal, lang),
    kind: t('report.event.goal', lang),
    text: playerName(game, goal.scorer, lang),
    ...goalKind(goal.kind, lang),
    ...(goal.assist === undefined
      ? {}
      : { detail: t('report.event.assist', lang, { name: playerName(game, goal.assist, lang) }) }),
  };
}

/**
 * One event of the match sheet as a line of the timeline (resumo-rodada.md, the table of item 5):
 * the word of its kind always written, the icon and its colour only reinforcing it. A yellow that
 * suspends says so only with the full realism: in the simplified one nobody misses the next round.
 */
export function eventLine(
  game: GameState,
  fixture: PlayedFixture,
  event: MatchSheetEvent,
  lang: Lang,
): TimelineItem {
  const name = (id: string) => playerName(game, id, lang);
  switch (event.type) {
    case 'goal':
      return goalLine(game, fixture, event, lang);
    case 'penaltyMissed':
      return {
        ...lineBase(game, fixture, event, lang),
        kind: t('report.event.penaltyMissed', lang),
        text: name(event.taker),
      };
    case 'yellow': {
      const suspends = event.triggersSuspension && game.rules.realism === 'full';
      return {
        ...lineBase(game, fixture, event, lang),
        icon: 'card',
        tone: 'yellow',
        kind: t(suspends ? 'report.event.yellowSuspended' : 'report.event.yellow', lang),
        text: name(event.player),
      };
    }
    case 'red':
      return {
        ...lineBase(game, fixture, event, lang),
        icon: 'card',
        tone: 'red',
        kind: t(
          event.reason === 'secondYellow' ? 'report.event.redSecondYellow' : 'report.event.red',
          lang,
        ),
        text: name(event.player),
      };
    case 'injury':
      return {
        ...lineBase(game, fixture, event, lang),
        icon: 'injury',
        kind: t('report.event.injury', lang),
        text: name(event.player),
      };
    case 'substitution':
      return {
        ...lineBase(game, fixture, event, lang),
        icon: 'swap',
        kind: t('report.event.sub', lang),
        text: t('report.event.subDetail', lang, { in: name(event.in), out: name(event.out) }),
      };
  }
}

/** The real goals of the result, in the order of the minute (added time after its minute). */
function resultGoals(game: GameState, fixture: PlayedFixture, lang: Lang): TimelineItem[] {
  return [...fixture.result.goals]
    .sort((a, b) => a.minute - b.minute || (a.added ?? 0) - (b.added ?? 0))
    .map((goal) => goalLine(game, fixture, goal, lang));
}

const STAT_ROWS = [
  ['shots', 'report.stats.shots'],
  ['onTarget', 'report.stats.onTarget'],
  ['possession', 'report.stats.possession'],
  ['yellows', 'report.stats.yellows'],
  ['reds', 'report.stats.reds'],
] as const satisfies readonly (readonly [keyof MatchStats, string])[];

/**
 * The report of a played match for the coach of `clubId` (who may not be in it), with the match
 * sheet when it was stored (`sheet`), or `undefined` for a fixture not played.
 */
export function matchReport(
  game: GameState,
  fixtureId: FixtureId,
  sheet: MatchSheet | undefined,
  clubId: ClubId,
  lang: Lang,
): MatchReport | undefined {
  const fixture = playedFixture(game, fixtureId);
  if (fixture === undefined) return undefined;
  const { result } = fixture;
  const home = shortNameOf(game, fixture.homeId);
  const away = shortNameOf(game, fixture.awayId);
  // A club of the fixture missing from the state is a bug: it fails the report alone (the sheet
  // shows the error of a block), never the screen that opened it.
  const side = (id: ClubId, goals: number): MatchSide => {
    const def = game.clubs[id]?.def;
    if (def === undefined)
      throw new Error(`the club ${id} of fixture ${fixture.id} is not in the state`);
    return { club: def, name: def.shortName, goals };
  };
  const mine: Side | undefined =
    fixture.homeId === clubId ? 'home' : fixture.awayId === clubId ? 'away' : undefined;
  const shortHanded = shortHandedClub(fixture);
  const number = new Intl.NumberFormat(lang);
  const rating = new Intl.NumberFormat(lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const stat = (key: keyof MatchStats, side: Side) => {
    const value = number.format(result.stats[side][key]);
    return key === 'possession' ? t('report.stats.possessionValue', lang, { value }) : value;
  };
  // A sheet of another fixture (it never should be) counts as none.
  const stored = sheet?.fixtureId === fixture.id ? sheet : undefined;
  return {
    fixture,
    home: side(fixture.homeId, result.score[0]),
    away: side(fixture.awayId, result.score[1]),
    meta: t('report.meta', lang, { round: fixture.round, date: matchDate(fixture.date, lang) }),
    scoreA11y: t('match.score.a11y', lang, {
      home,
      homeGoals: result.score[0],
      away,
      awayGoals: result.score[1],
    }),
    ...(mine === undefined ? {} : { mine, result: resultOf(result.score, mine) }),
    ...(shortHanded === undefined
      ? {}
      : { abandoned: t('match.abandoned', lang, { club: shortNameOf(game, shortHanded) }) }),
    events:
      stored === undefined
        ? resultGoals(game, fixture, lang)
        : stored.events.map((event) => eventLine(game, fixture, event, lang)),
    missing: stored === undefined,
    ...(result.motm === undefined
      ? {}
      : {
          motm: {
            name: playerName(game, result.motm, lang),
            ...(stored?.motmRating === undefined
              ? {}
              : {
                  rating: t('report.motm.rating', lang, {
                    rating: rating.format(stored.motmRating),
                  }),
                }),
          },
        }),
    stats: {
      caption: t('report.stats.caption', lang, { home, away }),
      home,
      away,
      rows: STAT_ROWS.map(([key, label]) => ({
        label: t(label, lang),
        home: stat(key, 'home'),
        away: stat(key, 'away'),
      })),
    },
    place: t('report.place', lang, {
      stadium: game.clubs[fixture.homeId]?.def.stadium.name ?? home,
      attendance: t('report.attendance', lang, { count: number.format(result.attendance) }),
    }),
  };
}
