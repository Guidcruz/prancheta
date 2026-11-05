import { describe, expect, it } from 'vitest';
import { suggestSheet, validateLineup } from './ai.ts';
import { daysBetween } from './fixtures.ts';
import type { GameState } from './game.ts';
import { simulateMatch } from './match/simulate.ts';
import type { MatchCommand, MatchInput, MatchResult } from './match/types.ts';
import type { Player } from './players.ts';
import { seedFromString } from './rng.ts';
import {
  DEFAULT_STADIUM_CAPACITY,
  playRound,
  prepareRound,
  ROUND_MORALE,
  type RoundInput,
} from './round.ts';
import { getStandings } from './standings.ts';
import { shownEleven, teamStrength } from './strength.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { ClubId, PlayerId, Side } from './types.ts';

/*
 * The round (US-012; temporada.md, "Ordem do processamento de uma rodada"; T-013): prepareRound
 * and playRound with the synthetic clubs. The 38 rounds with the 20 real clubs are in
 * app/src/data/season.ai.e2e.test.ts.
 */

const params = testParams();
const COACH = 'clube-teste-05';

function input(round: number, extra: Partial<RoundInput> = {}): RoundInput {
  return { round, sheets: {}, commands: {}, fanDecisions: {}, ...extra };
}

function play(state: GameState, extra: Partial<RoundInput> = {}) {
  const result = playRound(state, params, input(state.round, extra));
  if (!result.ok) throw new Error(`playRound: ${result.error}`);
  return result;
}

/** The state after `rounds` rounds played by the AI (cached: tests never change it). */
const chained = new Map<number, GameState[]>();
function season(seed: number): GameState[] {
  const cached = chained.get(seed);
  if (cached !== undefined) return cached;
  const states = [testGame(seed)];
  for (let r = 1; r <= 38; r++) states.push(play(states[r - 1]!).value.state);
  chained.set(seed, states);
  return states;
}

const SEED = 20261104;
const states = () => season(SEED);

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

function fieldedIds(match: MatchInput): Set<PlayerId> {
  return new Set(
    [match.home, match.away].flatMap((t) => [...t.sheet.lineup.starters, ...t.sheet.lineup.bench]),
  );
}

function sideOf(match: MatchInput, clubId: ClubId): Side | undefined {
  return match.home.clubId === clubId ? 'home' : match.away.clubId === clubId ? 'away' : undefined;
}

