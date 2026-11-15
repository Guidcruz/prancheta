import type { ClubId, GameState, MatchEvent, PlayerId, Side } from '@engine';
import type { Lang } from '@lib/config';
import { t, tPlural } from '@lib/i18n';
import type { CommentaryItem } from '../components/CommentaryFeed.svelte';
import { crestOf, minuteLabel, shortNameOf } from '../round';
import type { LineState, MatchClock, MatchPhase } from './steps';

/*
 * The texts of the narrated match (docs/design/telas/partida.md, "Narração em texto", the table
 * of events, and "Acessibilidade"): one fixed sentence per kind of event in T-032 (the variants
 * are T-086's), every one from `app/src/content/<idioma>/ui.json`. The word of the kind is the
 * match report's (`report.event.*`) where the play is the same, so the player knows the goal or
 * the card in both places. The start of a play never gives a hint of its outcome: the start of a
 * goal and of a chance of the same kind are the same line, with only the shooter's name and club.
 */

/** Who plays the match, for the names. */
export interface NarrationContext {
  readonly game: GameState;
  readonly homeId: ClubId;
  readonly awayId: ClubId;
  readonly lang: Lang;
}

const clubOf = (ctx: NarrationContext, side: Side) =>
  shortNameOf(ctx.game, side === 'home' ? ctx.homeId : ctx.awayId);

/** The name a player is shown by ("match.player.unknown" without one). */
export const nameOf = (ctx: NarrationContext, id: PlayerId) =>
  ctx.game.players[id]?.name.display ?? t('match.player.unknown', ctx.lang);

/** The minute as shown ("45+2'") and as read ("minuto 45 mais 2 de acréscimo"). */
export function clockLabel(clock: MatchClock, lang: Lang): { text: string; a11y: string } {
  return minuteLabel(clock, lang);
}

const PHASE_KEYS: Readonly<Record<MatchPhase, string>> = {
  first: 'match.phase.first',
  half: 'match.phase.half',
  second: 'match.phase.second',
  end: 'match.phase.end',
};

export const phaseLabel = (phase: MatchPhase, lang: Lang): string => t(PHASE_KEYS[phase], lang);

const GOAL_KIND = { penalty: 'match.goal.penalty', freeKick: 'match.goal.freeKick' } as const;
const BUILD = { open: 'match.live.build.shot', freeKick: 'match.live.build.freeKick' } as const;
const KIND_WORD = { open: 'match.live.shot', freeKick: 'match.live.freeKick' } as const;
const OUTCOME = {
  saved: 'match.live.outcome.saved',
  post: 'match.live.outcome.post',
  wide: 'match.live.outcome.wide',
} as const;
const PRESET = {
  press: 'match.live.tactic.press',
  holdResult: 'match.live.tactic.holdResult',
  allOut: 'match.live.tactic.allOut',
} as const;

/** The club short of players in an abandoned match: the loser by the awarded score. */
function shortHanded(score: readonly [number, number]): Side | undefined {
  if (score[0] === score[1]) return undefined;
  return score[0] < score[1] ? 'home' : 'away';
}

/**
 * The start of a play with a dramatic pause, from what a goal and a chance share: the kind of
 * shot, the shooter and the side. Nothing else goes in (the assist exists only in a goal).
 */
function buildLine(
  ctx: NarrationContext,
  kind: 'open' | 'freeKick',
  shooter: PlayerId,
  side: Side,
): Pick<CommentaryItem, 'kind' | 'text' | 'club'> {
  return {
    kind: t(KIND_WORD[kind], ctx.lang),
    text: t(BUILD[kind], ctx.lang, { player: nameOf(ctx, shooter) }),
    club: clubOf(ctx, side),
  };
}

