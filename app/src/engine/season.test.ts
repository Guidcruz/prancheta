import { describe, expect, it } from 'vitest';
import type { GameState } from './game.ts';
import { bestEleven, elevenStrength } from './generation.ts';
import {
  AGE_RANGE,
  computeOverall,
  fitAttributesToOverall,
  validatePlayer,
  type Player,
} from './players.ts';
import { Rng, seedFromString } from './rng.ts';
import { playRound } from './round.ts';
import {
  AWARD_MIN_GAMES,
  MORALE_OFFSEASON_PULL,
  MORALE_TURN_SCALE,
  REVELATION_MAX_AGE,
  TARGET_POSITION_MAX,
  ageCurve,
  careerLeagueTitles,
  endSeason,
  evolutionTarget,
  evolvePlayer,
  moraleAtTurn,
  seasonAwards,
  squadStrength,
  startNextSeason,
  strengthRank,
  targetPosition,
} from './season.ts';
import { getStandings } from './standings.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import { testPlayer } from './testing/players.ts';
import { finishedWith, playedSeason, seasonStats } from './testing/season.ts';
import type { ClubId, PlayerId, Position } from './types.ts';

/*
 * The end of the season and the turn (T-017; docs/design/temporada.md, "Fim de temporada";
 * docs/design/jogadores.md, "Evolução"; US-025, US-068). The rule numbers come from the design
 * documents, so a wrong constant fails here.
 */
const params = testParams();
const identities = fixedIdentitySource();
const SEED = 20261104;

function ended(state: GameState, humans: readonly ClubId[] = []) {
  const r = endSeason(state, params, humans);
  if (!r.ok) throw new Error(`endSeason: ${r.error}`);
  return r.value;
}

function turned(state: GameState): GameState {
  const r = startNextSeason(state, params, identities);
  if (!r.ok) throw new Error(`startNextSeason: ${r.error}`);
  return r.value;
}

/** A copy of `value` without `keys`. */
function omit<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const copy: Partial<T> = { ...value };
  for (const key of keys) delete copy[key];
  return copy as Omit<T, K>;
}

/** Players of the state by natural position, in "menor id" order of the first club. */
function byPosition(state: GameState, position: Position): Player[] {
  return Object.values(state.players).filter((p) => p.position === position);
}

