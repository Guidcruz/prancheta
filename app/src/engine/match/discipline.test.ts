import { describe, expect, it } from 'vitest';
import { FORMATIONS, FORMATION_SLOTS } from '../formations.ts';
import type { GameParams } from '../params.ts';
import { attributeOf, fit, type Player } from '../players.ts';
import { GOALKEEPER_SLOT, conditionMultiplier } from '../strength.ts';
import { firstDerby, fixtureInput, teamInputFrom, testGame } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import type { Side } from '../types.ts';
import { INJURY_SEVERITIES, SUSPENSION, abandonedScore } from './rules.ts';
import { simulateMatch } from './simulate.ts';
import type { MatchEvent, MatchInput, MatchResult, TeamInput } from './types.ts';

/*
 * US-009 (docs/01-requirements.md): cards, suspensions, simple injuries and penalties, and the
 * edge cases of docs/design/partida.md ("Casos de borda") that come with them (T-010). The match
 * produces the cards, injuries, suspensions and the new yellow counters; applying them to the
 * state between rounds (serving the suspension, counting the injury down) is T-013/T-014, so the
 * scenarios are checked here at the level of the match result that those tasks consume.
 */
const params = testParams();
const state = testGame();
const derby = firstDerby(state);
const plain = state.fixtures.find((f) => !state.clubs[f.homeId]!.def.rivals.includes(f.awayId))!;
const base = fixtureInput(state, plain);

type Of<T extends MatchEvent['type']> = Extract<MatchEvent, { type: T }>;
const ofType = <T extends MatchEvent['type']>(result: MatchResult, type: T): Of<T>[] =>
  result.events.filter((e): e is Of<T> => e.type === type);

function withSeed(input: MatchInput, seed: number): MatchInput {
  return { ...input, seed, fixtureId: `${input.fixtureId}-${seed}` };
}

/** Params with some match values changed (tests may go past the ranges: the engine clamps). */
function tuned(
  match: Partial<Omit<GameParams['match'], 'cards' | 'injury'>> & {
    cards?: Partial<GameParams['match']['cards']>;
    injury?: Partial<GameParams['match']['injury']>;
  },
): GameParams {
  return {
    ...params,
    match: {
      ...params.match,
      ...match,
      cards: { ...params.match.cards, ...match.cards },
      injury: { ...params.match.injury, ...match.injury },
    },
  };
}

/** The same team with each player changed by `change`. */
function mapPlayers(team: TeamInput, change: (p: Player, i: number) => Player): TeamInput {
  return { ...team, players: team.players.map(change) };
}

/** The same team with some lineup fields changed. */
function withLineup(team: TeamInput, lineup: Partial<TeamInput['sheet']['lineup']>): TeamInput {
  return { ...team, sheet: { ...team.sheet, lineup: { ...team.sheet.lineup, ...lineup } } };
}

/** Every player an event names. */
function playersIn(e: MatchEvent): string[] {
  switch (e.type) {
    case 'chance':
      return [e.shooter];
    case 'goal':
      return e.assist === undefined ? [e.scorer] : [e.scorer, e.assist];
    case 'penaltyAwarded':
    case 'penaltyMissed':
      return [e.taker];
    case 'yellow':
    case 'red':
    case 'injury':
      return [e.player];
    case 'substitution':
      return [e.out, e.in];
    default:
      return [];
  }
}

/** Index of the event at which each player left the pitch (red card or injury). */
function leftAt(result: MatchResult): Map<string, number> {
  const left = new Map<string, number>();
  result.events.forEach((e, i) => {
    if (e.type === 'red' || e.type === 'injury') left.set(e.player, i);
  });
  return left;
}

/** The first seed from `from` whose match satisfies `found`, as a pair (deterministic search). */
function firstMatch(
  input: (seed: number) => MatchInput,
  found: (result: MatchResult, input: MatchInput) => boolean,
  p: GameParams = params,
  max = 20_000,
): { input: MatchInput; result: MatchResult } {
  for (let seed = 0; seed < max; seed++) {
    const i = input(seed);
    const result = simulateMatch(i, p);
    if (found(result, i)) return { input: i, result };
  }
  throw new Error('no seed found: widen the search');
}