/** The visible part of a line, without the minute: the word of the kind, the text, the club. */
function lineBody(
  line: LineState,
  ctx: NarrationContext,
): Omit<CommentaryItem, 'id' | 'minute' | 'minuteA11y'> {
  const { lang } = ctx;
  const source = line.source;
  const name = (id: PlayerId) => nameOf(ctx, id);
  switch (source.type) {
    case 'kickoff':
      return { tone: 'phase', kind: t('match.live.kickoff', lang) };
    case 'secondHalf':
      return { tone: 'phase', kind: t('match.live.secondHalf', lang) };
    case 'halftime':
      return { tone: 'phase', kind: t('match.live.halftime', lang) };
    case 'stoppage':
      return {
        tone: 'phase',
        kind:
          source.minutes === 0
            ? t('match.live.stoppage.none', lang)
            : tPlural('match.live.stoppage', source.minutes, lang),
      };
    case 'fulltime': {
      const short = source.abandoned ? shortHanded(source.score) : undefined;
      return {
        tone: 'phase',
        kind: t('match.live.fulltime', lang),
        ...(short === undefined
          ? {}
          : { text: t('match.live.fulltime.abandoned', lang, { club: clubOf(ctx, short) }) }),
      };
    }
    case 'chance':
      if (line.stage === 'build') return buildLine(ctx, source.kind, source.shooter, source.side);
      return {
        kind: t(KIND_WORD[source.kind], lang),
        text: t(OUTCOME[source.outcome], lang, { player: name(source.shooter) }),
        club: clubOf(ctx, source.side),
      };
    case 'goal': {
      // A goal from the spot never has a start of its own: the start of a penalty is the line of
      // `penaltyAwarded` (steps.ts), and its goal only ever comes as the outcome.
      if (line.stage === 'build' && source.kind !== 'penalty') {
        return buildLine(ctx, source.kind, source.scorer, source.side);
      }
      const kind = source.kind === 'open' ? undefined : GOAL_KIND[source.kind];
      return {
        tone: 'goal',
        kind: t('report.event.goal', lang),
        text: name(source.scorer),
        ...(kind === undefined ? {} : { note: t(kind, lang), noteA11y: t(`${kind}.a11y`, lang) }),
        ...(source.assist === undefined
          ? {}
          : { detail: t('report.event.assist', lang, { name: name(source.assist) }) }),
        club: clubOf(ctx, source.side),
      };
    }
    case 'penaltyAwarded':
      return {
        kind: t('match.live.penalty', lang),
        text: t('match.live.penalty.taker', lang, { player: name(source.taker) }),
        club: clubOf(ctx, source.side),
      };
    case 'penaltyMissed':
      return {
        kind: t('report.event.penaltyMissed', lang),
        text: t(OUTCOME[source.outcome], lang, { player: name(source.taker) }),
        club: clubOf(ctx, source.side),
      };
    case 'yellow': {
      // Only the full realism suspends: in the simplified one nobody misses the next round.
      const suspends = source.triggersSuspension && ctx.game.rules.realism === 'full';
      return {
        icon: 'card',
        tone: 'yellow',
        kind: t(suspends ? 'report.event.yellowSuspended' : 'report.event.yellow', lang),
        text: name(source.player),
        club: clubOf(ctx, source.side),
      };
    }
    case 'red':
      return {
        icon: 'card',
        tone: 'red',
        kind: t(
          source.reason === 'secondYellow' ? 'report.event.redSecondYellow' : 'report.event.red',
          lang,
        ),
        text: name(source.player),
        club: clubOf(ctx, source.side),
      };
    case 'injury':
      return {
        icon: 'injury',
        kind: t('report.event.injury', lang),
        text: name(source.player),
        club: clubOf(ctx, source.side),
      };
    case 'substitution':
      return {
        icon: 'swap',
        kind: t('report.event.sub', lang),
        text: t('report.event.subDetail', lang, { in: name(source.in), out: name(source.out) }),
        club: clubOf(ctx, source.side),
      };
    case 'tacticChange': {
      // The text already names the club: no club line under it.
      const club = clubOf(ctx, source.side);
      const preset = source.preset ?? (source.posture === 'allOut' ? 'allOut' : undefined);
      return {
        kind: t('match.live.tactic', lang),
        text:
          preset === undefined
            ? t('match.live.tactic.change', lang, {
                club,
                posture: t(`tactic.posture.${source.posture}`, lang),
                pressure: t(`tactic.pressure.${source.pressure}`, lang),
              })
            : t(PRESET[preset], lang, { club }),
      };
    }
    case 'halftimeTalk':
      // Never shown (steps.ts, `isShown`); a line would only repeat the club.
      return { kind: '', club: clubOf(ctx, source.side) };
  }
}

/** The side a line is about; none for the phases (and for a talk that is never shown). */
function sideOf(line: LineState): Side | undefined {
  const source = line.source;
  switch (source.type) {
    case 'kickoff':
    case 'secondHalf':
    case 'halftime':
    case 'stoppage':
    case 'fulltime':
    case 'halftimeTalk':
      return undefined;
    default:
      return source.side;
  }
}

/** A line of the commentary, ready for the CommentaryFeed. */
export function commentaryItem(line: LineState, ctx: NarrationContext): CommentaryItem {
  const minute = clockLabel(line.clock, ctx.lang);
  const side = sideOf(line);
  const crest =
    side === undefined ? undefined : crestOf(ctx.game, side === 'home' ? ctx.homeId : ctx.awayId);
  return {
    id: line.id,
    minute: minute.text,
    minuteA11y: minute.a11y,
    ...lineBody(line, ctx),
    ...(crest === undefined ? {} : { crest }),
  };
}

/** The board's accessible name (`match.score.a11y`), with the score shown. */
export function scoreA11y(ctx: NarrationContext, score: readonly [number, number]): string {
  return t('match.score.a11y', ctx.lang, {
    home: clubOf(ctx, 'home'),
    homeGoals: score[0],
    away: clubOf(ctx, 'away'),
    awayGoals: score[1],
  });
}

/**
 * The sentence the screen reader hears for an announced event (only after an outcome: a goal, a
 * penalty awarded or missed, a red, half and full time), or `undefined` for any other.
 */
export function announcement(event: MatchEvent, ctx: NarrationContext): string | undefined {
  const { lang } = ctx;
  const board = (score: readonly [number, number]) => ({
    home: clubOf(ctx, 'home'),
    homeGoals: score[0],
    away: clubOf(ctx, 'away'),
    awayGoals: score[1],
  });
  switch (event.type) {
    case 'goal':
      return t('match.live.goal.a11y', lang, {
        club: clubOf(ctx, event.side),
        player: nameOf(ctx, event.scorer),
        minute: clockLabel(event, lang).a11y,
        ...board(event.score),
      });
    case 'penaltyAwarded':
      return t('match.live.penalty.a11y', lang, {
        club: clubOf(ctx, event.side),
        player: nameOf(ctx, event.taker),
      });
    case 'penaltyMissed':
      return t('match.live.penaltyMissed.a11y', lang, {
        club: clubOf(ctx, event.side),
        player: nameOf(ctx, event.taker),
      });
    case 'red':
      return t('match.live.red.a11y', lang, {
        club: clubOf(ctx, event.side),
        player: nameOf(ctx, event.player),
      });
    case 'halftime':
      return t('match.live.halftime.a11y', lang, board(event.score));
    case 'fulltime':
      return t('match.live.fulltime.a11y', lang, board(event.score));
    default:
      return undefined;
  }
}