describe('evolution (jogadores.md, "Evolução")', () => {
  it('follows the age curve of the design table', () => {
    const table: [number, number][] = [
      [15, 5],
      [19, 5],
      [20, 4],
      [21, 4],
      [22, 3],
      [23, 3],
      [24, 2],
      [25, 2],
      [26, 1],
      [27, 1],
      [28, 0],
      [30, 0],
      [31, -1],
      [32, -1],
      [33, -2],
      [34, -2],
      [35, -3],
      [60, -3],
    ];
    for (const [ageEff, delta] of table) expect(ageCurve(ageEff), String(ageEff)).toBe(delta);
  });

  it('gives the midfielder of the design example 64 → 71 with no noise', () => {
    // Meia de 20 anos, 64, potencial 80, peakAge 28 (ageEff 19 → +5), growth 1,1, 1.800 minutos
    // (fator 1,18), moral 70 (1,04): 5 × 1,1 × 1,18 × 1,04 = 6,7 → +7, overall 71.
    const meia = { age: 20, overall: 64, potential: 80, peakAge: 28, growth: 1.1, morale: 70 };
    expect(evolutionTarget(meia, 1800, 0)).toBe(71);
    // The ceiling cuts only the positive Δ.
    expect(evolutionTarget({ ...meia, potential: 67 }, 1800, 0)).toBe(67);
    expect(evolutionTarget({ ...meia, potential: 64 }, 1800, 0)).toBe(64);
    // Minutes and morale multiply only a positive Δ: a veteran falls the same either way.
    const veteran = { age: 35, overall: 70, potential: 70, peakAge: 27, growth: 1.2, morale: 100 };
    expect(evolutionTarget(veteran, 3420, 0)).toBe(67);
    expect(evolutionTarget({ ...veteran, morale: 0 }, 0, 0)).toBe(67);
    // At the peak and the potential, only the noise moves it, and only down.
    const peak = { age: 28, overall: 75, potential: 75, peakAge: 27, growth: 1, morale: 60 };
    expect(evolutionTarget(peak, 2000, 0.9)).toBe(75);
    expect(evolutionTarget(peak, 2000, -0.6)).toBe(74);
    // Math.round: −2.5 → −2 and 2.5 → 3.
    expect(evolutionTarget(peak, 0, -2.5)).toBe(73);
    expect(evolutionTarget({ ...peak, potential: 90 }, 0, 2.5)).toBe(78);
    // Clamped to 1..99.
    expect(evolutionTarget({ ...veteran, overall: 2, potential: 2 }, 0, -2)).toBe(1);
    expect(
      evolutionTarget({ ...meia, overall: 97, potential: 99, growth: 1.2, morale: 100 }, 3000, 2),
    ).toBe(99);
  });

  it('moves the attributes to the new overall and the age by one, and nothing else', () => {
    const base = testPlayer({ position: 'AM', age: 20, peakAge: 28, growth: 1.1, morale: 70 });
    const attributes = fitAttributesToOverall(base.attributes, 'AM', 64);
    const player = { ...base, attributes, overall: 64, potential: 80 };
    const state = { seed: 7, season: 1 };
    const after = evolvePlayer(state, player, 1800);
    expect(after.age).toBe(21);
    expect(after.overall).toBe(computeOverall('AM', after.attributes));
    expect(after.overall).toBeLessThanOrEqual(80);
    const moved = ['overall', 'attributes', 'age'] as const;
    expect(omit(after, moved)).toEqual(omit(player, moved));
    // Its own stream: the same player, season and seed always give the same result.
    expect(evolvePlayer(state, player, 1800)).toEqual(after);
  });

  it('caps the age at AGE_RANGE.max, so the player stays valid', () => {
    const veteran = testPlayer({ age: AGE_RANGE.max, peakAge: 27, potential: 76 });
    const after = evolvePlayer({ seed: 1, season: 70 }, veteran, 0);
    expect(after.age).toBe(AGE_RANGE.max);
    expect(validatePlayer(after).ok).toBe(true);
    expect(evolvePlayer({ seed: 1, season: 70 }, { ...veteran, age: 98 }, 0).age).toBe(99);
  });

  it('keeps the attributes when the overall does not move', () => {
    const player = testPlayer({ age: 28, peakAge: 28, potential: 76 });
    const evolved = Array.from({ length: 40 }, (_, season) =>
      evolvePlayer({ seed: 3, season: season + 1 }, player, 0),
    );
    const same = evolved.filter((p) => p.overall === player.overall);
    expect(same.length).toBeGreaterThan(0);
    for (const p of same) expect(p.attributes).toEqual(player.attributes);
  });
});

