import {
  bestEleven,
  generateSquad,
  seedFromString,
  simulateMatch,
} from '../../app/src/engine/index.ts';
import type {
  Formation,
  GameParams,
  MatchCommand,
  MatchEvent,
  MatchInput,
  MatchResult,
  Player,
  Posture,
  Pressure,
  Side,
  TeamInput,
} from '../../app/src/engine/index.ts';
import { balanceIdentitySource } from './identity.ts';

/*
 * The duels of the /balance (balance-targets.md, "Como o /balance mede"), all on neutral ground
 * with an empty bench and thermometer 55:
 * - calibrated: two squads generated with exact strength (`clubStrengthSd = 0`) at 0, 10, 20 and
 *   30 points of difference (70×70, 75×65, 80×60, 85×55), both in 4-4-2, balanced, medium, played
 *   by the AI as "Tradicional" (the method of app/src/data/match-metrics.test.ts, which the
 *   game-designer used for the earlier measurements);
 * - tactical: equal squads (strength 70), one adjustment changed (formation, posture or pressure)
 *   against the reference 4-4-2, balanced, medium. Both sides with `controller: 'human'` and no
 *   commands, so the tactic under test stays the same for the 90 minutes (the AI's in-match rules
 *   would change the posture by the score). A formation variant gets a squad generated for that
 *   formation, as every club's squad is generated for its preferred one. "Tudo no ataque desde o
 *   minuto 60" is two of them: `allOut` is only reachable through a command, and only from
 *   `match.allOutFromMinute` (partida.md, "Táticas"; T-016), so the variant starts as the
 *   reference and goes all out at the first minute the rule allows, until the end, whatever the
 *   score: the longest use a coach can make of it (the posture must not become a dominant
 *   tactic). One sends the shortcut (with high pressure), the other the posture with medium
 *   pressure;
 * - "tudo no ataque": equal squads (70, 4-4-2, balanced, medium, both `human`), each sample a
 *   match that is 0×1 after minute 75 (the next seed is tried until one is); the trailing side's
 *   P(not losing) when it keeps balanced against the same match with "todo mundo no ataque" from
 *   minute 76 (a command of minute 75: the first 75 minutes are the same);
 * - reference: the reference against itself, as a tactical duel, for the points per game of the
 *   tactical duels (balance-log.md, "Robô ofensivo"; a reference that never fails the run).
 *
 * A pair of squads plays DUEL_PAIR_MATCHES matches, the listed home side alternating (on neutral
 * ground it only changes the draw order). Every sample `n` has its own seeds, so a duel split into
 * chunks gives the same totals as in one piece.
 */

export const DUEL_PAIR_MATCHES = 50;
export const DUEL_FANS = 55;
/** Strength of the equal squads of the tactical and "tudo no ataque" duels. */
export const TACTICAL_STRENGTH = 70;
/** The calibrated gaps and their strengths. */
export const CALIBRATED_GAPS = [0, 10, 20, 30] as const;
export type CalibratedGap = (typeof CALIBRATED_GAPS)[number];
const GAP_STRENGTHS: { readonly [G in CalibratedGap]: readonly [number, number] } = {
  0: [70, 70],
  10: [75, 65],
  20: [80, 60],
  30: [85, 55],
};
/** The minute after which the "tudo no ataque" duel looks at the score. */
export const ALL_OUT_MINUTE = 75;
/** Seeds tried for one "tudo no ataque" sample before giving up (never reached in practice). */
const ALL_OUT_MAX_TRIES = 10_000;

/** One adjustment of the tactical duels against the reference 4-4-2, balanced, medium. */
export interface TacticVariant {
  readonly id: string;
  readonly formation: Formation;
  readonly posture: Exclude<Posture, 'allOut'>;
  readonly pressure: Pressure;
  /**
   * "Tudo no ataque" sent at {@link allOutCommandMinute}, so it holds from
   * `match.allOutFromMinute` to the end: the shortcut (`allOut` with high pressure) or the
   * posture alone (`tactic` with `posture: 'allOut'` and the variant's pressure).
   */
  readonly allOut?: 'preset' | 'posture';
  /** A reference row: shown with its target, never in the exit code. */
  readonly info?: true;
}

/**
 * Minute of the "tudo no ataque" command of a variant: the last minute played before
 * `match.allOutFromMinute`, so the posture holds from that minute (60 → a command of minute 59,
 * the screen at 60'; partida.md, "Quando um comando vale").
 */
export function allOutCommandMinute(params: GameParams): number {
  return Math.max(0, params.match.allOutFromMinute - 1);
}

const REFERENCE = { formation: '4-4-2', posture: 'balanced', pressure: 'medium' } as const;

/** The reference against itself: the base of the points per game of the tactical duels. */
export const REFERENCE_VARIANT: TacticVariant = { ...REFERENCE, id: 'reference' };

