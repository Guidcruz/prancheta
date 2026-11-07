import type { Fixture } from './fixtures.ts';
import { clamp } from './math.ts';
import type { FansParams } from './params.ts';
import type { Player } from './players.ts';
import { POINTS, RELEGATION_SPOTS } from './standings.ts';
import type { ClubId, Side } from './types.ts';

/*
 * The fans thermometer (docs/design/torcida.md, "Fórmula"; US-026; T-014). Every club has one,
 * 0..100 (`ClubState.fans`); it moves once per round, after the players' morale:
 *
 *   Δ = result + extras + decisions − reversion
 *   result   = fans.resultWeight × (points won − points expected) × (derby ? fans.derbyResultMult : 1)
 *   expected = clamp(1.40 + 0.04 × d, 0.3, 2.5), d = own strength − opponent's strength ± 4 (venue)
 *   extras   = +2 win by 3 or more / −2 defeat by 3 or more;
 *              −1 from the 4th game in a row without winning;
 *              +0.5 among the first 4 / −1 in the last 4 (Z4), from round 6 on
 *   decisions = clamp(the coach's decisions of the round, ±fans.decisionCap) + the idol left on
 *              the bench (−1 or 0, after the cap): −5 to +4. Only a human club decides (round.ts)
 *   reversion = fans.reversion × (thermometer − fans.baseline)
 *   thermometer = clamp(thermometer + Δ, 0, 100)
 *
 * The strength is the club's effective target strength of the career (`ClubState.strength`), the
 * number of the new-game screen (temporada.md, "Força e dificuldade"). An abandoned match counts
 * with its awarded score (torcida.md, "Casos de borda"). The extras, the expected points and the
 * idol rule are rule constants (torcida.md, "Constantes"); the weights are `fans.*`.
 *
 * Pure: no Rng, nothing changed in the inputs, never throws.
 */

/** `pontos esperados = clamp(1.40 + 0.04 × d, 0.3, 2.5)`, with ±4 of venue in `d`. */
export const EXPECTED_POINTS = {
  base: 1.4,
  perPoint: 0.04,
  /** Points of strength the venue is worth in `d`: + at home, − away. */
  venue: 4,
  min: 0.3,
  max: 2.5,
} as const;

/** The extras of the formula (torcida.md, "Constantes": rules, not /balance knobs). */
export const FANS_EXTRAS = {
  /** A win (defeat) by this many goals or more is a "goleada". */
  bigMargin: 3,
  bigWin: 2,
  bigLoss: -2,
  /** From this many games in a row without winning (this one included), every round. */
  winlessFrom: 4,
  winless: -1,
  /** The table extras count from this round on. */
  tableFromRound: 6,
  topPlaces: 4,
  top: 0.5,
  relegation: -1,
} as const;

/**
 * The idol left on the bench (jogadores.md, "Ídolo no banco"; torcida.md, "Decisões do técnico"):
 * from the 2nd round in a row, −1 per round, added after the cap of the coach's decisions. Only
 * for a human club (round.ts).
 */
export const IDOL_BENCH = { fromStreak: 2, fans: -1 } as const;

/** Where the club plays: home, away or neutral ground (no venue in `d`). */
export type FansVenue = 'home' | 'away' | 'neutral';

/** The venue of a club in a match for the expected points: neutral ground has none. */
export function fansVenue(match: { readonly neutral: boolean }, side: Side): FansVenue {
  return match.neutral ? 'neutral' : side;
}

/** Points the fans expect from a match: `clamp(1.40 + 0.04 × d, 0.3, 2.5)`. */
export function expectedPoints(own: number, opponent: number, venue: FansVenue): number {
  const edge =
    venue === 'home' ? EXPECTED_POINTS.venue : venue === 'away' ? -EXPECTED_POINTS.venue : 0;
  const d = own - opponent + edge;
  return clamp(
    EXPECTED_POINTS.base + EXPECTED_POINTS.perPoint * d,
    EXPECTED_POINTS.min,
    EXPECTED_POINTS.max,
  );
}

/** What the thermometer of one club reads in one round. */
export interface FansRoundInput {
  /** The thermometer before the round. */
  readonly fans: number;
  /** The club's goals and the opponent's (the awarded score of an abandoned match). */
  readonly scored: number;
  readonly conceded: number;
  /** {@link expectedPoints} of the match. */
  readonly expected: number;
  readonly derby: boolean;
  /** Games in a row without winning, this one included (0 after a win). */
  readonly winlessRun: number;
  /** Position in the table after the round (1 = top); absent = no table extra. */
  readonly position?: number | undefined;
  /** Rows of the table (20 in the Série A). */
  readonly clubs: number;
  /** The round just played (1..38). */
  readonly round: number;
  /** Sum of the coach's decisions of the round, before the cap of ±fans.decisionCap. */
  readonly decisions: number;
  /** The idol left on the bench: {@link IDOL_BENCH}.fans or 0, added after the cap. */
  readonly idol: number;
}

