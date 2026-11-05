import { describe, expect, it } from 'vitest';
import { daysBetween } from './fixtures.ts';
import type { GameState } from './game.ts';
import type { TeamSheet } from './lineup.ts';
import type { MatchResult } from './match/types.ts';
import { RECENT_RATINGS_MAX, type Player } from './players.ts';
import {
  nextRecentRatings,
  playRound,
  prepareRound,
  ROUND_MORALE,
  roundMoraleDeltas,
  type RoundInput,
} from './round.ts';
import { simulateMatch } from './match/simulate.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { PlayerId, Trait } from './types.ts';
import { reportOf, trackRound } from './testing/reports.ts';

/*
 * Form, morale and fatigue between rounds (US-010; jogadores.md, "Moral por rodada" and "Estados
 * que mudam"; T-014). The whole table against an independent reading over 38 rounds is in
 * round.test.ts ("every morale follows the table"); the bounds over random seasons are in
 * round.property.test.ts; the drift towards the fans (US-026) is in fans.test.ts.
 */

const params = testParams();
const COACH = 'clube-teste-05';

function input(round: number, extra: Partial<RoundInput> = {}): RoundInput {
  return { round, sheets: {}, commands: {}, fanDecisions: {}, ...extra };
}

function play(state: GameState, extra: Partial<RoundInput> = {}) {
  const result = trackRound(playRound(state, params, input(state.round, extra)));
  if (!result.ok) throw new Error(`playRound: ${result.error}`);
  return result.value;
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

/** The sheet without `id`: a starter is replaced by the first substitute, the lists drop him. */
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

/** Plays a round with the coach's club leaving `id` out of the sheet (the AI's suggestion). */
function playWithout(state: GameState, id: PlayerId) {
  const plan = prepareRound(state, params, { coaches: { [COACH]: 'full' } });
  if (!plan.ok) throw new Error('prepareRound');
  const sheet = without(plan.value.suggested[COACH]!, id);
  return play(state, { coaches: { [COACH]: 'full' }, sheets: { [COACH]: sheet } });
}

/** The chained season of the AI (cached). */
const chain = new Map<number, GameState[]>();
function season(seed: number): GameState[] {
  const cached = chain.get(seed);
  if (cached !== undefined) return cached;
  const states = [testGame(seed)];
  for (let r = 1; r <= 38; r++) states.push(play(states[r - 1]!).state);
  chain.set(seed, states);
  return states;
}

/** jogadores.md (revised): up to 1 point towards the thermometer, never past it. */
const drift = (fans: number, morale: number) => Math.max(-1, Math.min(1, fans - morale));

describe('US-010: fatigue goes up when playing and down when resting', () => {
  it('a 90-minute player before a midweek round is tired; the round he rests, he recovers', () => {
    const all = season(20261104);
    let rose = 0;
    let fell = 0;
    for (let r = 1; r < 38; r++) {
      const before = all[r - 1]!;
      const after = all[r]!;
      const next = all[r + 1]!;
      const today = before.fixtures.find((f) => f.round === r)!.date;
      const gap = daysBetween(today, before.fixtures.find((f) => f.round === r + 1)!.date)!;
      const minutes: Record<PlayerId, number> = {};
      for (const res of reportOf(after).results) Object.assign(minutes, res.minutes);
      const nextMinutes: Record<PlayerId, number> = {};
      for (const res of reportOf(next).results) Object.assign(nextMinutes, res.minutes);
      for (const [id, p] of Object.entries(after.players)) {
        const fatigueBefore = 100 - before.players[id]!.condition;
        const fatigue = 100 - p.condition;
        // An outfield player who played 90 minutes with only 3 days to the next round: more
        // tired than before (a goalkeeper spends 30% of it, and 3 days give it back).
        if (minutes[id] === 90 && gap === 3 && fatigueBefore === 0 && p.position !== 'GK') {
          expect(fatigue, `round ${r}, ${id}`).toBeGreaterThan(fatigueBefore);
          rose++;
        }
        // Tired and not on the pitch in the next round: less tired after it.
        if (fatigue > 0 && !(id in nextMinutes) && r + 1 < 38) {
          expect(100 - next.players[id]!.condition, `round ${r + 1}, ${id}`).toBeLessThan(fatigue);
          fell++;
        }
      }
    }
    expect(rose).toBeGreaterThan(50);
    expect(fell).toBeGreaterThan(10);
  });
});

describe('US-010: a long spell on the bench lowers the morale', () => {
  /** The coach's best outfield starter, as quiet, hothead or professional, with morale 60. */
  function benchedSetup(trait: Trait) {
    const base = testGame();
    const plan = prepareRound(base, params, { coaches: { [COACH]: 'full' } });
    if (!plan.ok) throw new Error('prepareRound');
    const starters = plan.value.suggested[COACH]!.lineup.starters.map((id) => base.players[id]!);
    const star = starters
      .filter((p) => p.position !== 'GK')
      .sort((a, b) => b.overall - a.overall || (a.id < b.id ? -1 : 1))[0]!;
    // Nobody else is the idol, so the trait of the star is the only one that matters here.
    const state = withPlayers(base, (p) =>
      p.id === star.id
        ? { trait, morale: 60 }
        : p.trait === 'idol'
          ? { trait: 'quiet' }
          : undefined,
    );
    return { state, id: star.id };
  }

  for (const [trait, perRound] of [
    ['quiet', ROUND_MORALE.benched],
    ['hothead', ROUND_MORALE.benched * ROUND_MORALE.hotheadBenchMult],
    ['professional', ROUND_MORALE.benched * ROUND_MORALE.professionalDropMult],
  ] as const) {
    it(`${trait}: nothing in the 1st round, ${perRound} per round from the 2nd`, () => {
      const { state, id } = benchedSetup(trait);
      expect(perRound).toBe(trait === 'quiet' ? -2 : trait === 'hothead' ? -4 : -1);
      let s = state;
      for (let r = 1; r <= 4; r++) {
        const before = s;
        s = playWithout(s, id).state;
        const p = s.players[id]!;
        expect(p.benchStreak).toBe(r);
        // The drift is the same for every trait; only the bench is halved for a professional.
        const d = drift(before.clubs[COACH]!.fans, before.players[id]!.morale);
        const bench = r >= ROUND_MORALE.benchedFromStreak ? perRound : 0;
        expect(p.morale, `round ${r}`).toBe(before.players[id]!.morale + bench + d);
      }
      // Back on the pitch: the streak is over.
      const back = play(s, { coaches: { [COACH]: 'full' } });
      expect(
        Object.keys(reportOf(back.state).results.find((x) => id in x.minutes)!.minutes),
      ).toContain(id);
      expect(back.state.players[id]!.benchStreak).toBe(0);
    });
  }

  it('an injured or suspended player does not expect to play: no streak, no drop', () => {
    const { state, id } = benchedSetup('quiet');
    let s = withPlayers(state, (p) =>
      p.id === id ? { injuryRounds: 3, benchStreak: 5 } : undefined,
    );
    for (let r = 1; r <= 3; r++) {
      const before = s;
      s = play(s).state;
      expect(s.players[id]!.benchStreak).toBe(0);
      const d = drift(before.clubs[COACH]!.fans, before.players[id]!.morale);
      expect(s.players[id]!.morale).toBe(before.players[id]!.morale + d);
    }
    const suspended = withPlayers(state, (p) =>
      p.id === id ? { suspendedGames: 1, benchStreak: 4 } : undefined,
    );
    expect(play(suspended).state.players[id]!.benchStreak).toBe(0);
  });

  it('who does not expect to play (overall below the XI mean − 3) has no streak', () => {
    const all = season(20261104);
    let checked = 0;
    for (let r = 1; r <= 5; r++) {
      const before = all[r - 1]!;
      const after = all[r]!;
      for (const res of reportOf(after).results) {
        const fixture = before.fixtures.find((f) => f.id === res.fixtureId)!;
        for (const clubId of [fixture.homeId, fixture.awayId]) {
          const squad = before.squads[clubId]!;
          const cameOn = new Set(
            res.events.flatMap((e) => (e.type === 'substitution' ? [e.in] : [])),
          );
          const xi = squad.filter((id) => id in res.minutes && !cameOn.has(id));
          const mean = xi.reduce((s, id) => s + before.players[id]!.overall, 0) / xi.length;
          for (const id of squad) {
            const p = before.players[id]!;
            if (id in res.minutes || p.overall >= mean - 3) continue;
            expect(after.players[id]!.benchStreak).toBe(0);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe('US-010: the result moves the morale', () => {
  /** Round 1 of the coach's club, then its result rewritten as a win or a defeat by 3 to 0. */
  function round1() {
    const state = testGame();
    const plan = prepareRound(state, params);
    if (!plan.ok) throw new Error('prepareRound');
    const matches = plan.value.matches;
    const results = matches.map((m) => simulateMatch(m, params));
    const i = matches.findIndex((m) => m.home.clubId === COACH || m.away.clubId === COACH);
    const home = matches[i]!.home.clubId === COACH;
    const withScore = (own: number, other: number): MatchResult[] =>
      results.map((r, k) => (k === i ? { ...r, score: home ? [own, other] : [other, own] } : r));
    return { state, matches, results, i, withScore };
  }

  it('same squad, same seed: the mean morale is higher after a win than after a defeat', () => {
    const { state, matches, results, i, withScore } = round1();
    const squad = state.squads[COACH]!;
    const mean = (rs: MatchResult[]) => {
      const deltas = roundMoraleDeltas(state, params, matches, rs);
      return (
        squad.reduce(
          (s, id) =>
            s + Math.max(0, Math.min(100, state.players[id]!.morale + (deltas.get(id) ?? 0))),
          0,
        ) / squad.length
      );
    };
    const win = mean(withScore(3, 0));
    const loss = mean(withScore(0, 3));
    expect(win).toBeGreaterThan(loss);
    // Who took the pitch: +3 against −3 (−1.5 for a professional); the others do not change.
    const w = roundMoraleDeltas(state, params, matches, withScore(3, 0));
    const l = roundMoraleDeltas(state, params, matches, withScore(0, 3));
    const d = roundMoraleDeltas(state, params, matches, withScore(1, 1));
    for (const id of squad) {
      const played = id in results[i]!.minutes;
      const p = state.players[id]!;
      const gap = (w.get(id) ?? 0) - (l.get(id) ?? 0);
      expect(gap, id).toBe(played ? (p.trait === 'professional' ? 4.5 : 6) : 0);
      expect((w.get(id) ?? 0) - (d.get(id) ?? 0), id).toBe(played ? 3 : 0);
    }
  });

  it('a derby doubles the result, for both sides', () => {
    const { state, matches, results, i, withScore } = round1();
    const derby = matches.map((m, k) => (k === i ? { ...m, derby: true } : m));
    const plain = roundMoraleDeltas(state, params, matches, withScore(2, 0));
    const doubled = roundMoraleDeltas(state, params, derby, withScore(2, 0));
    const other = matches[i]!.home.clubId === COACH ? matches[i]!.away : matches[i]!.home;
    let checked = 0;
    for (const id of [...state.squads[COACH]!, ...state.squads[other.clubId]!]) {
      if (!(id in results[i]!.minutes)) continue;
      const p = state.players[id]!;
      const won = state.squads[COACH]!.includes(id);
      const base = won ? 3 : p.trait === 'professional' ? -1.5 : -3;
      expect((doubled.get(id) ?? 0) - (plain.get(id) ?? 0), id).toBe(base);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(22);
  });

  it('over a season, who played a win gains and who played a defeat loses, against the rest', () => {
    const all = season(20261104);
    let win = 0;
    let loss = 0;
    let nWin = 0;
    let nLoss = 0;
    for (let r = 1; r <= 38; r++) {
      const before = all[r - 1]!;
      const after = all[r]!;
      for (const res of reportOf(after).results) {
        const fixture = before.fixtures.find((f) => f.id === res.fixtureId)!;
        for (const [clubId, own, other] of [
          [fixture.homeId, res.score[0], res.score[1]],
          [fixture.awayId, res.score[1], res.score[0]],
        ] as const) {
          if (own === other) continue;
          for (const id of before.squads[clubId]!) {
            if (!(id in res.minutes)) continue;
            const change = after.players[id]!.morale - before.players[id]!.morale;
            if (own > other) {
              win += change;
              nWin++;
            } else {
              loss += change;
              nLoss++;
            }
          }
        }
      }
    }
    expect(win / nWin).toBeGreaterThan(1.5);
    expect(loss / nLoss).toBeLessThan(-1.5);
  });
});

describe('US-010: the form (recentRatings, display only)', () => {
  it('keeps the last 5 ratings, oldest first, and skips a match without a rating', () => {
    expect(nextRecentRatings([], 6.5)).toEqual([6.5]);
    expect(nextRecentRatings([6, 7, 8, 9, 5], 4)).toEqual([7, 8, 9, 5, 4]);
    expect(nextRecentRatings([6, 7], null)).toEqual([6, 7]);
    expect(nextRecentRatings([6, 7], undefined)).toEqual([6, 7]);
    expect(nextRecentRatings([6], Number.NaN)).toEqual([6]);
    expect(RECENT_RATINGS_MAX).toBe(5);
  });

  it('over a season, every player has the ratings of his last 5 rated matches', () => {
    const all = season(20261104);
    const history = new Map<PlayerId, number[]>();
    for (let r = 1; r <= 38; r++) {
      for (const res of reportOf(all[r]!).results) {
        for (const [id, rating] of Object.entries(res.ratings)) {
          if (rating === null) continue;
          history.set(id, [...(history.get(id) ?? []), rating]);
        }
      }
      for (const [id, p] of Object.entries(all[r]!.players)) {
        expect(p.recentRatings, `round ${r}, ${id}`).toEqual((history.get(id) ?? []).slice(-5));
      }
    }
    // Somebody had a match "sem nota" (under 15 minutes) and kept his list.
    const unrated = all
      .slice(1)
      .some((s) => reportOf(s).results.some((x) => Object.values(x.ratings).includes(null)));
    expect(unrated).toBe(true);
  });
});

describe('jogadores.md (revised): the professional halves result and bench, never the drift', () => {
  /** Round 1 of the coach's club with one professional who played, and his drift set. */
  function professional(morale: number, fans: number, derby: boolean, own: number, other: number) {
    const base = testGame();
    const plan = prepareRound(base, params);
    if (!plan.ok) throw new Error('prepareRound');
    const matches = plan.value.matches.map((m) =>
      m.home.clubId === COACH || m.away.clubId === COACH ? { ...m, derby } : m,
    );
    const results = plan.value.matches.map((m) => simulateMatch(m, params));
    const i = matches.findIndex((m) => m.home.clubId === COACH || m.away.clubId === COACH);
    const home = matches[i]!.home.clubId === COACH;
    const scored = results.map((r, k) =>
      k === i ? { ...r, score: (home ? [own, other] : [other, own]) as [number, number] } : r,
    );
    const id = Object.keys(results[i]!.minutes).find((x) => x.startsWith(`${COACH}#`))!;
    const changed = withPlayers(base, (p) =>
      p.id === id ? { trait: 'professional', morale } : undefined,
    );
    const state: GameState = {
      ...changed,
      clubs: { ...changed.clubs, [COACH]: { ...changed.clubs[COACH]!, fans } },
    };
    return roundMoraleDeltas(state, params, matches, scored).get(id) ?? 0;
  }

  it('a win (+3) with the drift down (−1) gives +2, as for anyone', () => {
    expect(professional(70, 30, false, 2, 0)).toBe(2);
  });

  it('a defeat (−3 → −1.5) with the drift up (+1) gives −0.5', () => {
    expect(professional(30, 70, false, 0, 1)).toBe(-0.5);
  });

  it('a derby defeat (−6 → −3) with the drift down (−1) gives −4', () => {
    expect(professional(70, 30, true, 0, 2)).toBe(-4);
  });

  it('a professional who did not play, morale 60 and thermometer 40, drops 1', () => {
    const state = testGame();
    const id = state.squads[COACH]![3]!;
    const s = withPlayers(
      { ...state, clubs: { ...state.clubs, [COACH]: { ...state.clubs[COACH]!, fans: 40 } } },
      (p) => (p.id === id ? { trait: 'professional', morale: 60, injuryRounds: 2 } : undefined),
    );
    expect(play(s).state.players[id]!.morale).toBe(59);
  });
});