/**
 * Every adjustment of the 1a against the reference. "allOut" is only a command: it has its own
 * duel from 0×1 at 75' (below), and the `allout-60` variants play it from minute 60 to the end.
 */
export const TACTIC_VARIANTS: readonly TacticVariant[] = [
  ...(['4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2'] as const).map((formation) => ({
    ...REFERENCE,
    id: formation,
    formation,
  })),
  ...(['defensive', 'attacking'] as const).map((posture) => ({
    ...REFERENCE,
    id: posture,
    posture,
  })),
  ...(['low', 'high'] as const).map((pressure) => ({
    ...REFERENCE,
    id: `pressure-${pressure}`,
    pressure,
  })),
  { ...REFERENCE, id: 'allout-60', allOut: 'preset' },
  { ...REFERENCE, id: 'allout-60-medium', allOut: 'posture' },
  // Informative (review of T-016): the posture with low pressure, the one that tires least.
  { ...REFERENCE, id: 'allout-60-low', pressure: 'low', allOut: 'posture', info: true },
];

/** Wins, draws and defeats of the first side of a duel (the stronger, or the variant). */
export interface DuelTally {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
}

export interface AllOutTally {
  samples: number;
  tries: number;
  /** The trailing side did not lose, keeping balanced / with "todo mundo no ataque". */
  keptNotLost: number;
  allOutNotLost: number;
}

export type DuelJob =
  | {
      readonly kind: 'calibrated';
      readonly gap: CalibratedGap;
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly kind: 'tactical';
      readonly variant: string;
      readonly from: number;
      readonly to: number;
    }
  | { readonly kind: 'allOut'; readonly from: number; readonly to: number };

export const emptyDuelTally = (): DuelTally => ({
  matches: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goals: 0,
});
export const emptyAllOutTally = (): AllOutTally => ({
  samples: 0,
  tries: 0,
  keptNotLost: 0,
  allOutNotLost: 0,
});

/** A synthetic squad of exact strength for a duel. */
function duelSquad(
  params: GameParams,
  clubId: string,
  label: string,
  strength: number,
  formation: Formation,
): Player[] {
  const exact: GameParams = { ...params, generation: { ...params.generation, clubStrengthSd: 0 } };
  return generateSquad(
    { clubId, seed: seedFromString(label), strength, formation },
    exact,
    balanceIdentitySource(),
  ).players;
}

function duelTeam(
  clubId: string,
  squad: readonly Player[],
  tactic: { formation: Formation; posture: Exclude<Posture, 'allOut'>; pressure: Pressure },
  controller: TeamInput['controller'],
): TeamInput {
  return {
    clubId,
    controller,
    profile: 'traditional',
    fans: DUEL_FANS,
    players: squad,
    sheet: {
      lineup: {
        formation: tactic.formation,
        starters: bestEleven(squad, tactic.formation).map(({ player }) => player.id),
        bench: [],
        captains: [],
        penaltyTakers: [],
        freeKickTakers: [],
      },
      tactic: { posture: tactic.posture, pressure: tactic.pressure },
    },
  };
}

function neutralMatch(
  fixtureId: string,
  seed: number,
  home: TeamInput,
  away: TeamInput,
): MatchInput {
  return { fixtureId, seed, home, away, derby: false, neutral: true, rules: { realism: 'full' } };
}

/** Adds the result of `first` (home when `firstHome`) to the tally. */
function addDuel(t: DuelTally, result: MatchResult, firstHome: boolean): void {
  const [h, a] = result.score;
  const own = firstHome ? h : a;
  const other = firstHome ? a : h;
  t.matches += 1;
  t.goals += h + a;
  if (own > other) t.wins += 1;
  else if (own === other) t.draws += 1;
  else t.losses += 1;
}

/** Pair cache of one job: the squads of a pair are generated once. */
function pairs<T>(make: (pair: number) => T): (n: number) => T {
  const cache = new Map<number, T>();
  return (n) => {
    const pair = Math.floor(n / DUEL_PAIR_MATCHES);
    let value = cache.get(pair);
    if (value === undefined) {
      value = make(pair);
      cache.set(pair, value);
    }
    return value;
  };
}

/** The match of sample `n` of a calibrated or tactical duel, and the side of its first team. */
export interface DuelSample {
  readonly input: MatchInput;
  /** The side of the first team of the tally: the stronger, or the variant. */
  readonly first: Side;
  /** The commands of the match: the variant's "tudo no ataque" from minute 60, if any. */
  readonly commands: readonly MatchCommand[];
}

/**
 * Sample `n` of the calibrated duel `gap`: the stronger squad (`duel-a`) is the first team, home
 * on even samples and away on odd ones.
 */
