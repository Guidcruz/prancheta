import {
  bestEleven,
  generateSquad,
  seedFromString,
  simulateMatch,
} from '../../app/src/engine/index.ts';
import type {
  Formation,
  GameParams,
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
 *   formation, as every club's squad is generated for its preferred one;
 * - "tudo no ataque": equal squads (70, 4-4-2, balanced, medium, both `human`), each sample a
 *   match that is 0×1 after minute 75 (the next seed is tried until one is); the trailing side's
 *   P(not losing) when it keeps balanced against the same match with "todo mundo no ataque" from
 *   minute 76 (a command of minute 75: the first 75 minutes are the same).
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
}

const REFERENCE = { formation: '4-4-2', posture: 'balanced', pressure: 'medium' } as const;

/** Every adjustment of the 1a against the reference ("allOut" is only a command: own duel). */
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

/** Samples `from` (inclusive) to `to` (exclusive) of a calibrated duel. */
export function calibratedDuel(
  params: GameParams,
  seed: number,
  gap: CalibratedGap,
  from: number,
  to: number,
): DuelTally {
  const [strong, weak] = GAP_STRENGTHS[gap];
  const reference = { ...REFERENCE } as const;
  const teams = pairs((pair) => {
    const label = `balance-${seed}-duel-${gap}-${pair}`;
    return [
      duelTeam('duel-a', duelSquad(params, 'duel-a', label, strong, '4-4-2'), reference, 'ai'),
      duelTeam('duel-b', duelSquad(params, 'duel-b', label, weak, '4-4-2'), reference, 'ai'),
    ] as const;
  });
  const tally = emptyDuelTally();
  for (let n = from; n < to; n++) {
    const [a, b] = teams(n);
    const firstHome = n % 2 === 0;
    const input = neutralMatch(
      `duel-${gap}-${n}`,
      seedFromString(`balance-${seed}-duel-${gap}-${n}`),
      firstHome ? a : b,
      firstHome ? b : a,
    );
    addDuel(tally, simulateMatch(input, params), firstHome);
  }
  return tally;
}

/** Samples `from` to `to` of a tactical duel: the variant is the first side of the tally. */
export function tacticalDuel(
  params: GameParams,
  seed: number,
  variant: TacticVariant,
  from: number,
  to: number,
): DuelTally {
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
  const tally = emptyDuelTally();
  for (let n = from; n < to; n++) {
    const [v, r] = teams(n);
    const firstHome = n % 2 === 0;
    const input = neutralMatch(
      `tactic-${variant.id}-${n}`,
      seedFromString(`balance-${seed}-tactic-${variant.id}-${n}`),
      firstHome ? v : r,
      firstHome ? r : v,
    );
    addDuel(tally, simulateMatch(input, params), firstHome);
  }
  return tally;
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

/** Samples `from` to `to` of the "tudo no ataque" duel (see the header). */
export function allOutDuel(
  params: GameParams,
  seed: number,
  from: number,
  to: number,
): AllOutTally {
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
  const tally = emptyAllOutTally();
  for (let n = from; n < to; n++) {
    const [a, b] = teams(n);
    const firstHome = n % 2 === 0;
    for (let t = 0; t < ALL_OUT_MAX_TRIES; t++) {
      tally.tries += 1;
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
      const allOut = simulateMatch(input, params, [
        { minute: ALL_OUT_MINUTE, side: trailing, kind: 'preset', preset: 'allOut' },
      ]);
      tally.samples += 1;
      if (notLost(kept, trailing)) tally.keptNotLost += 1;
      if (notLost(allOut, trailing)) tally.allOutNotLost += 1;
      break;
    }
  }
  return tally;
}

export type DuelResult = DuelTally | AllOutTally;

/** Runs one duel job. */
export function runDuelJob(params: GameParams, seed: number, job: DuelJob): DuelResult {
  if (job.kind === 'calibrated') return calibratedDuel(params, seed, job.gap, job.from, job.to);
  if (job.kind === 'allOut') return allOutDuel(params, seed, job.from, job.to);
  const variant = TACTIC_VARIANTS.find((v) => v.id === job.variant);
  if (variant === undefined) throw new Error(`unknown tactic variant ${job.variant}`);
  return tacticalDuel(params, seed, variant, job.from, job.to);
}