describe('US-009: a red card takes the player off and suspends him', () => {
  // "Dado um jogador que recebe cartão vermelho no minuto 30".
  const { result } = firstMatch(
    (seed) => withSeed(base, seed),
    (r) => r.events.some((e) => e.type === 'red' && e.minute === 30 && e.added === undefined),
  );
  const red = ofType(result, 'red').find((e) => e.minute === 30)!;
  const index = result.events.indexOf(red);

  it('takes no part in any event after minute 30', () => {
    expect(red.importance).toBe(3);
    for (const e of result.events.slice(index + 1)) expect(playersIn(e)).not.toContain(red.player);
    // He played the minute he was sent off in, and not one more.
    expect(result.minutes[red.player]).toBe(30);
    expect(result.events.at(-1)).toMatchObject({ type: 'fulltime', abandoned: false });
  });

  it('is suspended for the club’s next game (newSuspensions, served by the round in T-013)', () => {
    expect(result.newSuspensions).toContainEqual({
      player: red.player,
      games: SUSPENSION.redGames,
    });
    // A red never adds to the accumulated yellows: the counter is the one he came with (0) or,
    // with a booked direct red, the counted yellow (1).
    const booked = ofType(result, 'yellow').some((e) => e.player === red.player);
    const counted = booked && red.reason === 'direct' ? 1 : 0;
    expect(result.yellowCounts[red.player]).toBe(counted);
  });

  it('never lets a player sent off or injured come back, in 2,000 matches', () => {
    let reds = 0;
    for (let seed = 0; seed < 2_000; seed++) {
      const r = simulateMatch(withSeed(base, seed), params);
      const left = leftAt(r);
      reds += r.stats.home.reds + r.stats.away.reds;
      for (const [player, at] of left) {
        for (const e of r.events.slice(at + 1)) expect(playersIn(e)).not.toContain(player);
      }
      for (const red of ofType(r, 'red')) {
        expect(r.newSuspensions.find((s) => s.player === red.player)!.games).toBeGreaterThanOrEqual(
          1,
        );
      }
    }
    expect(reds).toBeGreaterThan(100);
  });
});

