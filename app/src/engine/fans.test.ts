import { describe, expect, it } from 'vitest';
import {
  clubIdol,
  EXPECTED_POINTS,
  expectedPoints,
  FANS_EXTRAS,
  fansDelta,
  fansVenue,
  IDOL_BENCH,
  winlessRuns,
  type FansRoundInput,
} from './fans.ts';
import type { GameState } from './game.ts';
import type { TeamSheet } from './lineup.ts';
import type { Player } from './players.ts';
import { playRound, prepareRound, type RoundInput } from './round.ts';
import { roundFacts } from './facts.ts';
import { getStandings, roundTables } from './standings.ts';
import { homeAdvantage } from './strength.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { ClubId, PlayerId } from './types.ts';

/*
 * The fans thermometer (US-026; torcida.md, "Fórmula", "Decisões do técnico", "Efeitos"; T-014):
 * the formula and its example, the extras, the cap and the bounds; the wiring in playRound for
 * the 20 clubs over a season; the home bonus; the morale drift; `fanDecisions`; the idol on the
 * bench. The screen's thermometer (number and label) is the screens' (T-024).
 */

const params = testParams();
const fansParams = params.fans;
const COACH = 'clube-teste-05';

function input(round: number, extra: Partial<RoundInput> = {}): RoundInput {
  return { round, sheets: {}, commands: {}, fanDecisions: {}, ...extra };
}

function play(state: GameState, extra: Partial<RoundInput> = {}) {
  const result = playRound(state, params, input(state.round, extra));
  if (!result.ok) throw new Error(`playRound: ${result.error}`);
  return result;
}

function withPlayers(
  state: GameState,
  change: (p: Player) => Partial<Player> | undefined,
): GameState {
  const players: Record<PlayerId, Player> = {};
  for (const [id, p] of Object.entries(state.players)) {
    const patch = change(p);
    players[id] = patch === undefined ? p : { ...p, ...patch };
  }
  return { ...state, players };
}

function withFans(state: GameState, clubId: ClubId, fans: number): GameState {
  return { ...state, clubs: { ...state.clubs, [clubId]: { ...state.clubs[clubId]!, fans } } };
}

/** A neutral round input: a draw as expected, mid-table, no decisions. */
function base(extra: Partial<FansRoundInput> = {}): FansRoundInput {
  return {
    fans: 55,
    scored: 1,
    conceded: 1,
    expected: 1,
    derby: false,
    winlessRun: 0,
    position: 10,
    clubs: 20,
    round: 10,
    decisions: 0,
    idol: 0,
    ...extra,
  };
}