export function calibratedSamples(
  params: GameParams,
  seed: number,
  gap: CalibratedGap,
): (n: number) => DuelSample {
  const [strong, weak] = GAP_STRENGTHS[gap];
  const reference = { ...REFERENCE } as const;
  const teams = pairs((pair) => {
    const label = `balance-${seed}-duel-${gap}-${pair}`;
    return [
      duelTeam('duel-a', duelSquad(params, 'duel-a', label, strong, '4-4-2'), reference, 'ai'),
      duelTeam('duel-b', duelSquad(params, 'duel-b', label, weak, '4-4-2'), reference, 'ai'),
    ] as const;
  });
  return (n) => {
    const [a, b] = teams(n);
    const firstHome = n % 2 === 0;
    const input = neutralMatch(
      `duel-${gap}-${n}`,
      seedFromString(`balance-${seed}-duel-${gap}-${n}`),
      firstHome ? a : b,
      firstHome ? b : a,
    );
    return { input, first: firstHome ? 'home' : 'away', commands: [] };
  };
}

/** The "tudo no ataque" command of `variant` for its side, if it has one. */
function allOutCommands(params: GameParams, variant: TacticVariant, side: Side): MatchCommand[] {
  const minute = allOutCommandMinute(params);
  switch (variant.allOut) {
    case 'preset':
      return [{ minute, side, kind: 'preset', preset: 'allOut' }];
    case 'posture':
      return [{ minute, side, kind: 'tactic', posture: 'allOut', pressure: variant.pressure }];
    default:
      return [];
  }
}

/**
 * Sample `n` of the tactical duel of `variant`: the variant (`duel-var`) is the first team, home on
 * even samples and away on odd ones, against the reference (`duel-ref`).
 */
export function tacticalSamples(
  params: GameParams,
  seed: number,
  variant: TacticVariant,
): (n: number) => DuelSample {
  const teams = pairs((pair) => {
    const label = `balance-${seed}-tactic-${pair}`;
    return [
      duelTeam(
        'duel-var',
        duelSquad(params, 'duel-var', label, TACTICAL_STRENGTH, variant.formation),
        variant,
        'human',
      ),
      duelTeam(
        'duel-ref',
        duelSquad(params, 'duel-ref', label, TACTICAL_STRENGTH, REFERENCE.formation),
        REFERENCE,
        'human',
      ),
    ] as const;
  });
  return (n) => {
    const [v, r] = teams(n);
    const firstHome = n % 2 === 0;
    const input = neutralMatch(
      `tactic-${variant.id}-${n}`,
      seedFromString(`balance-${seed}-tactic-${variant.id}-${n}`),
      firstHome ? v : r,
      firstHome ? r : v,
    );
    const first: Side = firstHome ? 'home' : 'away';
    return { input, first, commands: allOutCommands(params, variant, first) };
  };
}

/**
 * A duel match whose command the engine ignored (`command-too-early`, or any other `command-*`
 * warning) measures the match without it, so its target would read "fora" for no reason: that is
 * an error of the tool (exit code 3), e.g. a `match.allOutFromMinute` override later than the
 * minute the duel sends "tudo no ataque" at.
 */
export function playDuelMatch(
  input: MatchInput,
  params: GameParams,
  commands: readonly MatchCommand[],
): MatchResult {
  const result = simulateMatch(input, params, commands);
  const ignored = result.warnings.filter((w) => w.code.startsWith('command-'));
  if (ignored.length > 0) {
    const codes = [...new Set(ignored.map((w) => w.code))].join(', ');
    throw new Error(
      `duel ${input.fixtureId}: the engine ignored a command (${codes}); ` +
        `match.allOutFromMinute is ${params.match.allOutFromMinute}`,
    );
  }
  return result;
}

function tallySamples(
  params: GameParams,
  sample: (n: number) => DuelSample,
  from: number,
  to: number,
): DuelTally {
  const tally = emptyDuelTally();
  for (let n = from; n < to; n++) {
    const { input, first, commands } = sample(n);
    addDuel(tally, playDuelMatch(input, params, commands), first === 'home');
  }
  return tally;
}

/** Samples `from` (inclusive) to `to` (exclusive) of a calibrated duel. */
export function calibratedDuel(
  params: GameParams,
  seed: number,
  gap: CalibratedGap,
  from: number,
  to: number,
): DuelTally {
  return tallySamples(params, calibratedSamples(params, seed, gap), from, to);
}

/** Samples `from` to `to` of a tactical duel: the variant is the first side of the tally. */
export function tacticalDuel(
  params: GameParams,
  seed: number,
  variant: TacticVariant,
  from: number,
  to: number,
): DuelTally {
  return tallySamples(params, tacticalSamples(params, seed, variant), from, to);
}