describe('US-009: accumulated yellows', () => {
  // "Dado um jogador com amarelos acumulados um abaixo do limite" (3 in partida.md → 2).
  const limit = SUSPENSION.yellowLimit;
  const hanging = mapPlayers(base.home, (p) => ({ ...p, yellowCount: limit - 1 }));
  const inputFor = (seed: number) => ({ ...withSeed(base, seed), home: hanging });

  it('suspends for the next game and puts the counter back to zero on the third yellow', () => {
    const { result } = firstMatch(inputFor, (r) =>
      ofType(r, 'yellow').some(
        (y) => y.side === 'home' && !ofType(r, 'red').some((red) => red.player === y.player),
      ),
    );
    const yellow = ofType(result, 'yellow').find((y) => y.side === 'home')!;
    expect(yellow.triggersSuspension).toBe(true);
    expect(result.newSuspensions).toContainEqual({
      player: yellow.player,
      games: SUSPENSION.yellowGames,
    });
    expect(result.yellowCounts[yellow.player]).toBe(0);
    // The others of the side keep their counter and are not suspended.
    const booked = new Set(ofType(result, 'yellow').map((y) => y.player));
    for (const id of base.home.sheet.lineup.starters) {
      if (booked.has(id) || leftAt(result).has(id)) continue;
      expect(result.yellowCounts[id]).toBe(limit - 1);
      expect(result.newSuspensions.some((s) => s.player === id)).toBe(false);
    }
  });

  it('only adds one below the limit, without a suspension', () => {
    const one = mapPlayers(base.home, (p) => ({ ...p, yellowCount: 1 }));
    const { result } = firstMatch(
      (seed) => ({ ...withSeed(base, seed), home: one }),
      (r) => ofType(r, 'yellow').some((y) => y.side === 'home') && ofType(r, 'red').length === 0,
    );
    const yellow = ofType(result, 'yellow').find((y) => y.side === 'home')!;
    expect(yellow.triggersSuspension).toBe(false);
    expect(result.yellowCounts[yellow.player]).toBe(2);
    expect(result.newSuspensions.some((s) => s.player === yellow.player)).toBe(false);
  });

  it('turns a second yellow into a red: 1 game, and the two yellows never count', () => {
    const { result } = firstMatch(inputFor, (r) =>
      ofType(r, 'red').some((e) => e.side === 'home' && e.reason === 'secondYellow'),
    );
    const red = ofType(result, 'red').find(
      (e) => e.reason === 'secondYellow' && e.side === 'home',
    )!;
    // One yellow event (the first), then the red: the second yellow is the red itself.
    expect(ofType(result, 'yellow').filter((y) => y.player === red.player)).toHaveLength(1);
    expect(result.newSuspensions).toContainEqual({
      player: red.player,
      games: SUSPENSION.redGames,
    });
    expect(result.yellowCounts[red.player]).toBe(limit - 1);
  });

  it('gives both games to a player who reaches 3 yellows and is then sent off directly', () => {
    const { result } = firstMatch(
      inputFor,
      (r) =>
        ofType(r, 'red').some(
          (e) =>
            e.side === 'home' &&
            e.reason === 'direct' &&
            ofType(r, 'yellow').some((y) => y.player === e.player),
        ),
      tuned({ cards: { redPerMinute: 0.002 } }),
    );
    const red = ofType(result, 'red').find(
      (e) => e.reason === 'direct' && ofType(result, 'yellow').some((y) => y.player === e.player),
    )!;
    expect(result.newSuspensions).toContainEqual({
      player: red.player,
      games: SUSPENSION.yellowGames + SUSPENSION.redGames,
    });
    expect(result.yellowCounts[red.player]).toBe(0);
  });

  it('corrects a damaged counter outside 0..2, with a warning', () => {
    const odd = mapPlayers(base.home, (p, i) => (i === 0 ? { ...p, yellowCount: 7 } : p));
    const result = simulateMatch({ ...base, home: odd }, params);
    const warning = result.warnings.find((w) => w.code === 'player-invalid-yellow-count')!;
    expect(warning.detail).toMatchObject({ side: 'home', player: odd.players[0]!.id });
    expect(result.yellowCounts[odd.players[0]!.id]).toBeLessThanOrEqual(limit - 1);
  });
});