describe('fansDelta: the formula of torcida.md', () => {
  it('the example: a medium club (70) at 50 beats a big one (76) at home, +2 of decisions → 59', () => {
    const expected = expectedPoints(70, 76, 'home');
    expect(expected).toBeCloseTo(1.32, 10);
    const move = fansDelta(
      base({ fans: 50, scored: 1, conceded: 0, expected, position: 8, round: 3, decisions: 2 }),
      fansParams,
    );
    expect(move.result).toBeCloseTo(6.72, 10);
    expect(move.reversion).toBeCloseTo(-0.4, 10);
    expect(move.decisions).toBe(2);
    expect(move.extras).toBe(0);
    expect(move.delta).toBeCloseTo(9.12, 10);
    expect(move.fans).toBeCloseTo(59.12, 10);
    expect(Math.round(move.fans)).toBe(59);
    // The same win in a derby: 4 × 1.68 × 1.5 = +10.1.
    const derby = fansDelta(
      base({ fans: 50, scored: 1, conceded: 0, expected, derby: true }),
      fansParams,
    );
    expect(derby.result).toBeCloseTo(10.08, 10);
  });

  it('expected points: 1.40 + 0.04 × d with ±4 of venue, clamped to 0.3..2.5', () => {
    expect(expectedPoints(70, 70, 'home')).toBeCloseTo(1.56, 10);
    expect(expectedPoints(70, 70, 'away')).toBeCloseTo(1.24, 10);
    expect(expectedPoints(70, 70, 'neutral')).toBeCloseTo(1.4, 10);
    expect(expectedPoints(90, 50, 'home')).toBe(EXPECTED_POINTS.max);
    expect(expectedPoints(50, 90, 'away')).toBe(EXPECTED_POINTS.min);
    expect([EXPECTED_POINTS.min, EXPECTED_POINTS.max]).toEqual([0.3, 2.5]);
  });

  it('the venue: home or away by the side, none on neutral ground (match.neutral)', () => {
    expect(fansVenue({ neutral: false }, 'home')).toBe('home');
    expect(fansVenue({ neutral: false }, 'away')).toBe('away');
    expect(fansVenue({ neutral: true }, 'home')).toBe('neutral');
    expect(fansVenue({ neutral: true }, 'away')).toBe('neutral');
    expect(expectedPoints(70, 76, fansVenue({ neutral: true }, 'home'))).toBeCloseTo(1.16, 10);
  });

  it('result: resultWeight × (points − expected), × derbyResultMult in a derby', () => {
    const at = (scored: number, conceded: number, derby = false) =>
      fansDelta(base({ scored, conceded, expected: 1.4, derby }), fansParams).result;
    expect(at(1, 0)).toBeCloseTo(4 * 1.6, 10);
    expect(at(2, 2)).toBeCloseTo(4 * -0.4, 10);
    expect(at(0, 1)).toBeCloseTo(4 * -1.4, 10);
    expect(at(0, 1, true)).toBeCloseTo(4 * -1.4 * 1.5, 10);
  });

  it('extras: goleada ±2, from the 4th game without winning −1, top 4 +0.5 and Z4 −1 from round 6', () => {
    const extras = (extra: Partial<FansRoundInput>) => fansDelta(base(extra), fansParams).extras;
    expect(extras({ scored: 3, conceded: 0 })).toBe(FANS_EXTRAS.bigWin);
    expect(extras({ scored: 4, conceded: 2 })).toBe(0);
    expect(extras({ scored: 1, conceded: 4, winlessRun: 1 })).toBe(FANS_EXTRAS.bigLoss);
    expect(extras({ winlessRun: 3 })).toBe(0);
    expect(extras({ winlessRun: 4 })).toBe(FANS_EXTRAS.winless);
    expect(extras({ winlessRun: 9 })).toBe(-1);
    expect(extras({ position: 4 })).toBe(FANS_EXTRAS.top);
    expect(extras({ position: 5 })).toBe(0);
    expect(extras({ position: 16 })).toBe(0);
    expect(extras({ position: 17 })).toBe(FANS_EXTRAS.relegation);
    expect(extras({ position: 20, round: 5 })).toBe(0);
    expect(extras({ position: 1, round: 5 })).toBe(0);
    expect(extras({ position: 1, round: 6 })).toBe(0.5);
    expect(extras({ position: undefined })).toBe(0);
    // All at once: a 0-3 at home, 5th game without a win, last place.
    expect(extras({ scored: 0, conceded: 3, winlessRun: 5, position: 20 })).toBe(-4);
  });

  it('decisions are limited to ±fans.decisionCap; reversion pulls towards fans.baseline', () => {
    // The idol left on the bench comes after the cap (torcida.md, revised): −5 to +4.
    expect(fansDelta(base({ decisions: 6, idol: -1 }), fansParams).decisions).toBe(3);
    expect(fansDelta(base({ decisions: -6, idol: -1 }), fansParams).decisions).toBe(-5);
    expect(fansDelta(base({ decisions: 2, idol: -1 }), fansParams).decisions).toBe(1);
    expect(fansDelta(base({ decisions: 10 }), fansParams).decisions).toBe(4);
    expect(fansDelta(base({ decisions: -7 }), fansParams).decisions).toBe(-4);
    expect(fansDelta(base({ decisions: 3 }), fansParams).decisions).toBe(3);
    expect(fansDelta(base({ decisions: 3 }), { ...fansParams, decisionCap: 0 }).decisions).toBe(0);
    expect(fansDelta(base({ fans: 80 }), fansParams).reversion).toBeCloseTo(2, 10);
    expect(fansDelta(base({ fans: 30 }), fansParams).reversion).toBeCloseTo(-2, 10);
    // Without results nor decisions, the thermometer only goes back towards the baseline.
    const still = base({ expected: 1 });
    expect(fansDelta({ ...still, fans: 80 }, fansParams).fans).toBeCloseTo(78, 10);
    expect(fansDelta({ ...still, fans: 55 }, fansParams).fans).toBe(55);
  });

  it('always within 0..100, and strange inputs never give NaN', () => {
    const top = base({
      fans: 99,
      scored: 5,
      conceded: 0,
      expected: 0.3,
      position: 1,
      decisions: 4,
    });
    expect(fansDelta(top, fansParams).fans).toBe(100);
    const bottom = base({
      fans: 1,
      scored: 0,
      conceded: 5,
      expected: 2.5,
      winlessRun: 9,
      position: 20,
      decisions: -4,
    });
    expect(fansDelta(bottom, fansParams).fans).toBe(0);
    for (const fans of [Number.NaN, -20, 140, Number.POSITIVE_INFINITY]) {
      for (const decisions of [Number.NaN, Number.NEGATIVE_INFINITY, 2]) {
        const move = fansDelta(base({ fans, decisions, expected: Number.NaN }), fansParams);
        expect(Number.isFinite(move.fans)).toBe(true);
        expect(move.fans).toBeGreaterThanOrEqual(0);
        expect(move.fans).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('winlessRuns and clubIdol', () => {
  it('counts the games in a row without winning, this round included', () => {
    const state = testGame();
    const fixtures = state.fixtures.map((f) => {
      if (f.round > 4) return f;
      // The home side of every match wins rounds 1 and 3 and draws 2 and 4.
      const score: [number, number] = f.round % 2 === 1 ? [1, 0] : [0, 0];
      return {
        ...f,
        result: { score, abandoned: false, goals: [], stats: {} as never, attendance: 0 },
      };
    });
    const runs = winlessRuns(fixtures, 4);
    for (const clubId of Object.keys(state.clubs)) {
      const games = fixtures.filter(
        (f) => f.round <= 4 && (f.homeId === clubId || f.awayId === clubId),
      );
      let run = 0;
      for (const f of games) run = f.round % 2 === 1 && f.homeId === clubId ? 0 : run + 1;
      expect(runs.get(clubId) ?? 0, clubId).toBe(run);
    }
    expect(winlessRuns(fixtures, 0).size).toBe(0);
  });

  it('the idol is the first player of the squad with the trait, else undefined', () => {
    const state = testGame();
    const idol = clubIdol(state.squads[COACH]!, state.players);
    expect(idol?.trait).toBe('idol');
    const none = withPlayers(state, (p) => (p.trait === 'idol' ? { trait: 'quiet' } : undefined));
    expect(clubIdol(none.squads[COACH]!, none.players)).toBeUndefined();
  });
});

/**
 * The thermometer every club should have after the round, recomputed from the state before it
 * and after it with the formula of torcida.md: the strengths and the venue of the fixture, the
 * table and the runs counted here, the idol's streak and the decisions given.
 */
function expectedFans(
  before: GameState,
  after: GameState,
  decisions: Partial<Record<ClubId, number>> = {},
  humans: ReadonlySet<ClubId> = new Set(),
): Map<ClubId, { fans: number; idolBenchStreak: number; decisions: number }> {
  const out = new Map<ClubId, { fans: number; idolBenchStreak: number; decisions: number }>();
  const round = before.round;
  const table = getStandings(after);
  for (const res of after.lastRound!.results) {
    const f = before.fixtures.find((x) => x.id === res.fixtureId)!;
    for (const [clubId, otherId, venue, own, other] of [
      [f.homeId, f.awayId, 'home', res.score[0], res.score[1]],
      [f.awayId, f.homeId, 'away', res.score[1], res.score[0]],
    ] as const) {
      let winless = 0;
      for (const g of after.fixtures) {
        if (g.result === undefined || g.round > round) continue;
        if (g.homeId !== clubId && g.awayId !== clubId) continue;
        const [h, a] = g.result.score;
        winless = (g.homeId === clubId ? h > a : a > h) ? 0 : winless + 1;
      }
      const idol = before.squads[clubId]!.map((id) => before.players[id]!).find(
        (p) => p.trait === 'idol',
      );
      // Only a human club leaves its idol on the bench (jogadores.md, revised).
      const benched =
        humans.has(clubId) &&
        idol !== undefined &&
        !(idol.id in res.minutes) &&
        idol.injuryRounds === 0 &&
        idol.suspendedGames === 0;
      const idolBenchStreak = benched ? before.clubs[clubId]!.idolBenchStreak + 1 : 0;
      const move = fansDelta(
        {
          fans: before.clubs[clubId]!.fans,
          scored: own,
          conceded: other,
          expected: expectedPoints(
            before.clubs[clubId]!.strength,
            before.clubs[otherId]!.strength,
            venue,
          ),
          derby: before.clubs[f.homeId]!.def.rivals.includes(f.awayId),
          winlessRun: winless,
          position: table.find((r) => r.clubId === clubId)!.position,
          clubs: 20,
          round,
          decisions: humans.has(clubId) ? (decisions[clubId] ?? 0) : 0,
          idol: idolBenchStreak >= 2 ? -1 : 0,
        },
        fansParams,
      );
      out.set(clubId, { fans: move.fans, idolBenchStreak, decisions: move.decisions });
    }
  }
  return out;
}

const chain = new Map<number, GameState[]>();
function season(seed: number): GameState[] {
  const cached = chain.get(seed);
  if (cached !== undefined) return cached;
  const states = [testGame(seed)];
  for (let r = 1; r <= 38; r++) states.push(play(states[r - 1]!).value.state);
  chain.set(seed, states);
  return states;
}

describe('playRound: the thermometer of the 20 clubs (US-026)', () => {
  it('every club, every round of a season, follows the formula, and stays within 0..100', () => {
    const all = season(20261104);
    expect(Object.values(all[0]!.clubs).every((c) => c.fans === fansParams.start)).toBe(true);
    let moved = 0;
    for (let r = 1; r <= 38; r++) {
      const expected = expectedFans(all[r - 1]!, all[r]!);
      expect(expected.size).toBe(20);
      for (const [clubId, club] of Object.entries(all[r]!.clubs)) {
        const want = expected.get(clubId)!;
        expect(club.fans, `round ${r}, ${clubId}`).toBe(want.fans);
        expect(club.idolBenchStreak, `round ${r}, ${clubId}`).toBe(want.idolBenchStreak);
        // Every club is the AI's here: the idol's streak never moves.
        expect(club.idolBenchStreak, `round ${r}, ${clubId}`).toBe(0);
        expect(club.fans).toBeGreaterThanOrEqual(0);
        expect(club.fans).toBeLessThanOrEqual(100);
        if (club.fans !== all[r - 1]!.clubs[clubId]!.fans) moved++;
      }
    }
    expect(moved).toBeGreaterThan(700);
  });

  it('the next round plays with the new thermometer (the match input and the home bonus)', () => {
    const [, after] = season(20261104);
    const plan = prepareRound(after!, params);
    if (!plan.ok) throw new Error('prepareRound');
    for (const m of plan.value.matches) {
      expect(m.home.fans).toBe(after!.clubs[m.home.clubId]!.fans);
      expect(m.away.fans).toBe(after!.clubs[m.away.clubId]!.fans);
    }
  });

  /**
   * Three rounds of the coach's club from a thermometer of 50, forced to win (each opponent keeps
   * only 6 fit players, so the match ends at kick-off with 3-0 for the coach) or to lose (the
   * coach's club keeps only 6). Same career seed in both.
   */
  function threeRounds(outcome: 'win' | 'lose'): number[] {
    let state = withFans(testGame(), COACH, 50);
    const opponents = new Set(
      state.fixtures
        .filter((f) => f.round <= 3 && (f.homeId === COACH || f.awayId === COACH))
        .map((f) => (f.homeId === COACH ? f.awayId : f.homeId)),
    );
    const short = outcome === 'win' ? opponents : new Set([COACH]);
    state = withPlayers(state, (p) =>
      short.has(p.clubId) && state.squads[p.clubId]!.indexOf(p.id) >= 6
        ? { injuryRounds: 10 }
        : undefined,
    );
    const fans: number[] = [];
    for (let r = 1; r <= 3; r++) {
      const played = play(state).value;
      const res = played.report.results.find((x) =>
        Object.keys(x.minutes).some((id) => id.startsWith(`${COACH}#`)),
      )!;
      const fixture = state.fixtures.find((f) => f.id === res.fixtureId)!;
      const own = fixture.homeId === COACH ? res.score[0] : res.score[1];
      const other = fixture.homeId === COACH ? res.score[1] : res.score[0];
      expect(outcome === 'win' ? own > other : own < other, `round ${r}`).toBe(true);
      state = played.state;
      fans.push(state.clubs[COACH]!.fans);
    }
    return fans;
  }

  it('termômetro reage aos resultados: 3 wins in a row raise it, 3 defeats lower it', () => {
    const up = threeRounds('win');
    const down = threeRounds('lose');
    expect(up[0]).toBeGreaterThan(50);
    expect(up[1]).toBeGreaterThan(up[0]!);
    expect(up[2]).toBeGreaterThan(up[1]!);
    expect(down[0]).toBeLessThan(50);
    expect(down[1]).toBeLessThan(down[0]!);
    expect(down[2]).toBeLessThan(down[1]!);
    for (const f of [...up, ...down]) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(100);
    }
  });

  it('cuts at the edges: a thermometer of 100 after a win and of 0 after a defeat', () => {
    const full = play(
      Object.keys(testGame().clubs).reduce((s, id) => withFans(s, id, 100), testGame()),
    ).value.state;
    const empty = play(
      Object.keys(testGame().clubs).reduce((s, id) => withFans(s, id, 0), testGame()),
    ).value.state;
    for (const club of Object.values(full.clubs)) expect(club.fans).toBeLessThanOrEqual(100);
    for (const club of Object.values(empty.clubs)) expect(club.fans).toBeGreaterThanOrEqual(0);
    expect(Object.values(full.clubs).some((c) => c.fans === 100)).toBe(true);
    expect(Object.values(empty.clubs).some((c) => c.fans === 0)).toBe(true);
  });
});

describe('US-026: the home bonus', () => {
  it('match.homeBase + fans.homeBonusMin at 0, + fans.homeBonusMax at 100, + derbyBonus in a derby', () => {
    const { homeBase } = params.match;
    const { homeBonusMin, homeBonusMax, derbyBonus } = fansParams;
    for (const derby of [false, true]) {
      const extra = derby ? derbyBonus : 0;
      expect(homeAdvantage({ fans: 0, derby }, params)).toBeCloseTo(
        homeBase + homeBonusMin + extra,
        12,
      );
      expect(homeAdvantage({ fans: 100, derby }, params)).toBeCloseTo(
        homeBase + homeBonusMax + extra,
        12,
      );
    }
    // The same match with the home club's thermometer at 0 and at 100: the match receives it.
    const state = testGame();
    const first = state.fixtures.find((f) => f.round === 1)!;
    for (const fans of [0, 100]) {
      const plan = prepareRound(withFans(state, first.homeId, fans), params);
      if (!plan.ok) throw new Error('prepareRound');
      const match = plan.value.matches.find((m) => m.fixtureId === first.id)!;
      expect(match.home.fans).toBe(fans);
      expect(homeAdvantage({ fans: match.home.fans, derby: match.derby }, params)).toBeCloseTo(
        homeBase + (fans === 0 ? homeBonusMin : homeBonusMax) + (match.derby ? derbyBonus : 0),
        12,
      );
    }
  });
});

describe('US-026: the morale drifts towards the thermometer', () => {
  /** An injured player of the coach's club (no result, no bench), with this morale. */
  function drifting(morale: number, fans: number, trait: Player['trait'] = 'quiet') {
    const state = withFans(testGame(), COACH, fans);
    const id = state.squads[COACH]![3]!;
    const s = withPlayers(state, (p) =>
      p.id === id ? { morale, trait, injuryRounds: 2 } : undefined,
    );
    return play(s).value.state.players[id]!.morale;
  }

  it('morale 40 with the thermometer at 80: 40 + fans.moraleDrift after a round', () => {
    expect(drifting(40, 80)).toBe(40 + fansParams.moraleDrift);
    expect(fansParams.moraleDrift).toBe(1);
  });

  it('never past the thermometer: 79.5 with the fans at 80 goes to 80.0', () => {
    expect(drifting(79.5, 80)).toBe(80);
    expect(drifting(80.25, 80)).toBe(80);
    expect(drifting(99.5, 100)).toBe(100);
  });

  it('the same for every trait, up and down; nothing when equal', () => {
    expect(drifting(70, 30)).toBe(69);
    expect(drifting(70, 30, 'professional')).toBe(69);
    expect(drifting(60, 40, 'professional')).toBe(59);
    expect(drifting(40, 80, 'professional')).toBe(41);
    expect(drifting(70, 30, 'hothead')).toBe(69);
    expect(drifting(60, 60)).toBe(60);
    expect(drifting(100, 100)).toBe(100);
    expect(drifting(0, 0)).toBe(0);
  });
});

describe("US-026: the coach's decisions (fanDecisions)", () => {
  const human = { coaches: { [COACH]: 'result' as const } };

  it('added to the thermometer of his club after the round, limited to ±fans.decisionCap', () => {
    const state = testGame();
    const plain = play(state, human).value.state.clubs[COACH]!.fans;
    const at = (value: number) =>
      play(state, { ...human, fanDecisions: { [COACH]: value } }).value.state.clubs[COACH]!.fans;
    expect(at(2)).toBeCloseTo(plain + 2, 10);
    expect(at(-1)).toBeCloseTo(plain - 1, 10);
    expect(at(9)).toBeCloseTo(plain + fansParams.decisionCap, 10);
    expect(at(-9)).toBeCloseTo(plain - fansParams.decisionCap, 10);
    // The decisions come after the round: the matches are the same.
    const a = play(state, human).value.report.results;
    const b = play(state, { ...human, fanDecisions: { [COACH]: 3 } }).value.report.results;
    expect(b).toEqual(a);
    // Only the club that made them moves.
    const other = play(state, { ...human, fanDecisions: { [COACH]: 3 } }).value.state.clubs;
    for (const [id, club] of Object.entries(play(state, human).value.state.clubs)) {
      if (id !== COACH) expect(other[id]!.fans).toBe(club.fans);
    }
    // A club in `sheets` is human too.
    const plan = prepareRound(state, params, human);
    if (!plan.ok) throw new Error('prepareRound');
    const sheets = { [COACH]: plan.value.suggested[COACH]! };
    const bySheet = (value: number) =>
      play(state, { sheets, fanDecisions: { [COACH]: value } }).value.state.clubs[COACH]!.fans;
    expect(bySheet(2)).toBeCloseTo(bySheet(0) + 2, 10);
  });

  it('a key of an AI club does not move its thermometer and gives a warning', () => {
    const state = testGame();
    const plain = play(state, human).value.state;
    const played = play(state, { ...human, fanDecisions: { 'clube-teste-01': 3 } });
    expect(played.warnings).toContainEqual({
      code: 'round-fan-decision-not-human',
      detail: { clubId: 'clube-teste-01' },
    });
    expect(played.value.state.clubs).toEqual(plain.clubs);
    // Without any human club, the coach's own key is an AI key too.
    const noHuman = play(state, { fanDecisions: { [COACH]: 3 } });
    expect(noHuman.warnings).toContainEqual({
      code: 'round-fan-decision-not-human',
      detail: { clubId: COACH },
    });
    expect(noHuman.value.state.clubs).toEqual(play(state).value.state.clubs);
  });

  it('ignores, with a warning, a club not in the state and a value that is not a number', () => {
    const state = testGame();
    const plain = play(state, human).value.state;
    const played = play(state, {
      ...human,
      fanDecisions: { nowhere: 2, [COACH]: Number.NaN, 'clube-teste-01': undefined },
    });
    expect(played.warnings).toContainEqual({
      code: 'round-unknown-club',
      detail: { clubId: 'nowhere' },
    });
    expect(played.warnings).toContainEqual({
      code: 'round-invalid-fan-decision',
      detail: { clubId: COACH, value: 'NaN' },
    });
    expect(played.value.state.clubs).toEqual(plain.clubs);
    // Inherited keys are not decisions.
    const inherited = Object.create({ [COACH]: 4 }) as Record<ClubId, number>;
    expect(play(state, { ...human, fanDecisions: inherited }).value.state.clubs).toEqual(
      plain.clubs,
    );
  });
});

describe('the idol left on the bench (idolBenchStreak)', () => {
  /** The sheet without `id`: a starter is replaced by the first substitute. */
  function without(sheet: TeamSheet, id: PlayerId): TeamSheet {
    const { lineup } = sheet;
    const drop = (xs: readonly PlayerId[]) => xs.filter((x) => x !== id);
    let bench = drop(lineup.bench);
    const starters = [...lineup.starters];
    const at = starters.indexOf(id);
    if (at >= 0) {
      starters[at] = bench[0]!;
      bench = bench.slice(1);
    }
    return {
      ...sheet,
      lineup: {
        ...lineup,
        starters,
        bench,
        captains: drop(lineup.captains),
        penaltyTakers: drop(lineup.penaltyTakers),
        freeKickTakers: drop(lineup.freeKickTakers),
      },
    };
  }

  function benchIdol(state: GameState, decisions: Partial<Record<ClubId, number>> = {}) {
    const idol = clubIdol(state.squads[COACH]!, state.players)!;
    const plan = prepareRound(state, params, { coaches: { [COACH]: 'full' } });
    if (!plan.ok) throw new Error('prepareRound');
    const sheet = without(plan.value.suggested[COACH]!, idol.id);
    return play(state, {
      coaches: { [COACH]: 'full' },
      sheets: { [COACH]: sheet },
      fanDecisions: decisions,
    }).value.state;
  }

  it(`−1 from the ${IDOL_BENCH.fromStreak}nd round in a row, after the cap of the decisions`, () => {
    const humans = new Set([COACH]);
    let s = testGame();
    for (let r = 1; r <= 3; r++) {
      const before = s;
      s = benchIdol(s);
      expect(s.clubs[COACH]!.idolBenchStreak).toBe(r);
      const want = expectedFans(before, s, {}, humans).get(COACH)!;
      expect(s.clubs[COACH]!.fans, `round ${r}`).toBe(want.fans);
      expect(want.decisions).toBe(r >= 2 ? -1 : 0);
    }
    // 2nd round on the bench with +6 of the coach: min(6, 4) − 1 = +3; with −6: −4 − 1 = −5.
    const first = benchIdol(testGame());
    for (const [given, part] of [
      [6, 3],
      [-6, -5],
    ] as const) {
      const second = benchIdol(first, { [COACH]: given });
      expect(second.clubs[COACH]!.idolBenchStreak).toBe(2);
      const want = expectedFans(first, second, { [COACH]: given }, humans).get(COACH)!;
      expect(want.decisions).toBe(part);
      expect(second.clubs[COACH]!.fans).toBe(want.fans);
      // Against the same round without decisions: the coach's part is +4 or −4, the idol's stays.
      const none = benchIdol(first);
      expect(second.clubs[COACH]!.fans - none.clubs[COACH]!.fans).toBeCloseTo(part + 1, 10);
    }
    // On the pitch again: the streak is over.
    const back = play(s, { coaches: { [COACH]: 'full' } }).value.state;
    const idol = clubIdol(s.squads[COACH]!, s.players)!;
    expect(back.lastRound!.results.some((x) => idol.id in x.minutes)).toBe(true);
    expect(back.clubs[COACH]!.idolBenchStreak).toBe(0);
  });

  it('in an AI club the streak stays at 0, even when its idol stays off the pitch', () => {
    const state = testGame();
    const idol = clubIdol(state.squads[COACH]!, state.players)!;
    // A fit idol the AI never picks (overall 20): off the pitch 4 rounds in a row.
    let s = withPlayers(state, (p) => (p.id === idol.id ? { overall: 20 } : undefined));
    let human = withPlayers(state, (p) => (p.id === idol.id ? { overall: 20 } : undefined));
    for (let r = 1; r <= 4; r++) {
      s = play(s).value.state;
      expect(s.lastRound!.results.some((x) => idol.id in x.minutes)).toBe(false);
      expect(s.players[idol.id]!.injuryRounds + s.players[idol.id]!.suspendedGames).toBe(0);
      expect(s.clubs[COACH]!.idolBenchStreak).toBe(0);
      // The same club as the coach's ("só resultado": the AI picks for him) does count.
      human = play(human, { coaches: { [COACH]: 'result' } }).value.state;
      expect(human.clubs[COACH]!.idolBenchStreak).toBe(r);
    }
  });

  it('an injured idol is not left on the bench by anyone: no streak', () => {
    const state = testGame();
    const idol = clubIdol(state.squads[COACH]!, state.players)!;
    let s = withPlayers(state, (p) => (p.id === idol.id ? { injuryRounds: 3 } : undefined));
    for (let r = 1; r <= 3; r++) {
      s = play(s).value.state;
      expect(s.clubs[COACH]!.idolBenchStreak).toBe(0);
    }
  });
});

describe('determinism of the morale, the form and the thermometer', () => {
  it('the same state, params and inputs give the same states, and the inputs never change', () => {
    const run = (realism: 'full' | 'simplified') => {
      let state: GameState = { ...testGame(77), rules: { realism } };
      const frozen = JSON.stringify(state);
      const start = state;
      const states: string[] = [];
      for (let r = 1; r <= 12; r++) {
        const decisions = { [COACH]: (r % 5) - 2, 'clube-teste-01': r % 2 === 0 ? 4 : -4 };
        state = play(state, { fanDecisions: decisions, coaches: { [COACH]: 'result' } }).value
          .state;
        states.push(JSON.stringify(state));
      }
      expect(JSON.stringify(start)).toBe(frozen);
      return states;
    };
    for (const realism of ['full', 'simplified'] as const)
      expect(run(realism)).toEqual(run(realism));
  });
});

describe('playRound shares the tables with the facts', () => {
  it('roundFacts with the tables given is the same as without them', () => {
    const all = season(20261104);
    for (const r of [1, 6, 20, 37, 38]) {
      const state = all[r]!;
      const results = state.lastRound!.results;
      const facts = roundFacts(state, r, results, roundTables(state, r));
      expect(facts).toEqual(roundFacts(state, r, results));
      expect(facts).toEqual(state.lastRound!.facts);
    }
  });
});