describe('playRound: the table (US-012)', () => {
  it('each club has exactly one more game, and the numbers match the scores', () => {
    const [before, after] = states();
    const report = after!.lastRound!;
    expect(report.round).toBe(1);
    expect(report.season).toBe(1);
    expect(report.results).toHaveLength(10);
    expect(after!.round).toBe(2);
    const table = getStandings(after!);
    expect(table).toHaveLength(20);
    for (const row of table) expect(row.played).toBe(1);
    const fixtures = before!.fixtures.filter((f) => f.round === 1);
    for (const result of report.results) {
      const f = fixtures.find((x) => x.id === result.fixtureId)!;
      const [h, a] = result.score;
      const home = table.find((r) => r.clubId === f.homeId)!;
      const away = table.find((r) => r.clubId === f.awayId)!;
      expect([home.goalsFor, home.goalsAgainst, away.goalsFor, away.goalsAgainst]).toEqual([
        h,
        a,
        a,
        h,
      ]);
      expect(home.points).toBe(h > a ? 3 : h === a ? 1 : 0);
      expect(away.points).toBe(a > h ? 3 : h === a ? 1 : 0);
      expect(home.wins + home.draws + home.losses).toBe(1);
      expect(home.yellows).toBe(result.stats.home.yellows);
      expect(away.reds).toBe(result.stats.away.reds);
      expect(after!.fixtures.find((x) => x.id === f.id)!.result!.score).toEqual([h, a]);
    }
  });

  it('keeps the goals with their scorers in the fixture (US-024)', () => {
    const after = states()[1]!;
    for (const result of after.lastRound!.results) {
      const summary = after.fixtures.find((f) => f.id === result.fixtureId)!.result!;
      const goals = result.events.filter((e) => e.type === 'goal');
      expect(summary.goals.map((g) => g.scorer)).toEqual(goals.map((g) => g.scorer));
      expect(summary.goals.filter((g) => g.side === 'home').length).toBeGreaterThanOrEqual(0);
      expect(summary.stats).toEqual(result.stats);
    }
  });

  it('38 rounds in a row: every fixture played, 38 games each, then the season is over', () => {
    const all = states();
    const last = all[38]!;
    expect(last.round).toBe(39);
    expect(last.fixtures.every((f) => f.result !== undefined)).toBe(true);
    for (const row of getStandings(last)) expect(row.played).toBe(38);
    const points = getStandings(last).reduce((sum, r) => sum + r.points, 0);
    const draws = last.fixtures.filter((f) => f.result!.score[0] === f.result!.score[1]).length;
    expect(points).toBe(3 * 380 - draws);
    expect(playRound(last, params, input(39))).toMatchObject({ ok: false, error: 'season-over' });
    expect(prepareRound(last, params)).toMatchObject({ ok: false, error: 'season-over' });
    for (const p of Object.values(last.players)) {
      expect(p.condition).toBeGreaterThanOrEqual(0);
      expect(p.condition).toBeLessThanOrEqual(100);
      expect(p.morale).toBeGreaterThanOrEqual(0);
      expect(p.morale).toBeLessThanOrEqual(100);
      expect([0, 1, 2]).toContain(p.yellowCount);
    }
  });

  it('never fields an AI player who is injured or suspended, and every sheet validates', () => {
    const all = states();
    for (let r = 1; r <= 38; r++) {
      const plan = prepareRound(all[r - 1]!, params);
      if (!plan.ok) throw new Error('prepareRound');
      for (const match of plan.value.matches) {
        for (const team of [match.home, match.away]) {
          expect(validateLineup(all[r - 1]!, team.clubId, team.sheet).ok).toBe(true);
        }
      }
    }
  });
});