describe('US-009: injuries are linked to fatigue', () => {
  // "Dado 10.000 partidas simuladas": in each side, the starters of the odd slots start tired
  // (condition 60) and the others fresh (100), so both groups play the same matches.
  const MATCHES = 10_000;
  const tired = (team: TeamInput) => {
    const odd = new Set(team.sheet.lineup.starters.filter((_, i) => i % 2 === 1));
    return mapPlayers(team, (p) => (odd.has(p.id) ? { ...p, condition: 60 } : p));
  };
  const home = tired(base.home);
  const away = tired(base.away);
  const tiredIds = new Set(
    [home, away].flatMap((t) => t.sheet.lineup.starters.filter((_, i) => i % 2 === 1)),
  );

  it(
    'injures tired players more often per minute, and every injury lasts within its range',
    { timeout: 180_000 },
    () => {
      const exposure = { tired: 0, fresh: 0 };
      const injuries = { tired: 0, fresh: 0 };
      const bySeverity = new Map<string, number>();
      let rounds = 0;
      let total = 0;
      for (let seed = 0; seed < MATCHES; seed++) {
        const r = simulateMatch({ ...withSeed(base, seed), home, away }, params);
        for (const [id, minutes] of Object.entries(r.minutes)) {
          exposure[tiredIds.has(id) ? 'tired' : 'fresh'] += minutes;
        }
        const severity = new Map(ofType(r, 'injury').map((e) => [e.player, e.severity]));
        for (const injury of r.newInjuries) {
          injuries[tiredIds.has(injury.player) ? 'tired' : 'fresh'] += 1;
          const s = severity.get(injury.player)!;
          const row = INJURY_SEVERITIES.find((x) => x.severity === s)!;
          expect(injury.rounds).toBeGreaterThanOrEqual(row.minRounds);
          expect(injury.rounds).toBeLessThanOrEqual(row.maxRounds);
          expect(Number.isInteger(injury.rounds)).toBe(true);
          bySeverity.set(s, (bySeverity.get(s) ?? 0) + 1);
          rounds += injury.rounds;
          total += 1;
        }
      }
      const tiredRate = injuries.tired / exposure.tired;
      const freshRate = injuries.fresh / exposure.fresh;
      expect(tiredRate).toBeGreaterThan(freshRate * 1.2);
      // Severity shares of partida.md (60/25/12/3) and the mean duration (2 to 3 rounds).
      expect(total).toBeGreaterThan(1_500);
      expect(bySeverity.get('light')! / total).toBeGreaterThan(0.55);
      expect(bySeverity.get('light')! / total).toBeLessThan(0.65);
      expect(bySeverity.get('severe')! / total).toBeGreaterThan(0.015);
      expect(bySeverity.get('severe')! / total).toBeLessThan(0.045);
      expect(rounds / total).toBeGreaterThan(2);
      expect(rounds / total).toBeLessThan(3);
    },
  );

  it('takes the injured player off at once: an empty slot until T-012 brings substitutions', () => {
    const { result } = firstMatch(
      (seed) => withSeed(base, seed),
      (r) => r.newInjuries.length > 0,
    );
    const injury = ofType(result, 'injury')[0]!;
    expect(injury.importance).toBe(2);
    expect(result.minutes[injury.player]).toBe(injury.minute);
    expect(ofType(result, 'substitution')).toEqual([]);
    const at = result.events.indexOf(injury);
    for (const e of result.events.slice(at + 1)) expect(playersIn(e)).not.toContain(injury.player);
  });
});

