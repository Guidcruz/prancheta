import { clamp } from '../math.ts';
import type { Rng } from '../rng.ts';
import type { PlayerId, Side } from '../types.ts';
import { MARKERS, RATING, SUSPENSION } from './rules.ts';
import type { Appearance, TeamState } from './team.ts';
import type { MatchMarker } from './types.ts';

/*
 * Full-time summary of a match (docs/design/partida.md, "Estatísticas e notas", "Marcadores do
 * resultado" and "Cartões e suspensão"): player ratings, best on the pitch, result markers and
 * what the cards mean for the next games.
 */

/** A goal as the markers read it. */
export interface GoalRecord {
  readonly side: Side;
  readonly scorer: PlayerId;
  readonly minute: number;
  readonly added?: number;
}

const other = (side: Side): Side => (side === 'home' ? 'away' : 'home');

/** The winning side, or undefined on a draw. */
export function winnerOf(score: readonly [number, number]): Side | undefined {
  if (score[0] === score[1]) return undefined;
  return score[0] > score[1] ? 'home' : 'away';
}

/**
 * Rating of a player (partida.md, "Nota do jogador"): `6.0 + 1.0 × goals + 0.6 × assists
 * + 0.3 × saves − 0.25 × conceded − 0.5 × yellows − 1.5 × reds ± 0.4 (win/loss) + noise`, with the
 * noise uniform in [−0.5, 0.5), rounded to one decimal and clipped to 3.0..10.0. One draw.
 */
function rating(app: Appearance, result: 'win' | 'draw' | 'loss', rng: Rng): number {
  const raw =
    RATING.base +
    RATING.goal * app.goals +
    RATING.assist * app.assists +
    RATING.save * app.saves +
    RATING.conceded * app.conceded +
    RATING.yellow * app.yellows +
    RATING.red * app.reds +
    (result === 'win' ? RATING.win : result === 'loss' ? RATING.loss : 0) +
    (rng.next() * 2 - 1) * RATING.noise;
  return clamp(Math.round(raw * 10) / 10, RATING.min, RATING.max);
}

/**
 * Ratings of everyone who took the pitch, home first, each side in order of entry; one noise
 * draw per player with at least {@link RATING.minMinutes} regulation minutes, and `null`
 * ("sem nota") without a draw for the others.
 */
export function playerRatings(
  teams: readonly [TeamState, TeamState],
  score: readonly [number, number],
  rng: Rng,
): Map<Appearance, number | null> {
  const winner = winnerOf(score);
  const ratings = new Map<Appearance, number | null>();
  for (const team of teams) {
    const result = winner === undefined ? 'draw' : winner === team.side ? 'win' : 'loss';
    for (const app of team.appearances) {
      ratings.set(app, app.minutes < RATING.minMinutes ? null : rating(app, result, rng));
    }
  }
  return ratings;
}

/**
 * Best on the pitch: the highest rating; ties by more goals, then the winning side, then the
 * lower shirt number, then the home side (the first in the iteration order of `ratings`).
 */
export function bestOnPitch(
  ratings: ReadonlyMap<Appearance, number | null>,
  winner: Side | undefined,
): Appearance | undefined {
  let best: { app: Appearance; value: number } | undefined;
  for (const [app, value] of ratings) {
    if (value === null) continue;
    if (best === undefined) {
      best = { app, value };
      continue;
    }
    const b = best.app;
    const better =
      value > best.value ||
      (value === best.value &&
        (app.goals > b.goals ||
          (app.goals === b.goals &&
            ((app.side === winner && b.side !== winner) ||
              ((app.side === winner) === (b.side === winner) &&
                app.player.shirt < b.player.shirt)))));
    if (better) best = { app, value };
  }
  return best?.app;
}

/** What the markers need besides the teams. */
export interface MarkerContext {
  readonly score: readonly [number, number];
  readonly goals: readonly GoalRecord[];
  readonly derby: boolean;
  readonly neutral: boolean;
  /** Displayed strength of each kick-off XI (mean `overall × fit`). */
  readonly strength: Readonly<Record<Side, number>>;
}

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/**
 * Result markers (partida.md, "Marcadores do resultado"), in the order of that table:
 * - `goleada`: winning margin of 3 or more;
 * - `virada`: the winner was behind at some point;
 * - `zebra`: the winner's displayed strength + home (4 points for the home side, none on neutral
 *   ground) was at least 8 points below the loser's;
 * - `golNoFim`: the last goal that changed the result (win, draw or loss) came at minute 85 or
 *   later, added time included; it names that goal;
 * - `hatTrick`: each player with 3 goals or more;
 * - `semSofrerGols`: each side that conceded nothing;
 * - `classico`: the clubs are rivals;
 * - `estreia`: each player in his first match for the club.
 */