/** Goals of each side up to the end of regulation minute `minute` of the second half. */
export function scoreAfter(events: readonly MatchEvent[], minute: number): [number, number] {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (e.half === 2 && (e.minute > minute || (e.minute === minute && e.added !== undefined)))
      break;
    if (e.type === 'goal') {
      if (e.side === 'home') home += 1;
      else away += 1;
    }
  }
  return [home, away];
}

/** Whether a match ended (abandoned) by the end of regulation minute `minute`. */
function endedBy(events: readonly MatchEvent[], minute: number): boolean {
  return events.some(
    (e) => e.type === 'fulltime' && (e.half === 1 || e.minute <= minute) && e.added === undefined,
  );
}

const notLost = (result: MatchResult, side: Side) =>
  side === 'home' ? result.score[0] >= result.score[1] : result.score[1] >= result.score[0];

/** One sample of the "tudo no ataque" duel: the match kept balanced and the one gone all out. */
export interface AllOutSample {
  readonly n: number;
  /** Seeds tried for this sample (the last one is the sample's, when there is one). */
  readonly tries: number;
  readonly match?: {
    readonly input: MatchInput;
    /** The side 0×1 down after minute ALL_OUT_MINUTE. */
    readonly trailing: Side;
    readonly kept: MatchResult;
    readonly allOut: MatchResult;
  };
}

/**
 * Samples `from` to `to` of the "tudo no ataque" duel (see the header): for each `n`, the seeds
 * `balance-<seed>-allout-<n>-<t>` are tried in order until a match is 0×1 or 1×0 after minute
 * ALL_OUT_MINUTE (and was not abandoned by then); that match is played again with the trailing
 * side's "todo mundo no ataque" command of minute ALL_OUT_MINUTE.
 */
export function* allOutSamples(
  params: GameParams,
  seed: number,
  from: number,
  to: number,
): Generator<AllOutSample> {
  const teams = pairs((pair) => {
    const label = `balance-${seed}-allout-${pair}`;
    return [
      duelTeam(
        'duel-a',
        duelSquad(params, 'duel-a', label, TACTICAL_STRENGTH, '4-4-2'),
        REFERENCE,
        'human',
      ),
      duelTeam(
        'duel-b',
        duelSquad(params, 'duel-b', label, TACTICAL_STRENGTH, '4-4-2'),
        REFERENCE,
        'human',
      ),
    ] as const;
  });
  for (let n = from; n < to; n++) {
    const [a, b] = teams(n);
    const firstHome = n % 2 === 0;
    let found: AllOutSample['match'];
    let tries = 0;
    while (found === undefined && tries < ALL_OUT_MAX_TRIES) {
      const t = tries++;
      const input = neutralMatch(
        `allout-${n}-${t}`,
        seedFromString(`balance-${seed}-allout-${n}-${t}`),
        firstHome ? a : b,
        firstHome ? b : a,
      );
      const kept = simulateMatch(input, params);
      if (endedBy(kept.events, ALL_OUT_MINUTE)) continue;
      const [h, aw] = scoreAfter(kept.events, ALL_OUT_MINUTE);
      if (!((h === 0 && aw === 1) || (h === 1 && aw === 0))) continue;
      const trailing: Side = h === 0 ? 'home' : 'away';
      const allOut = playDuelMatch(input, params, [
        { minute: ALL_OUT_MINUTE, side: trailing, kind: 'preset', preset: 'allOut' },
      ]);
      found = { input, trailing, kept, allOut };
    }
    yield found === undefined ? { n, tries } : { n, tries, match: found };
  }
}

/** Samples `from` to `to` of the "tudo no ataque" duel, as a tally. */
export function allOutDuel(
  params: GameParams,
  seed: number,
  from: number,
  to: number,
): AllOutTally {
  const tally = emptyAllOutTally();
  for (const sample of allOutSamples(params, seed, from, to)) {
    tally.tries += sample.tries;
    if (sample.match === undefined) continue;
    const { trailing, kept, allOut } = sample.match;
    tally.samples += 1;
    if (notLost(kept, trailing)) tally.keptNotLost += 1;
    if (notLost(allOut, trailing)) tally.allOutNotLost += 1;
  }
  return tally;
}

export type DuelResult = DuelTally | AllOutTally;

/** Runs one duel job. */
export function runDuelJob(params: GameParams, seed: number, job: DuelJob): DuelResult {
  if (job.kind === 'calibrated') return calibratedDuel(params, seed, job.gap, job.from, job.to);
  if (job.kind === 'allOut') return allOutDuel(params, seed, job.from, job.to);
  const variant = [...TACTIC_VARIANTS, REFERENCE_VARIANT].find((v) => v.id === job.variant);
  if (variant === undefined) throw new Error(`unknown tactic variant ${job.variant}`);
  return tacticalDuel(params, seed, variant, job.from, job.to);
}