describe('US-009: the penalty uses the chosen taker', () => {
  const many = tuned({ penaltyShare: 0.05 }); // the top of the range, for more penalties
  const starters = base.home.sheet.lineup.starters;
  const [first, second] = [starters[3]!, starters[6]!]; // a defender and a midfielder
  const listed = withLineup(base.home, { penaltyTakers: [first, second] });

  function homePenalties(input: MatchInput, p = many) {
    const result = simulateMatch(input, p);
    const left = leftAt(result);
    return ofType(result, 'penaltyAwarded')
      .filter((e) => e.side === 'home')
      .map((e) => ({ taker: e.taker, index: result.events.indexOf(e), left, result }));
  }

  it('is taken by the first of the list on the pitch, and scored or missed by him', () => {
    let count = 0;
    for (let seed = 0; seed < 300; seed++) {
      for (const { taker, index, left, result } of homePenalties({
        ...withSeed(base, seed),
        home: listed,
      })) {
        const firstGone = (left.get(first) ?? Infinity) < index;
        expect(taker).toBe(firstGone ? second : first);
        const next = result.events[index + 1]!;
        if (next.type === 'goal') expect(next).toMatchObject({ kind: 'penalty', scorer: taker });
        else expect(next).toMatchObject({ type: 'penaltyMissed', taker });
        count += 1;
      }
    }
    expect(count).toBeGreaterThan(30);
  });

  it('goes to the next of the list when the first is not on the pitch', () => {
    const bench = base.home.players.find((p) => !starters.includes(p.id))!.id;
    const notStarting = withLineup(base.home, { penaltyTakers: [bench, second] });
    let count = 0;
    for (let seed = 0; seed < 200; seed++) {
      for (const { taker, index, left } of homePenalties({
        ...withSeed(base, seed),
        home: notStarting,
      })) {
        if ((left.get(second) ?? Infinity) < index) continue; // the second left too
        expect(taker).toBe(second);
        count += 1;
      }
    }
    expect(count).toBeGreaterThan(10);
  });

  it('goes to the next of the list once the first left the pitch during the match', () => {
    // Many injuries, so the first taker often leaves before a penalty.
    const p = tuned({ penaltyShare: 0.05, injury: { basePerMinute: 0.004 } });
    const { result } = firstMatch(
      (seed) => ({ ...withSeed(base, seed), home: listed }),
      (r) => {
        const gone = leftAt(r).get(first);
        return (
          gone !== undefined &&
          r.events.some((e, i) => i > gone && e.type === 'penaltyAwarded' && e.side === 'home') &&
          !leftAt(r).has(second)
        );
      },
      p,
    );
    const gone = leftAt(result).get(first)!;
    const later = result.events.filter(
      (e, i): e is Of<'penaltyAwarded'> =>
        i > gone && e.type === 'penaltyAwarded' && e.side === 'home',
    );
    expect(later.length).toBeGreaterThan(0);
    for (const e of later) expect(e.taker).toBe(second);
  });

  it('without a list, is taken by the player on the pitch with the highest finishing', () => {
    const byId = new Map(base.home.players.map((p) => [p.id, p]));
    let count = 0;
    for (let seed = 0; seed < 200; seed++) {
      for (const { taker, index, left } of homePenalties(withSeed(base, seed))) {
        const onPitch = starters.filter((id) => (left.get(id) ?? Infinity) > index);
        const best = Math.max(...onPitch.map((id) => attributeOf(byId.get(id)!, 'finishing')));
        expect(attributeOf(byId.get(taker)!, 'finishing')).toBe(best);
        count += 1;
      }
    }
    expect(count).toBeGreaterThan(10);
  });

  it('gives direct free kicks to the free-kick list, else to the highest technique', () => {
    const fk = tuned({ freeKickShare: 0.15 });
    const taker = starters[2]!;
    const withTaker = withLineup(base.home, { freeKickTakers: [taker] });
    const byId = new Map(base.home.players.map((p) => [p.id, p]));
    let listedCount = 0;
    let fallbackCount = 0;
    for (let seed = 0; seed < 100; seed++) {
      for (const [home, listedSide] of [
        [withTaker, true],
        [base.home, false],
      ] as const) {
        const r = simulateMatch({ ...withSeed(base, seed), home }, fk);
        const left = leftAt(r);
        r.events.forEach((e, i) => {
          if (e.type !== 'chance' && e.type !== 'goal') return;
          if (e.side !== 'home' || e.kind !== 'freeKick') return;
          const shooter = e.type === 'chance' ? e.shooter : e.scorer;
          if (e.type === 'goal') expect(e.assist).toBeUndefined();
          if (listedSide && (left.get(taker) ?? Infinity) > i) {
            expect(shooter).toBe(taker);
            listedCount += 1;
          } else if (!listedSide) {
            const onPitch = starters.filter((id) => (left.get(id) ?? Infinity) > i);
            const best = Math.max(...onPitch.map((id) => attributeOf(byId.get(id)!, 'technique')));
            expect(attributeOf(byId.get(shooter)!, 'technique')).toBe(best);
            fallbackCount += 1;
          }
        });
      }
    }
    expect(listedCount).toBeGreaterThan(50);
    expect(fallbackCount).toBeGreaterThan(50);
  });
});