export function resultMarkers(
  teams: readonly [TeamState, TeamState],
  context: MarkerContext,
): MatchMarker[] {
  const markers: MatchMarker[] = [];
  const { score, goals } = context;
  const winner = winnerOf(score);

  if (winner !== undefined && Math.abs(score[0] - score[1]) >= MARKERS.thrashingMargin) {
    markers.push({ kind: 'goleada', side: winner });
  }

  if (winner !== undefined) {
    let diff = 0; // home − away
    let behind = false;
    for (const goal of goals) {
      diff += goal.side === 'home' ? 1 : -1;
      if ((winner === 'home' ? diff : -diff) < 0) behind = true;
    }
    if (behind) markers.push({ kind: 'virada', side: winner });

    const homePoints = (side: Side) =>
      side === 'home' && !context.neutral ? MARKERS.homePoints : 0;
    const loser = other(winner);
    const winnerValue = context.strength[winner] + homePoints(winner);
    const loserValue = context.strength[loser] + homePoints(loser);
    if (winnerValue <= loserValue - MARKERS.upsetGap) markers.push({ kind: 'zebra', side: winner });
  }

  let decisive: GoalRecord | undefined;
  let diff = 0;
  for (const goal of goals) {
    const before = sign(diff);
    diff += goal.side === 'home' ? 1 : -1;
    if (sign(diff) !== before) decisive = goal;
  }
  if (decisive !== undefined && decisive.minute >= MARKERS.lateGoalMinute) {
    markers.push({
      kind: 'golNoFim',
      side: decisive.side,
      player: decisive.scorer,
      minute: decisive.minute,
      ...(decisive.added === undefined ? {} : { added: decisive.added }),
    });
  }

  for (const team of teams) {
    for (const app of team.appearances) {
      if (app.goals >= MARKERS.hatTrickGoals) {
        markers.push({
          kind: 'hatTrick',
          side: team.side,
          player: app.player.id,
          goals: app.goals,
        });
      }
    }
  }
  for (const team of teams) {
    const conceded = team.side === 'home' ? score[1] : score[0];
    if (conceded === 0) markers.push({ kind: 'semSofrerGols', side: team.side });
  }
  if (context.derby) markers.push({ kind: 'classico' });
  for (const team of teams) {
    for (const app of team.appearances) {
      if (app.player.clubAppearances === 0) {
        markers.push({ kind: 'estreia', side: team.side, player: app.player.id });
      }
    }
  }
  return markers;
}

/** What the cards of a match mean for the club's next games (MatchResult). */
export interface CardConsequences {
  readonly newSuspensions: { readonly player: PlayerId; readonly games: number }[];
  readonly yellowCounts: Record<PlayerId, number>;
}

/**
 * Suspensions and accumulated yellows after the match (partida.md, "Cartões e suspensão"; 1a):
 * - a yellow counts toward the accumulation unless the player was sent off with a second yellow
 *   (the two yellows of that red never count);
 * - reaching 3 accumulated yellows suspends for 1 game and resets the counter to 0;
 * - a red (direct or second yellow) suspends for 1 game;
 * - a player who reaches 3 yellows and is also sent off with a direct red gets both games.
 * Every player who took the pitch gets his counter, home first, in order of entry.
 */
export function cardConsequences(teams: readonly [TeamState, TeamState]): CardConsequences {
  const newSuspensions: { player: PlayerId; games: number }[] = [];
  const yellowCounts: Record<PlayerId, number> = {};
  for (const team of teams) {
    for (const app of team.appearances) {
      const counts = app.yellows > 0 && app.redReason !== 'secondYellow' ? 1 : 0;
      let yellowCount = app.yellowCount + counts;
      let games = 0;
      if (yellowCount >= SUSPENSION.yellowLimit) {
        games += SUSPENSION.yellowGames;
        yellowCount = 0;
      }
      if (app.reds > 0) games += SUSPENSION.redGames;
      yellowCounts[app.player.id] = yellowCount;
      if (games > 0) newSuspensions.push({ player: app.player.id, games });
    }
  }
  return { newSuspensions, yellowCounts };
}