describe('awards (temporada.md, "Prêmios")', () => {
  const game = testGame();
  const [gk1, gk2, gk3] = byPosition(game, 'GK');
  const strikers = byPosition(game, 'ST');
  const [st1, st2, st3] = strikers;
  const young = Object.values(game.players).find((p) => p.age <= REVELATION_MAX_AGE)!;
  const old = Object.values(game.players).find(
    (p) => p.age > REVELATION_MAX_AGE && p.position === 'ST',
  )!;

  it('uses the documented minimum of 19 games and age 21', () => {
    expect(AWARD_MIN_GAMES).toBe(19);
    expect(REVELATION_MAX_AGE).toBe(21);
  });

  it('has no winner when nobody played', () => {
    const awards = seasonAwards({ players: game.players, seasonStats: {} });
    expect(awards).toEqual({
      topScorers: [],
      topAssists: [],
      teamOfSeason: ['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'AM', 'AM', 'ST', 'ST', 'ST'].map(
        (slot) => ({ slot }),
      ),
    });
  });

  it('top scorer: most goals, then fewer games, then more assists; level in all share it', () => {
    const awards = seasonAwards({
      players: game.players,
      seasonStats: {
        [st1!.id]: seasonStats({ goals: 20, games: 30, assists: 2 }),
        [st2!.id]: seasonStats({ goals: 20, games: 30, assists: 2 }),
        [st3!.id]: seasonStats({ goals: 20, games: 31, assists: 9 }),
        [gk1!.id]: seasonStats({ goals: 19, games: 1 }),
      },
    });
    expect(awards.topScorers.map((a) => a.playerId).sort()).toEqual([st1!.id, st2!.id].sort());
    expect(awards.topScorers[0]).toEqual({
      playerId: awards.topScorers[0]!.playerId,
      clubId: game.players[awards.topScorers[0]!.playerId]!.clubId,
      goals: 20,
    });
    const fewer = seasonAwards({
      players: game.players,
      seasonStats: {
        [st1!.id]: seasonStats({ goals: 20, games: 30, assists: 2 }),
        [st2!.id]: seasonStats({ goals: 20, games: 30, assists: 3 }),
        [st3!.id]: seasonStats({ goals: 20, games: 29, assists: 0 }),
      },
    });
    expect(fewer.topScorers.map((a) => a.playerId)).toEqual([st3!.id]);
  });

  it('top assists: most assists, then fewer games, then more goals (the garçom tie-break)', () => {
    const awards = seasonAwards({
      players: game.players,
      seasonStats: {
        [st1!.id]: seasonStats({ assists: 12, games: 30, goals: 3 }),
        [st2!.id]: seasonStats({ assists: 12, games: 30, goals: 5 }),
        [st3!.id]: seasonStats({ assists: 12, games: 31, goals: 15 }),
      },
    });
    expect(awards.topAssists).toEqual([{ playerId: st2!.id, clubId: st2!.clubId, assists: 12 }]);
    const shared = seasonAwards({
      players: game.players,
      seasonStats: {
        [st1!.id]: seasonStats({ assists: 12, games: 30, goals: 3 }),
        [st2!.id]: seasonStats({ assists: 12, games: 30, goals: 3 }),
      },
    });
    expect(shared.topAssists).toHaveLength(2);
    // Nobody with an assist: no award.
    const none = seasonAwards({
      players: game.players,
      seasonStats: { [st1!.id]: seasonStats({ goals: 3, games: 30 }) },
    });
    expect(none.topAssists).toEqual([]);
  });

  it('best player: the minimum of rated games, the mean, then rated games, minutes, lower id', () => {
    const rated = (mean: number, ratedGames: number, minutes = 1500) =>
      seasonStats({ games: ratedGames, ratedGames, ratingSum: mean * ratedGames, minutes });
    const awards = seasonAwards({
      players: game.players,
      seasonStats: {
        [st1!.id]: rated(8.5, 18), // under the minimum
        [st2!.id]: rated(7.5, 19),
        [st3!.id]: rated(7.5, 20),
      },
    });
    expect(awards.bestPlayer).toEqual({ playerId: st3!.id, clubId: st3!.clubId, rating: 7.5 });
    const byMinutes = seasonAwards({
      players: game.players,
      seasonStats: { [st2!.id]: rated(7, 20, 1700), [st3!.id]: rated(7, 20, 1600) },
    });
    expect(byMinutes.bestPlayer?.playerId).toBe(st2!.id);
    const byId = seasonAwards({
      players: game.players,
      seasonStats: { [st3!.id]: rated(7, 20), [st2!.id]: rated(7, 20) },
    });
    const lower = [st2!, st3!].sort((a, b) =>
      a.clubId === b.clubId
        ? Number(a.id.split('#')[1]) - Number(b.id.split('#')[1])
        : a.clubId < b.clubId
          ? -1
          : 1,
    )[0]!;
    expect(byId.bestPlayer?.playerId).toBe(lower.id);
    const nobody = seasonAwards({
      players: game.players,
      seasonStats: { [st1!.id]: rated(9, 18) },
    });
    expect(nobody.bestPlayer).toBeUndefined();
    expect(nobody.revelation).toBeUndefined();
  });

  it('revelation: up to 21 in the season played', () => {
    const rated = (mean: number) =>
      seasonStats({ games: 25, ratedGames: 25, ratingSum: mean * 25, minutes: 2000 });
    const awards = seasonAwards({
      players: game.players,
      seasonStats: { [young.id]: rated(6.5), [old.id]: rated(7.5) },
    });
    expect(awards.bestPlayer?.playerId).toBe(old.id);
    expect(awards.revelation).toEqual({ playerId: young.id, clubId: young.clubId, rating: 6.5 });
    const noYoung = seasonAwards({ players: game.players, seasonStats: { [old.id]: rated(7.5) } });
    expect(noYoung.revelation).toBeUndefined();
  });

  it('best goalkeeper: natural GK with 19 games, fewest conceded per game, then more games', () => {
    const keeper = (games: number, conceded: number, mean = 6.5) =>
      seasonStats({ games, conceded, ratedGames: games, ratingSum: mean * games });
    const awards = seasonAwards({
      players: game.players,
      seasonStats: {
        [gk1!.id]: keeper(38, 38),
        [gk2!.id]: keeper(19, 19), // same per game, fewer games
        [gk3!.id]: keeper(18, 0), // under the minimum
        [strikers[4]!.id]: keeper(30, 0), // not a goalkeeper
      },
    });
    expect(awards.bestGoalkeeper).toEqual({
      playerId: gk1!.id,
      clubId: gk1!.clubId,
      concededPerGame: 1,
    });
    const byRating = seasonAwards({
      players: game.players,
      seasonStats: { [gk1!.id]: keeper(20, 20, 6), [gk2!.id]: keeper(20, 20, 7) },
    });
    expect(byRating.bestGoalkeeper?.playerId).toBe(gk2!.id);
    const none = seasonAwards({ players: game.players, seasonStats: { [gk3!.id]: keeper(18, 0) } });
    expect(none.bestGoalkeeper).toBeUndefined();
  });

  it('team of the season: 4-3-3 by natural position, never twice, empty slots without ids', () => {
    const rated = (mean: number) =>
      seasonStats({ games: 30, ratedGames: 30, ratingSum: mean * 30, minutes: 2500 });
    const stats: Record<PlayerId, ReturnType<typeof seasonStats>> = {};
    strikers.slice(0, 4).forEach((p, i) => (stats[p.id] = rated(7 + i / 10)));
    stats[gk1!.id] = rated(6);
    const awards = seasonAwards({ players: game.players, seasonStats: stats });
    const slots = awards.teamOfSeason;
    expect(slots.map((s) => s.slot)).toEqual([
      'GK',
      'CB',
      'CB',
      'FB',
      'FB',
      'DM',
      'AM',
      'AM',
      'ST',
      'ST',
      'ST',
    ]);
    expect(slots[0]).toEqual({ slot: 'GK', playerId: gk1!.id, clubId: gk1!.clubId });
    for (const s of slots.slice(1, 8)) expect(s).toEqual({ slot: s.slot });
    expect(slots.slice(8).map((s) => s.playerId)).toEqual(
      [strikers[3]!, strikers[2]!, strikers[1]!].map((p) => p.id),
    );
  });

  it('reads the age of the season played (before the birthday of the turn)', () => {
    const at21 = Object.values(game.players).find((p) => p.age === REVELATION_MAX_AGE)!;
    const stats = {
      [at21.id]: seasonStats({ games: 30, ratedGames: 30, ratingSum: 30 * 7, minutes: 2400 }),
    };
    const { summary, state } = ended(finishedWith(stats));
    expect(summary.awards.revelation?.playerId).toBe(at21.id);
    expect(state.players[at21.id]!.age).toBe(REVELATION_MAX_AGE + 1);
  });
});