describe('cards follow pressure, trait, derby and the "Acalmar" talk (partida.md, "Cartões")', () => {
  const N = 800;
  const yellows = (home: TeamInput, derbyFlag = false, side: Side = 'home') => {
    let n = 0;
    for (let seed = 0; seed < N; seed++) {
      const r = simulateMatch({ ...withSeed(base, seed), home, derby: derbyFlag }, params);
      n += r.stats[side].yellows;
    }
    return n / N;
  };
  const tactic = (pressure: 'low' | 'medium' | 'high'): TeamInput => ({
    ...base.home,
    sheet: { ...base.home.sheet, tactic: { ...base.home.sheet.tactic, pressure } },
  });

  it('gives more yellows with high pressure (×1.4) than with low (×0.7)', () => {
    const high = yellows(tactic('high'));
    const low = yellows(tactic('low'));
    expect(high / low).toBeGreaterThan(1.6);
    expect(high / low).toBeLessThan(2.4);
  });

  it('gives about 1.5 times the yellows to a side of hotheads, and 1.2 in a derby', () => {
    const quiet = mapPlayers(base.home, (p) => ({ ...p, trait: 'quiet' }));
    const hot = mapPlayers(base.home, (p) => ({ ...p, trait: 'hothead' }));
    const ratio = yellows(hot) / yellows(quiet);
    expect(ratio).toBeGreaterThan(1.3);
    expect(ratio).toBeLessThan(1.7);
    const derbyRatio = yellows(quiet, true) / yellows(quiet, false);
    expect(derbyRatio).toBeGreaterThan(1.08);
    expect(derbyRatio).toBeLessThan(1.32);
  });

  it('gives fewer second-half yellows after "Acalmar" (×0.75)', () => {
    // The seller calms when winning at half time and motivates otherwise (ia-clubes.md).
    const seller = { ...base.home, profile: 'seller' as const };
    const sum = { calm: 0, other: 0 };
    const count = { calm: 0, other: 0 };
    for (let seed = 0; seed < 3_000; seed++) {
      const r = simulateMatch({ ...withSeed(base, seed), home: seller }, params);
      const talk = ofType(r, 'halftimeTalk').find((t) => t.side === 'home')!.talk;
      const key = talk === 'calm' ? 'calm' : 'other';
      count[key] += 1;
      sum[key] += ofType(r, 'yellow').filter((y) => y.side === 'home' && y.half === 2).length;
    }
    const ratio = sum.calm / count.calm / (sum.other / count.other);
    expect(count.calm).toBeGreaterThan(300);
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(0.9);
  });
});

describe('captain (partida.md, "Capitão e cobradores")', () => {
  it('doubles the positive half-time talk with a leader captain, and changes only the second half', () => {
    const captain = base.home.sheet.lineup.starters[5]!;
    const as = (trait: Player['trait']) =>
      withLineup(
        mapPlayers(base.home, (p) => (p.id === captain ? { ...p, trait } : p)),
        { captains: [captain] },
      );
    const leader = as('leader');
    const quiet = as('quiet');
    let changed = 0;
    for (let seed = 0; seed < 200; seed++) {
      const a = simulateMatch({ ...withSeed(base, seed), home: leader }, params);
      const b = simulateMatch({ ...withSeed(base, seed), home: quiet }, params);
      const firstHalf = (r: MatchResult) => JSON.stringify(r.events.filter((e) => e.half === 1));
      expect(firstHalf(a)).toBe(firstHalf(b));
      if (JSON.stringify(a.events) !== JSON.stringify(b.events)) changed += 1;
    }
    // The traditional profile's talks are all positive (+4%, +2%, +2%): doubled every time, which
    // moves the second-half chance probabilities by a few percent and so changes some matches.
    expect(changed).toBeGreaterThan(20);
  });
});