/** The parts of the round's Δ, for the tests and the screen's explanations. */
export interface FansDelta {
  readonly result: number;
  readonly extras: number;
  /** `clamp(decisions, ±fans.decisionCap) + idol`: −5 to +4 with the values of torcida.md. */
  readonly decisions: number;
  readonly reversion: number;
  /** `result + extras + decisions − reversion`. */
  readonly delta: number;
  /** The thermometer after the round, 0..100. */
  readonly fans: number;
}

const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);

/**
 * The thermometer's move in a round (torcida.md, "Fórmula"). A thermometer outside 0..100 (or
 * NaN) is read clipped (NaN as 0), and non-finite numbers elsewhere count as 0, so the result is
 * always within 0..100.
 */
export function fansDelta(input: FansRoundInput, params: FansParams): FansDelta {
  const fans = clamp(input.fans, 0, 100);
  const scored = finite(input.scored);
  const conceded = finite(input.conceded);
  const points = scored > conceded ? POINTS.win : scored === conceded ? POINTS.draw : POINTS.loss;
  const result =
    params.resultWeight *
    (points - finite(input.expected)) *
    (input.derby ? params.derbyResultMult : 1);

  let extras = 0;
  const margin = scored - conceded;
  if (margin >= FANS_EXTRAS.bigMargin) extras += FANS_EXTRAS.bigWin;
  if (-margin >= FANS_EXTRAS.bigMargin) extras += FANS_EXTRAS.bigLoss;
  if (input.winlessRun >= FANS_EXTRAS.winlessFrom) extras += FANS_EXTRAS.winless;
  if (input.position !== undefined && input.round >= FANS_EXTRAS.tableFromRound) {
    if (input.position <= FANS_EXTRAS.topPlaces) extras += FANS_EXTRAS.top;
    if (input.position > input.clubs - RELEGATION_SPOTS) extras += FANS_EXTRAS.relegation;
  }

  const cap = params.decisionCap;
  const decisions = clamp(finite(input.decisions), -cap, cap) + finite(input.idol);
  const reversion = params.reversion * (fans - params.baseline);
  const delta = result + extras + decisions - reversion;
  return { result, extras, decisions, reversion, delta, fans: clamp(fans + delta, 0, 100) };
}

/**
 * Games in a row without winning of every club after `round`, the games of `round` included, by
 * the table's score (an abandoned match counts with the awarded one). Clubs without a played
 * game have no entry (0).
 */
export function winlessRuns(fixtures: readonly Fixture[], round: number): Map<ClubId, number> {
  const out = new Map<ClubId, number>();
  const played = fixtures
    .filter((f) => f.result !== undefined && f.round <= round)
    .sort((a, b) => a.round - b.round);
  for (const f of played) {
    const [home, away] = f.result!.score;
    out.set(f.homeId, home > away ? 0 : (out.get(f.homeId) ?? 0) + 1);
    out.set(f.awayId, away > home ? 0 : (out.get(f.awayId) ?? 0) + 1);
  }
  return out;
}

/** The club's idol (`trait: 'idol'`), the first in squad order; undefined when it has none. */
export function clubIdol(
  squad: readonly string[],
  players: Readonly<Record<string, Player>>,
): Player | undefined {
  for (const id of squad) {
    const player = players[id];
    if (player?.trait === 'idol') return player;
  }
  return undefined;
}

/**
 * The five fan moods (torcida.md, "Humor da rede social"), from the coldest to the hottest. The
 * labels live in `app/src/content/<idioma>/fans.json` (`fans.mood.<mood>`), never here.
 */
export const FAN_MOODS = ['revolt', 'irritated', 'wary', 'excited', 'party'] as const;

/** One of {@link FAN_MOODS}. */
export type FanMood = (typeof FAN_MOODS)[number];

/**
 * Floor of each mood on the rounded thermometer, in the order of {@link FAN_MOODS}: 0–19, 20–39,
 * 40–59, 60–79, 80–100. A rule constant of torcida.md, not a /balance knob (4.1, "Leituras para a
 * interface (T-028)").
 */
const FAN_MOOD_FLOORS: readonly number[] = [0, 20, 40, 60, 80];

/**
 * The mood of a thermometer: the band of `Math.round(clamp(fans, 0, 100))`, the number the club
 * screen shows, so the number and the label never disagree (19.6 shows as 20, `irritated`). A
 * non-finite value reads as 0 (`revolt`), as in {@link fansDelta}. Pure, never throws.
 */
export function fanMood(fans: number): FanMood {
  const shown = Number.isFinite(fans) ? Math.round(clamp(fans, 0, 100)) : 0;
  let index = 0;
  for (let i = 1; i < FAN_MOOD_FLOORS.length; i++) if (shown >= FAN_MOOD_FLOORS[i]!) index = i;
  return FAN_MOODS[index]!;
}