describe('endSeason', () => {
  const finished = playedSeason(SEED);
  const human = Object.keys(finished.clubs)[3]!;

  it('only closes a season at round 39 in the phase season', () => {
    const before = JSON.stringify(testGame());
    const early = endSeason(testGame(), params, [human]);
    expect(early).toEqual({
      ok: false,
      error: 'season-not-finished',
      detail: { season: 1, round: 1, phase: 'season' },
    });
    expect(JSON.stringify(testGame())).toBe(before);
  });

  it('refuses a second call and leaves the state as it was (the evolution never runs twice)', () => {
    const first = ended(finished, [human]);
    const copy = structuredClone(first.state);
    const again = endSeason(first.state, params, [human]);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error).toBe('season-not-finished');
      expect(again.detail).toEqual({ season: 1, round: 39, phase: 'seasonEnd' });
    }
    expect(first.state).toStrictEqual(copy);
  });

  it('refuses a state without clubs with the phase in the detail', () => {
    const empty = { ...finished, clubs: {}, squads: {}, players: {} };
    expect(endSeason(empty, params)).toEqual({
      ok: false,
      error: 'season-not-finished',
      detail: { season: 1, round: 39, phase: 'season', reason: 'no-clubs' },
    });
  });

  it('never changes its input', () => {
    const copy = structuredClone(finished);
    ended(finished, [human]);
    expect(finished).toStrictEqual(copy);
  });

  it('writes the summary: champion, relegation zone, awards, the campaign of the humans', () => {
    const { state, summary } = ended(finished, [human]);
    const table = getStandings(finished);
    expect(state.phase).toBe('seasonEnd');
    expect(state.round).toBe(39);
    expect(state.pastSeasons).toEqual([summary]);
    expect(summary.season).toBe(1);
    expect(summary.year).toBe(2026);
    expect(summary.championId).toBe(table[0]!.clubId);
    expect(summary.championPoints).toBe(table[0]!.points);
    expect(summary.relegationZone).toEqual(table.slice(16).map((r) => r.clubId));
    expect(summary.awards).toEqual(seasonAwards(finished));
    expect(Object.keys(summary.campaigns)).toEqual([human]);
    // The rounds' state that is not the players' stays as it was until the turn.
    expect(state.seasonStats).toBe(finished.seasonStats);
    expect(state.fixtures).toBe(finished.fixtures);
    expect(state.clubs).toBe(finished.clubs);
  });

  it('has no campaign without humans, warns about an unknown club and counts a repeat once', () => {
    expect(ended(finished).summary.campaigns).toEqual({});
    const r = endSeason(finished, params, [human, 'nao-existe', human]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.value.summary.campaigns)).toEqual([human]);
    expect(r.warnings).toEqual([{ code: 'season-unknown-club', detail: { clubId: 'nao-existe' } }]);
  });

  it('builds the campaign from the table, the target and the matches', () => {
    const { summary, state } = ended(finished, [human]);
    const c = summary.campaigns[human]!;
    const row = getStandings(finished).find((r) => r.clubId === human)!;
    expect(c.position).toBe(row.position);
    expect(c.points).toBe(row.points);
    expect(c.target).toBe(Math.min(strengthRank(finished, human)! + 2, 16));
    expect(c.targetMet).toBe(row.position <= c.target);
    expect(c.farewells).toEqual([]);
    expect(c.academy).toEqual([]);
    // Biggest win and defeat, recomputed here.
    const games = finished.fixtures
      .filter((f) => f.homeId === human || f.awayId === human)
      .map((f) => {
        const home = f.homeId === human;
        const [h, a] = f.result!.score;
        return { round: f.round, scored: home ? h : a, conceded: home ? a : h };
      });
    const pick = (sign: 1 | -1) =>
      games
        .filter((g) => sign * (g.scored - g.conceded) > 0)
        .sort(
          (x, y) =>
            sign * (y.scored - y.conceded) - sign * (x.scored - x.conceded) ||
            (sign === 1 ? y.scored - x.scored : y.conceded - x.conceded) ||
            x.round - y.round,
        )[0];
    expect(c.biggestWin?.round).toBe(pick(1)?.round);
    expect(c.biggestDefeat?.round).toBe(pick(-1)?.round);
    // The club's top scorer.
    const goals = finished.squads[human]!.map((id) => finished.seasonStats[id]?.goals ?? 0);
    const top = Math.max(...goals);
    expect(c.topScorers.map((s) => s.goals)).toEqual(goals.filter((g) => g === top).map(() => top));
    // Who evolved: every player whose overall moved, biggest Δ first.
    const moved = finished.squads[human]!.filter(
      (id) => state.players[id]!.overall !== finished.players[id]!.overall,
    );
    expect(c.evolved.map((e) => e.playerId).sort()).toEqual([...moved].sort());
    for (const e of c.evolved) {
      expect(e.before).toBe(finished.players[e.playerId]!.overall);
      expect(e.after).toBe(state.players[e.playerId]!.overall);
    }
    const deltas = c.evolved.map((e) => e.after - e.before);
    expect(deltas).toEqual([...deltas].sort((a, b) => b - a));
  });

  it('a campaign without a win, a defeat or a goal has no such item', () => {
    const fixtures = finished.fixtures.map((f) =>
      f.homeId === human || f.awayId === human
        ? { ...f, result: { ...f.result!, score: [0, 0] as [number, number] } }
        : f,
    );
    const seasonStats = { ...finished.seasonStats };
    for (const id of finished.squads[human]!) {
      if (seasonStats[id] !== undefined) seasonStats[id] = { ...seasonStats[id]!, goals: 0 };
    }
    const c = ended({ ...finished, fixtures, seasonStats }, [human]).summary.campaigns[human]!;
    expect(c.biggestWin).toBeUndefined();
    expect(c.biggestDefeat).toBeUndefined();
    expect(c.topScorers).toEqual([]);
    expect(c.points).toBe(38);
  });

  it('the biggest win breaks a tie on margin by more goals, then the earliest round', () => {
    const own = finished.fixtures.filter((f) => f.homeId === human || f.awayId === human);
    const score = new Map<string, [number, number]>([
      [own[4]!.id, [3, 1]],
      [own[9]!.id, [4, 2]],
      [own[20]!.id, [4, 2]],
    ]);
    const fixtures = finished.fixtures.map((f) => {
      const s = score.get(f.id);
      if (s === undefined) {
        return f.homeId === human || f.awayId === human
          ? { ...f, result: { ...f.result!, score: [1, 1] as [number, number] } }
          : f;
      }
      const forHuman: [number, number] = f.homeId === human ? s : [s[1], s[0]];
      return { ...f, result: { ...f.result!, score: forHuman } };
    });
    const c = ended({ ...finished, fixtures }, [human]).summary.campaigns[human]!;
    expect(c.biggestWin).toEqual({
      round: own[9]!.round,
      opponentId: own[9]!.homeId === human ? own[9]!.awayId : own[9]!.homeId,
      home: own[9]!.homeId === human,
      scored: 4,
      conceded: 2,
    });
    expect(c.biggestDefeat).toBeUndefined();
  });

  it('evolves every player: age + 1, overall by the formula and within the potential', () => {
    const { state } = ended(finished);
    for (const [id, before] of Object.entries(finished.players)) {
      const after = state.players[id]!;
      expect(after.age).toBe(before.age + 1);
      expect(after.overall).toBe(computeOverall(after.position, after.attributes));
      expect(after.overall).toBeLessThanOrEqual(after.potential);
      for (const key of [
        'potential',
        'peakAge',
        'growth',
        'trait',
        'shirt',
        'position',
        'morale',
        'condition',
        'clubAppearances',
      ] as const) {
        expect(after[key], `${id} ${key}`).toEqual(before[key]);
      }
      expect(after).toEqual(evolvePlayer(finished, before, finished.seasonStats[id]?.minutes ?? 0));
    }
  });

  it('gives every player the same Δ with the squads and players shuffled', () => {
    const rng = new Rng(seedFromString('season-shuffle'));
    const ids = rng.shuffle(Object.keys(finished.players));
    const players: Record<PlayerId, Player> = {};
    for (const id of ids) players[id] = finished.players[id]!;
    const squads: Record<ClubId, PlayerId[]> = {};
    for (const clubId of rng.shuffle(Object.keys(finished.squads))) {
      squads[clubId] = rng.shuffle([...finished.squads[clubId]!]);
    }
    const a = ended(finished).state;
    const b = ended({ ...finished, players, squads }).state;
    for (const id of ids) expect(b.players[id], id).toEqual(a.players[id]);
  });

  it('counts the title from here: the champion has one more, nobody else changes', () => {
    const { state, summary } = ended(finished, [human]);
    for (const clubId of Object.keys(finished.clubs)) {
      const base = finished.clubs[clubId]!.def.titles.league;
      expect(careerLeagueTitles(finished, clubId)).toBe(base);
      expect(careerLeagueTitles(state, clubId)).toBe(
        base + (clubId === summary.championId ? 1 : 0),
      );
    }
    expect(careerLeagueTitles(state, 'nao-existe')).toBeUndefined();
  });

  it('keeps a summary with one human club within 3 KB, with ids and numbers only', () => {
    for (const clubId of Object.keys(finished.clubs)) {
      const { summary } = ended(finished, [clubId]);
      const json = JSON.stringify(summary);
      expect(new TextEncoder().encode(json).length, clubId).toBeLessThanOrEqual(3 * 1024);
      // No name of any player anywhere in it (ADR-0012).
      const names = Object.values(finished.players).map((p) => p.name.full);
      for (const name of names.slice(0, 50)) expect(json.includes(name)).toBe(false);
    }
  });
});