describe('playRound: idempotence and determinism', () => {
  it('a round already played returns "rodada já processada" and changes nothing', () => {
    const [, after] = states();
    const copy = JSON.stringify(after);
    expect(playRound(after!, params, input(1))).toEqual({
      ok: false,
      error: 'round-already-played',
      detail: { round: 1, next: 2 },
    });
    expect(JSON.stringify(after)).toBe(copy);
    expect(playRound(after!, params, input(3))).toMatchObject({
      ok: false,
      error: 'round-not-open',
    });
  });

  it('the same input on the same state gives the same state and report, without changing them', () => {
    const before = testGame(99);
    const frozen = JSON.stringify(before);
    const commands = { never: [] };
    const a = playRound(before, params, input(1, { commands }));
    const b = playRound(before, params, input(1, { commands }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(before)).toBe(frozen);
    // A different career seed gives different matches.
    const other = play(testGame(100)).value.report.results.map((r) => r.score.join('x'));
    const mine = a.ok ? a.value.report.results.map((r) => r.score.join('x')) : [];
    expect(other).not.toEqual(mine);
  });

  it('each match has its own seed with the season in the label, so the order does not matter', () => {
    const state = testGame();
    const plan = prepareRound(state, params);
    if (!plan.ok) throw new Error('prepareRound');
    for (const m of plan.value.matches) {
      const [home, away] = [m.home.clubId, m.away.clubId];
      expect(m.seed).toBe(seedFromString(`${state.seed}-s1-r1-${home}-${away}`));
    }
    const next = prepareRound({ ...state, season: 2 }, params);
    if (!next.ok) throw new Error('prepareRound');
    expect(next.value.matches[0]!.seed).not.toBe(plan.value.matches[0]!.seed);
    const forward = plan.value.matches.map((m) => simulateMatch(m, params));
    const backward = [...plan.value.matches]
      .reverse()
      .map((m) => simulateMatch(m, params))
      .reverse();
    expect(backward).toEqual(forward);
    expect(play(state).value.report.results).toEqual(forward);
  });
});

describe('playRound: suspensions (US-009)', () => {
  it('a suspended player misses the next game of his club, then the counter is served', () => {
    const state = testGame();
    const plan = prepareRound(state, params);
    if (!plan.ok) throw new Error('prepareRound');
    const star = plan.value.matches[0]!.home.sheet.lineup.starters[5]!;
    const suspended = withPlayers(state, (p) =>
      p.id === star ? { suspendedGames: 2 } : undefined,
    );
    const round1 = prepareRound(suspended, params);
    if (!round1.ok) throw new Error('prepareRound');
    expect(fieldedIds(round1.value.matches[0]!).has(star)).toBe(false);
    const after1 = play(suspended).value.state;
    expect(after1.players[star]!.suspendedGames).toBe(1);
    const after2 = play(after1).value.state;
    expect(after2.players[star]!.suspendedGames).toBe(0);
    expect(after2.lastRound!.results.some((r) => star in r.minutes)).toBe(false);
  });

  it('a red card: suspended in the next round, served, and back', () => {
    const all = states();
    let found = 0;
    for (let r = 1; r < 37 && found < 3; r++) {
      for (const result of all[r]!.lastRound!.results) {
        for (const e of result.events) {
          if (e.type !== 'red') continue;
          const id = e.player;
          const games = result.newSuspensions.find((s) => s.player === id)!.games;
          expect(all[r]!.players[id]!.suspendedGames).toBe(games);
          expect(all[r]!.lastRound!.facts).toContainEqual({
            kind: 'suspended',
            playerId: id,
            games,
          });
          // Not fielded while suspended; the counter goes down one per game of his club.
          for (let k = 1; k <= games; k++) {
            expect(all[r + k]!.lastRound!.results.some((x) => id in x.minutes)).toBe(false);
            expect(all[r + k]!.players[id]!.suspendedGames).toBe(games - k);
          }
          found++;
        }
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('the third yellow: suspended in the next round, counter back to 0 after serving', () => {
    const all = states();
    let found = 0;
    for (let r = 1; r < 37 && found < 5; r++) {
      for (const result of all[r]!.lastRound!.results) {
        for (const e of result.events) {
          if (e.type !== 'yellow' || !e.triggersSuspension) continue;
          const id = e.player;
          if (result.events.some((x) => x.type === 'red' && x.player === id)) continue;
          expect(all[r - 1]!.players[id]!.yellowCount).toBe(2);
          expect(all[r]!.players[id]!.yellowCount).toBe(0);
          expect(all[r]!.players[id]!.suspendedGames).toBe(1);
          expect(all[r + 1]!.lastRound!.results.some((x) => id in x.minutes)).toBe(false);
          expect(all[r + 1]!.players[id]!.suspendedGames).toBe(0);
          expect(all[r + 1]!.players[id]!.yellowCount).toBe(0);
          found++;
        }
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('merges the yellow counters: who did not play keeps his', () => {
    const state = withPlayers(testGame(), (p) =>
      p.clubId === COACH ? { yellowCount: 1 } : undefined,
    );
    const after = play(state).value;
    const result = after.report.results.find((r) =>
      Object.keys(r.minutes).some((id) => id.startsWith(`${COACH}#`)),
    )!;
    for (const id of state.squads[COACH]!) {
      const expected = id in result.minutes ? result.yellowCounts[id] : 1;
      expect(after.state.players[id]!.yellowCount).toBe(expected);
    }
  });
});

describe('playRound: injuries (US-009)', () => {
  it('an injured player misses his rounds, one counted per round', () => {
    const state = testGame();
    const plan = prepareRound(state, params);
    if (!plan.ok) throw new Error('prepareRound');
    const id = plan.value.matches[1]!.away.sheet.lineup.starters[2]!;
    let s = withPlayers(state, (p) => (p.id === id ? { injuryRounds: 3 } : undefined));
    for (const left of [2, 1, 0]) {
      const p = prepareRound(s, params);
      if (!p.ok) throw new Error('prepareRound');
      expect(p.value.matches.some((m) => fieldedIds(m).has(id))).toBe(false);
      s = play(s).value.state;
      expect(s.players[id]!.injuryRounds).toBe(left);
    }
    const back = prepareRound(s, params);
    if (!back.ok) throw new Error('prepareRound');
    expect(back.value.matches.some((m) => fieldedIds(m).has(id))).toBe(true);
  });

  it('a new injury of the match is written with its rounds and counted down from the next', () => {
    const all = states();
    let found = 0;
    for (let r = 1; r < 30 && found < 5; r++) {
      for (const result of all[r]!.lastRound!.results) {
        for (const { player, rounds } of result.newInjuries) {
          expect(all[r]!.players[player]!.injuryRounds).toBe(rounds);
          expect(all[r]!.lastRound!.facts).toContainEqual({
            kind: 'injured',
            playerId: player,
            games: rounds,
          });
          for (let k = 1; k <= rounds && r + k <= 38; k++) {
            expect(all[r + k]!.lastRound!.results.some((x) => player in x.minutes)).toBe(false);
            expect(all[r + k]!.players[player]!.injuryRounds).toBe(rounds - k);
          }
          found++;
        }
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('playRound: condition between rounds', () => {
  it('final energy plus recoveryPerDay × the days to the next round, up to 100', () => {
    const all = states();
    for (const r of [1, 3, 4, 8]) {
      const before = all[r - 1]!;
      const after = all[r]!;
      const today = before.fixtures.find((f) => f.round === r)!.date;
      const next = before.fixtures.find((f) => f.round === r + 1)!.date;
      const days = daysBetween(today, next)!;
      const energy: Record<PlayerId, number> = {};
      for (const result of after.lastRound!.results) Object.assign(energy, result.finalEnergy);
      for (const [id, p] of Object.entries(after.players)) {
        const base = energy[id] ?? before.players[id]!.condition;
        expect(p.condition, `round ${r}, ${id}`).toBe(Math.min(100, base + 7 * days));
      }
    }
    // Sunday → Wednesday is 3 days, Wednesday → Sunday 4: a 90-minute player is not back to 100.
    const r3 = all[3]!;
    const tired = r3
      .lastRound!.results.flatMap((x) => Object.entries(x.finalEnergy))
      .find(([, e]) => e < 75);
    expect(tired).toBeDefined();
    expect(r3.players[tired![0]]!.condition).toBeLessThan(100);
  });

  it('no recovery after round 38 (the next season is T-017)', () => {
    const last = states()[38]!;
    for (const result of last.lastRound!.results) {
      for (const [id, e] of Object.entries(result.finalEnergy))
        expect(last.players[id]!.condition).toBe(e);
    }
  });
});

describe('playRound: other bookkeeping', () => {
  it('counts the appearances and the season stats of who took the pitch', () => {
    const [before, after] = states();
    for (const result of after!.lastRound!.results) {
      for (const [id, minutes] of Object.entries(result.minutes)) {
        expect(after!.players[id]!.clubAppearances).toBe(before!.players[id]!.clubAppearances + 1);
        const goals = result.events.filter((e) => e.type === 'goal' && e.scorer === id).length;
        const stats = after!.seasonStats[id]!;
        expect([stats.games, stats.minutes, stats.goals]).toEqual([1, minutes, goals]);
        const rating = result.ratings[id];
        expect(stats.ratedGames).toBe(rating === null ? 0 : 1);
      }
    }
    const last = states()[38]!;
    const goals = Object.values(last.seasonStats).reduce((s, x) => s + x.goals, 0);
    const scored = last.fixtures.reduce((s, f) => s + f.result!.goals.length, 0);
    expect(goals).toBe(scored);
  });

  it('keeps the sheet each club took to the pitch, and the displayed strength reads it', () => {
    const [before, after] = states();
    const plan = prepareRound(before!, params);
    if (!plan.ok) throw new Error('prepareRound');
    expect(Object.keys(before!.lastSheets)).toEqual([]);
    for (const m of plan.value.matches) {
      for (const team of [m.home, m.away]) {
        expect(after!.lastSheets[team.clubId]).toEqual(team.sheet);
        expect(teamStrength(after!, team.clubId)).toBe(
          teamStrength(after!, team.clubId, team.sheet.lineup),
        );
        expect(shownEleven(after!, team.clubId)!.map((x) => x.player.id)).toEqual(
          team.sheet.lineup.starters,
        );
      }
    }
  });

  it('fills the stadium and the derby of each match', () => {
    const state = testGame();
    const plan = prepareRound(state, params);
    if (!plan.ok) throw new Error('prepareRound');
    for (const m of plan.value.matches) {
      const home = state.clubs[m.home.clubId]!;
      expect(m.capacity).toBe(home.def.stadium.capacity);
      expect(m.derby).toBe(home.def.rivals.includes(m.away.clubId));
      expect(m.neutral).toBe(false);
      expect(m.home.fans).toBe(home.fans);
      expect(m.home.players.map((p) => p.id)).toEqual(state.squads[m.home.clubId]);
    }
    // Without a capacity in the list: the default of the club's size.
    const homeId = plan.value.matches[0]!.home.clubId;
    const club = state.clubs[homeId]!;
    const broken: GameState = {
      ...state,
      clubs: {
        ...state.clubs,
        [homeId]: { ...club, def: { ...club.def, stadium: { name: 'x', capacity: Number.NaN } } },
      },
    };
    const p = prepareRound(broken, params);
    expect(p.ok && p.value.matches[0]!.capacity).toBe(DEFAULT_STADIUM_CAPACITY[club.def.size]);
  });

  it('warns about sheets, modes and commands it cannot use', () => {
    const state = testGame();
    const result = playRound(
      state,
      params,
      input(1, {
        coaches: { nowhere: 'full', [COACH]: 'turbo' as 'full' },
        commands: { 's1-r2-x-y': [] },
      }),
    );
    expect(result.ok && result.warnings).toEqual([
      { code: 'round-unknown-club', detail: { clubId: 'nowhere' } },
      { code: 'round-unknown-mode', detail: { clubId: COACH, mode: 'turbo' } },
      { code: 'round-unknown-fixture', detail: { fixtureId: 's1-r2-x-y' } },
    ]);
  });
});

describe('playRound: the coach\'s club (ia-clubes.md, "Clube do técnico humano")', () => {
  const coachMatch = (plan: { matches: readonly MatchInput[] }) =>
    plan.matches.find((m) => sideOf(m, COACH) !== undefined)!;

  it('without a sheet gets the suggestion with the human option, played as traditional', () => {
    const state = testGame();
    const chaotic: GameState = {
      ...state,
      clubs: { ...state.clubs, [COACH]: { ...state.clubs[COACH]!, profile: 'chaotic' } },
    };
    for (const mode of ['full', 'highlights', 'result'] as const) {
      const plan = prepareRound(chaotic, params, {}, { [COACH]: mode });
      if (!plan.ok) throw new Error('prepareRound');
      const match = coachMatch(plan.value);
      const team = sideOf(match, COACH) === 'home' ? match.home : match.away;
      const opponent = team === match.home ? match.away.clubId : match.home.clubId;
      const human = suggestSheet(chaotic, params, COACH, opponent, { controller: 'human' });
      expect(plan.value.suggested[COACH]).toEqual(human);
      expect(team.sheet).toEqual(human);
      expect(team.profile).toBe('traditional');
      expect(team.controller).toBe(mode === 'result' ? 'ai' : 'human');
    }
    // An AI club keeps its own profile and controller.
    const plan = prepareRound(chaotic, params);
    if (!plan.ok) throw new Error('prepareRound');
    const match = coachMatch(plan.value);
    const team = sideOf(match, COACH) === 'home' ? match.home : match.away;
    expect([team.controller, team.profile]).toEqual(['ai', 'chaotic']);
  });

  it('with a sheet plays it (as full when no mode is given)', () => {
    const state = testGame();
    const base = prepareRound(state, params);
    if (!base.ok) throw new Error('prepareRound');
    const sheet = base.value.suggested[COACH]!;
    const mine = {
      ...sheet,
      lineup: { ...sheet.lineup, bench: sheet.lineup.bench.slice(0, 3) },
      tactic: { posture: 'attacking', pressure: 'high' },
    } as const;
    const plan = prepareRound(state, params, { [COACH]: mine });
    if (!plan.ok) throw new Error('prepareRound');
    const match = coachMatch(plan.value);
    const team = sideOf(match, COACH) === 'home' ? match.home : match.away;
    expect(team.sheet).toEqual(mine);
    expect(team.controller).toBe('human');
    const after = play(state, { sheets: { [COACH]: mine } }).value.state;
    expect(after.lastSheets[COACH]).toEqual(mine);
  });

  it('"só resultado": the AI makes the fatigue substitutions for him; animated: only injuries', () => {
    const reasons = (mode: 'result' | 'full') => {
      let s = testGame();
      const out: string[] = [];
      for (let r = 1; r <= 6; r++) {
        const res = play(s, { coaches: { [COACH]: mode } }).value;
        const plan = prepareRound(s, params, {}, { [COACH]: mode });
        if (!plan.ok) throw new Error('prepareRound');
        const i = plan.value.matches.findIndex((m) => sideOf(m, COACH) !== undefined);
        const side = sideOf(plan.value.matches[i]!, COACH);
        for (const e of res.report.results[i]!.events) {
          if (e.type === 'substitution' && e.side === side) out.push(e.reason);
        }
        s = res.state;
      }
      return out;
    };
    const result = reasons('result');
    expect(result.filter((r) => r === 'fatigue').length).toBeGreaterThan(0);
    expect(reasons('full').every((r) => r === 'injury')).toBe(true);
  });

  it('the commands reproduce the match the coach saw live', () => {
    const state = testGame();
    const plan = prepareRound(state, params, {}, { [COACH]: 'full' });
    if (!plan.ok) throw new Error('prepareRound');
    const match = coachMatch(plan.value);
    const side = sideOf(match, COACH)!;
    const team = side === 'home' ? match.home : match.away;
    const commands: MatchCommand[] = [
      { minute: 45, side, kind: 'halftimeTalk', talk: 'motivate' },
      {
        minute: 59,
        side,
        kind: 'substitution',
        out: team.sheet.lineup.starters[9]!,
        in: team.sheet.lineup.bench[6]!,
      },
      { minute: 74, side, kind: 'preset', preset: 'allOut' },
    ];
    // The live screen replays the match with the commands given so far, then the full list.
    const partial = simulateMatch(match, params, commands.slice(0, 1));
    const live = simulateMatch(match, params, commands);
    expect(live.events).not.toEqual(partial.events);
    const after = play(state, {
      coaches: { [COACH]: 'full' },
      commands: { [match.fixtureId]: commands },
    });
    const played = after.value.report.results.find((r) => r.fixtureId === match.fixtureId)!;
    expect(played).toEqual(live);
    expect(played.events).toContainEqual(
      expect.objectContaining({ type: 'substitution', reason: 'tactical', side }),
    );
    expect(after.value.state.fixtures.find((f) => f.id === match.fixtureId)!.result!.score).toEqual(
      live.score,
    );
  });
});

describe('playRound: "Cobrar" and the morale (partida.md, "Cobrar e a moral")', () => {
  /** Who was on the pitch at the half-time whistle, computed from the events. */
  function heardTheTalk(result: MatchResult, squad: Set<PlayerId>): Set<PlayerId> {
    const cameOn = new Set(result.events.flatMap((e) => (e.type === 'substitution' ? [e.in] : [])));
    const pitch = new Set(
      Object.keys(result.minutes).filter((id) => squad.has(id) && !cameOn.has(id)),
    );
    for (const e of result.events) {
      if (e.type === 'halftime') break;
      if (e.type === 'substitution' && squad.has(e.out)) {
        pitch.delete(e.out);
        pitch.add(e.in);
      }
      if ((e.type === 'red' || e.type === 'injury') && squad.has(e.player)) pitch.delete(e.player);
    }
    return pitch;
  }

  function coachRound(talk: 'demand' | 'skip' | 'motivate') {
    const hotheads = withPlayers(testGame(), (p) =>
      p.clubId === COACH ? { trait: 'hothead', morale: 60 } : undefined,
    );
    const plan = prepareRound(hotheads, params, {}, { [COACH]: 'full' });
    if (!plan.ok) throw new Error('prepareRound');
    const match = plan.value.matches.find((m) => sideOf(m, COACH) !== undefined)!;
    const side = sideOf(match, COACH)!;
    const team = side === 'home' ? match.home : match.away;
    const commands: MatchCommand[] = [
      { minute: 45, side, kind: 'halftimeTalk', talk },
      // Off at the interval: he heard the talk. The one coming on did not.
      {
        minute: 45,
        side,
        kind: 'substitution',
        out: team.sheet.lineup.starters[4]!,
        in: team.sheet.lineup.bench[1]!,
      },
    ];
    const after = play(hotheads, {
      coaches: { [COACH]: 'full' },
      commands: { [match.fixtureId]: commands },
    }).value;
    const result = after.report.results.find((r) => r.fixtureId === match.fixtureId)!;
    return { hotheads, after, result, team, commands };
  }

  it('takes 3 from the hotheads on the pitch at the half-time whistle, even if they left later', () => {
    const { hotheads, after, result, team, commands } = coachRound('demand');
    const squad = new Set(hotheads.squads[COACH]);
    const heard = heardTheTalk(result, squad);
    expect(heard.size).toBeGreaterThan(0);
    const sub = commands[1]!;
    if (sub.kind !== 'substitution') throw new Error('sub');
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'substitution', out: sub.out, in: sub.in }),
    );
    expect(heard.has(sub.out)).toBe(true);
    expect(heard.has(sub.in)).toBe(false);
    for (const id of squad) {
      const expected = heard.has(id) ? 60 + ROUND_MORALE.demandTalkHothead : 60;
      expect(after.state.players[id]!.morale, id).toBe(expected);
    }
    expect(team.sheet.lineup.starters.length).toBe(11);
  });

  it('"Pular" and the other talks take nothing', () => {
    for (const talk of ['skip', 'motivate'] as const) {
      const { hotheads, after } = coachRound(talk);
      for (const id of hotheads.squads[COACH]!) expect(after.state.players[id]!.morale).toBe(60);
    }
  });

  it('the AI\'s "Cobrar" counts too, and nothing else moves the morale in T-013', () => {
    const all = states();
    let demanded = 0;
    for (let r = 1; r <= 10; r++) {
      const before = all[r - 1]!;
      const after = all[r]!;
      const expected = new Map<PlayerId, number>();
      for (const result of after.lastRound!.results) {
        for (const e of result.events) {
          if (e.type !== 'halftimeTalk' || e.talk !== 'demand') continue;
          demanded++;
          const fixture = before.fixtures.find((f) => f.id === result.fixtureId)!;
          const club = e.side === 'home' ? fixture.homeId : fixture.awayId;
          for (const id of heardTheTalk(result, new Set(before.squads[club]))) {
            if (before.players[id]!.trait === 'hothead') expected.set(id, -3);
          }
        }
      }
      for (const [id, p] of Object.entries(after.players)) {
        const delta = expected.get(id) ?? 0;
        expect(p.morale).toBe(Math.max(0, Math.min(100, before.players[id]!.morale + delta)));
      }
    }
    expect(demanded).toBeGreaterThan(0);
  });
});