describe('edge cases (partida.md, "Casos de borda")', () => {
  const ghosts = (team: TeamInput, keep: number) =>
    withLineup(team, {
      starters: team.sheet.lineup.starters.map((id, i) => (i < keep ? id : `${team.clubId}#ghost`)),
    });

  it('ends at kick-off a match with fewer than 7 on one side: the other side wins 3×0', () => {
    const r = simulateMatch({ ...base, home: ghosts(base.home, 6) }, params);
    expect(r.events.map((e) => e.type)).toEqual(['kickoff', 'fulltime']);
    expect(r.events.at(-1)).toMatchObject({ minute: 0, half: 1, abandoned: true, score: [0, 3] });
    expect(r.score).toEqual([0, 3]);
    const away = simulateMatch({ ...base, away: ghosts(base.away, 5) }, params);
    expect(away.score).toEqual([3, 0]);
    // Both sides short at kick-off (a damaged input): the home side is checked first.
    const both = simulateMatch(
      { ...base, home: ghosts(base.home, 6), away: ghosts(base.away, 6) },
      params,
    );
    expect(both.score).toEqual([0, 3]);
    for (const m of Object.values(r.minutes)) expect(m).toBe(0);
    expect(r.stats.home.possession + r.stats.away.possession).toBe(100);
  });

  it('ends the match the moment a side falls below 7, with no event after it', () => {
    const seven = ghosts(base.home, 7);
    const many = tuned({ injury: { basePerMinute: 0.005 } });
    for (let seed = 0; seed < 50; seed++) {
      const r = simulateMatch({ ...withSeed(base, seed), home: seven }, many);
      const end = r.events.at(-1)!;
      expect(end.type).toBe('fulltime');
      if (end.type !== 'fulltime' || !end.abandoned) continue;
      const last = r.events.at(-2)!;
      expect(['red', 'injury']).toContain(last.type);
      expect([last.minute, last.added, last.half]).toEqual([end.minute, end.added, end.half]);
      const goals = ofType(r, 'goal');
      const live: [number, number] = [
        goals.filter((g) => g.side === 'home').length,
        goals.filter((g) => g.side === 'away').length,
      ];
      const short = (last as Of<'red' | 'injury'>).side;
      expect(r.score).toEqual(abandonedScore(live, short));
      expect(end.score).toEqual(r.score);
      expect(end.importance).toBe(3);
    }
    const abandoned = Array.from({ length: 50 }, (_, seed) =>
      simulateMatch({ ...withSeed(base, seed), home: seven }, many),
    ).filter((r) => ofType(r, 'fulltime')[0]!.abandoned);
    expect(abandoned.length).toBeGreaterThan(25);
  });

  it('sends the outfield player with the highest physical to goal when the goalkeeper leaves', () => {
    const many = tuned({ injury: { basePerMinute: 0.003 } });
    const keeper = base.home.sheet.lineup.starters[GOALKEEPER_SLOT]!;
    const byId = new Map(base.home.players.map((p) => [p.id, p]));
    let checked = 0;
    for (let seed = 0; seed < 400 && checked < 5; seed++) {
      const r = simulateMatch(withSeed(base, seed), many);
      const left = leftAt(r);
      const at = left.get(keeper);
      if (at === undefined || ofType(r, 'fulltime')[0]!.abandoned) continue;
      // Outfield players on the pitch when he left, in slot order; the first highest physical.
      const outfield = base.home.sheet.lineup.starters
        .slice(1)
        .filter((id) => (left.get(id) ?? Infinity) > at);
      let next = outfield[0]!;
      for (const id of outfield) {
        if (attributeOf(byId.get(id)!, 'physical') > attributeOf(byId.get(next)!, 'physical')) {
          next = id;
        }
      }
      for (const e of r.events.slice(at + 1)) {
        if ((e.type === 'chance' || e.type === 'goal') && e.kind === 'open' && e.side === 'home') {
          expect(e.type === 'chance' ? e.shooter : e.scorer).not.toBe(next);
        }
      }
      expect(r.events.at(-1)).toMatchObject({ type: 'fulltime', abandoned: false, minute: 90 });
      checked += 1;
    }
    expect(checked).toBe(5);
  });

  it('replaces an injured or suspended starter with the best available reserve, with a warning', () => {
    const starters = base.home.sheet.lineup.starters;
    const reserves = base.home.players.filter((p) => !starters.includes(p.id));
    const out = starters[9]!; // a forward slot of the formation
    const keeper = starters[GOALKEEPER_SLOT]!;
    const home = withLineup(
      mapPlayers(base.home, (p) =>
        p.id === out
          ? { ...p, injuryRounds: 2 }
          : p.id === keeper
            ? { ...p, suspendedGames: 1 }
            : p,
      ),
      { bench: reserves.map((p) => p.id) },
    );
    const r = simulateMatch({ ...base, home }, params);
    const warnings = r.warnings.filter((w) => w.code === 'lineup-unavailable-player');
    expect(warnings.map((w) => w.detail?.player)).toEqual([keeper, out]);
    const slot = FORMATION_SLOTS[base.home.sheet.lineup.formation];
    const value = (p: Player, i: number) =>
      p.overall * fit(p.position, slot[i]!) * conditionMultiplier(p.condition);
    const keeperIn = warnings[0]!.detail!.replacement as string;
    const outIn = warnings[1]!.detail!.replacement as string;
    const bestFor = (i: number, pool: Player[]) => Math.max(...pool.map((p) => value(p, i)));
    expect(
      value(
        reserves.find((p) => p.id === keeperIn)!,
        GOALKEEPER_SLOT,
      ),
    ).toBe(bestFor(GOALKEEPER_SLOT, reserves));
    expect(reserves.find((p) => p.id === keeperIn)!.position).toBe('GK');
    const rest = reserves.filter((p) => p.id !== keeperIn);
    expect(
      value(
        rest.find((p) => p.id === outIn)!,
        9,
      ),
    ).toBe(bestFor(9, rest));
    expect(Object.keys(r.minutes)).toContain(keeperIn);
    expect(Object.keys(r.minutes)).toContain(outIn);
    expect(Object.keys(r.minutes)).not.toContain(out);
    expect(Object.keys(r.minutes)).not.toContain(keeper);

    // Without a bench, the slot stays empty (10 on the pitch) and the warning has no replacement.
    const alone = mapPlayers(base.home, (p) => (p.id === out ? { ...p, injuryRounds: 1 } : p));
    const short = simulateMatch({ ...base, home: alone }, params);
    const w = short.warnings.find((x) => x.code === 'lineup-unavailable-player')!;
    expect(w.detail).toEqual({ side: 'home', player: out });
    expect(Object.keys(short.minutes)).toHaveLength(21);
  });

  it('never gives NaN nor throws with very many cards, in every formation (Pedido ao developer 5)', () => {
    const wild = tuned({ cards: { yellowPerMinute: 0.03, redPerMinute: 0.002 } });
    for (const formation of FORMATIONS) {
      const home = teamInputFrom(base.home.clubId, base.home.players, { formation });
      const away = teamInputFrom(base.away.clubId, base.away.players, { formation });
      for (let seed = 0; seed < 15; seed++) {
        const r = simulateMatch({ ...withSeed(base, seed), home, away }, wild);
        const walk = (value: unknown): void => {
          if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
          else if (typeof value === 'object' && value !== null) Object.values(value).forEach(walk);
        };
        walk(r);
        expect(r.events.at(-1)!.type).toBe('fulltime');
      }
    }
  });

  it('is deterministic with cards, injuries and an abandoned match', () => {
    const input = { ...withSeed(base, 3), home: ghosts(base.home, 7) };
    const p = tuned({ injury: { basePerMinute: 0.005 } });
    expect(JSON.stringify(simulateMatch(input, p))).toBe(JSON.stringify(simulateMatch(input, p)));
  });
});

describe('derby: cards in the first derby of the calendar', () => {
  it('lists every card and injury of the result in its events', () => {
    const r = simulateMatch(fixtureInput(state, derby), params);
    expect(r.newInjuries.map((i) => i.player)).toEqual(ofType(r, 'injury').map((e) => e.player));
    for (const s of r.newSuspensions) {
      const red = ofType(r, 'red').some((e) => e.player === s.player);
      const third = ofType(r, 'yellow').some((e) => e.player === s.player && e.triggersSuspension);
      expect(red || third).toBe(true);
    }
  });
});