describe('startNextSeason (temporada.md, "A virada")', () => {
  const finished = playedSeason(SEED);
  const closed = ended(finished, [Object.keys(finished.clubs)[0]!]).state;
  const next = turned(closed);

  it('only turns a closed season, and refuses a second turn', () => {
    expect(startNextSeason(finished, params, identities)).toEqual({
      ok: false,
      error: 'season-not-ended',
      detail: { season: 1, phase: 'season' },
    });
    const again = startNextSeason(next, params, identities);
    expect(again.ok ? 'ok' : again.error).toBe('season-not-ended');
  });

  it('names the calendar problem of a broken club set in invalid-clubs', () => {
    const [dropped, ...rest] = Object.keys(closed.clubs);
    const clubs = Object.fromEntries(rest.map((id) => [id, closed.clubs[id]!]));
    const r = startNextSeason({ ...closed, clubs }, params, identities);
    expect(r).toEqual({
      ok: false,
      error: 'invalid-clubs',
      detail: { reason: 'invalid-club-count', detail: { count: 19, expected: 20 } },
    });
    expect(dropped).toBeDefined();
  });

  it('refuses incoming clubs (no rule yet) and a year outside the calendar', () => {
    const copy = structuredClone(closed);
    const clubDef = closed.clubs[Object.keys(closed.clubs)[0]!]!.def;
    expect(startNextSeason(closed, params, identities, { incoming: [clubDef] })).toEqual({
      ok: false,
      error: 'invalid-clubs',
      detail: { reason: 'incoming-not-supported' },
    });
    expect(startNextSeason(closed, params, identities, { incoming: [] }).ok).toBe(true);
    const late = startNextSeason({ ...closed, year: 9999 }, params, identities);
    expect(late.ok ? 'ok' : late.error).toBe('invalid-calendar');
    expect(closed).toStrictEqual(copy);
  });

  it('starts season 2: year + 1, round 1, a new calendar of 380 with new ids', () => {
    expect(next.season).toBe(2);
    expect(next.year).toBe(2027);
    expect(next.round).toBe(1);
    expect(next.phase).toBe('season');
    expect(next.fixtures).toHaveLength(380);
    const old = new Set(closed.fixtures.map((f) => f.id));
    expect(next.fixtures.some((f) => old.has(f.id))).toBe(false);
    for (const f of next.fixtures) {
      expect(f.id.startsWith('s2-')).toBe(true);
      expect(f.result).toBeUndefined();
    }
    const first = next.fixtures.find((f) => f.round === 1)!.date;
    expect(first >= '2027-04-09' && first <= '2027-04-15').toBe(true);
    expect(next.seasonStats).toEqual({});
    expect('lastRound' in next).toBe(false);
    expect(next.lastSheets).toBe(closed.lastSheets);
    expect(next.pastSeasons).toBe(closed.pastSeasons);
    expect(next.squads).toBe(closed.squads);
  });

  it('rounds the morale of the turn to 2 decimals, in range (BUG-A of T-017)', () => {
    expect(MORALE_TURN_SCALE).toBe(100);
    expect(moraleAtTurn(80, 60)).toBe(70);
    expect(moraleAtTurn(64.69681177721688, 60)).toBe(62.35);
    expect(moraleAtTurn(21.123456789, 60)).toBe(40.56);
    expect(moraleAtTurn(0, 60)).toBe(30);
    expect(moraleAtTurn(100, 100)).toBe(100);
    expect(moraleAtTurn(0.004, 0)).toBe(0);
  });

  it('turns every player as the table says', () => {
    expect(MORALE_OFFSEASON_PULL).toBe(0.5);
    expect(Object.keys(next.players)).toHaveLength(500);
    for (const [id, before] of Object.entries(closed.players)) {
      const after = next.players[id]!;
      expect(after.condition).toBe(100);
      expect(after.injuryRounds).toBe(0);
      expect(after.suspendedGames).toBe(0);
      expect(after.yellowCount).toBe(0);
      expect(after.benchStreak).toBe(0);
      expect(after.recentRatings).toEqual([]);
      const pulled = before.morale + 0.5 * (60 - before.morale);
      expect(after.morale).toBe(moraleAtTurn(before.morale, 60));
      expect(Math.abs(after.morale - pulled)).toBeLessThanOrEqual(0.005 + 1e-9);
      // Two decimals at most (BUG-A of T-017: the state does not grow in digits).
      expect(after.morale).toBe(Math.round(after.morale * 100) / 100);
      const turnedKeys = [
        'condition',
        'injuryRounds',
        'suspendedGames',
        'yellowCount',
        'benchStreak',
        'recentRatings',
        'morale',
      ] as const;
      expect(omit(after, turnedKeys), id).toEqual(omit(before, turnedKeys));
    }
    // The season ended with someone injured, suspended or booked, so the turn did clear them.
    const vals = Object.values(closed.players);
    expect(vals.some((p) => p.injuryRounds > 0 || p.suspendedGames > 0)).toBe(true);
    expect(vals.some((p) => p.yellowCount > 0)).toBe(true);
  });

  it('turns every club: thermometer at fans.start, idol streak 0, strength of the evolved XI', () => {
    expect(Object.keys(next.clubs)).toHaveLength(20);
    for (const [id, before] of Object.entries(closed.clubs)) {
      const after = next.clubs[id]!;
      expect(after.fans).toBe(params.fans.start);
      expect(after.idolBenchStreak).toBe(0);
      const squad = next.squads[id]!.map((pid) => next.players[pid]!);
      const formula = elevenStrength(bestEleven(squad, before.preferredFormations[0]));
      expect(Math.abs(after.strength - formula)).toBeLessThan(1e-9);
      expect(squadStrength(next, id)).toBe(after.strength);
      expect(after.def).toBe(before.def);
      expect(after.profile).toBe(before.profile);
      expect(after.preferredFormations).toBe(before.preferredFormations);
    }
    expect(squadStrength(next, 'nao-existe')).toBeUndefined();
    // The same idol, one per club.
    for (const [clubId, squad] of Object.entries(next.squads)) {
      const idols = squad.filter((pid) => next.players[pid]!.trait === 'idol');
      expect(idols, clubId).toEqual(
        closed.squads[clubId]!.filter((pid) => closed.players[pid]!.trait === 'idol'),
      );
      expect(idols).toHaveLength(1);
    }
  });

  it('is deterministic: the same turn twice gives identical states', () => {
    expect(JSON.stringify(turned(closed))).toBe(JSON.stringify(next));
    const again = turned(ended(playedSeason(SEED), [Object.keys(finished.clubs)[0]!]).state);
    expect(JSON.stringify(again)).toBe(JSON.stringify(next));
  });

  it('plays the new season, and the state grows by about one summary a season', () => {
    const r = playRound(next, params, { round: 1, sheets: {}, commands: {}, fanDecisions: {} });
    expect(r.ok).toBe(true);
    const bytes = (s: unknown) => new TextEncoder().encode(JSON.stringify(s)).length;
    const second = ended(playedSeason(SEED, next), [Object.keys(next.clubs)[0]!]);
    const third = turned(second.state);
    const growth = bytes(third) - bytes(next);
    const item = bytes(second.summary);
    expect(third.pastSeasons).toHaveLength(2);
    expect(growth).toBeLessThanOrEqual(item + 1024);
    expect(growth).toBeGreaterThanOrEqual(item - 1024);
    expect(growth).toBeLessThanOrEqual(4 * 1024);
  });
});

describe('board target (temporada.md, "Expectativa da diretoria")', () => {
  it('asks the strength rank + 2, never worse than 16', () => {
    const game = testGame();
    const order = Object.keys(game.clubs).sort(
      (a, b) => game.clubs[b]!.strength - game.clubs[a]!.strength || (a < b ? -1 : 1),
    );
    order.forEach((id, i) => {
      expect(strengthRank(game, id)).toBe(i + 1);
      expect(targetPosition(game, id)).toBe(Math.min(i + 3, TARGET_POSITION_MAX));
    });
    expect(TARGET_POSITION_MAX).toBe(16);
    expect(strengthRank(game, 'nao-existe')).toBeUndefined();
    expect(targetPosition(game, 'nao-existe')).toBeUndefined();
  });
});
