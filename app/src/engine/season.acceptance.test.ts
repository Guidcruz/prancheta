import { describe, expect, it } from 'vitest';
import type { GameState } from './game.ts';
import { playRound } from './round.ts';
import { endSeason, startNextSeason } from './season.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import { validatePlayer } from './players.ts';
import { playedSeason } from './testing/season.ts';

/*
 * QA acceptance of T-017 (US-025 and scenario D8 of US-069): relegation zone without effect, the
 * repeated turn, a state saved before pastSeasons, and a 5-season chained career.
 */
const params = testParams();
const identities = fixedIdentitySource();

function play(start: GameState): GameState {
  let state = start;
  while (state.phase === 'season' && state.round <= 38) {
    const r = playRound(state, params, {
      round: state.round,
      sheets: {},
      commands: {},
      fanDecisions: {},
    });
    if (!r.ok) throw new Error(`playRound ${state.round}: ${r.error}`);
    state = r.value.state;
  }
  return state;
}

function turn(state: GameState, humans: readonly string[]) {
  const closed = endSeason(state, params, humans, identities);
  if (!closed.ok) throw new Error(`endSeason: ${closed.error}`);
  const next = startNextSeason(closed.value.state, params, identities);
  if (!next.ok) throw new Error(`startNextSeason: ${next.error}`);
  return { closed: closed.value, next: next.value };
}

const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

describe('US-025: relegation zone has no effect (same 20 clubs in season 2)', () => {
  const finished = playedSeason(7);
  const { closed, next } = turn(finished, [Object.keys(finished.clubs)[0]!]);

  it('names 4 clubs in the zone and still keeps all 20 clubs, with the same ids and definitions', () => {
    expect(closed.summary.relegationZone).toHaveLength(4);
    expect(Object.keys(next.clubs).sort()).toEqual(Object.keys(finished.clubs).sort());
    expect(Object.keys(next.clubs)).toHaveLength(20);
    for (const id of closed.summary.relegationZone) {
      expect(next.clubs[id]).toBeDefined();
      expect(next.clubs[id]!.def).toBe(finished.clubs[id]!.def);
      // The same squad, but for the minimal renewal (T-048): who retired leaves, and the youth
      // of the academy come in at the end, as many as left.
      const left = finished.squads[id]!.filter((pid) => !next.squads[id]!.includes(pid));
      const staying = next.squads[id]!.slice(0, 25 - left.length);
      expect(staying).toEqual(finished.squads[id]!.filter((pid) => !left.includes(pid)));
      for (const pid of left) {
        expect(closed.state.players[pid]!.age).toBeGreaterThanOrEqual(33);
        expect(closed.state.players[pid]!.age).toBeLessThanOrEqual(40);
      }
      expect(next.squads[id]).toHaveLength(25);
    }
  });

  it('gives each club in the new calendar 38 games, and no club outside the 20', () => {
    const ids = new Set(Object.keys(next.clubs));
    const games = new Map<string, number>();
    for (const f of next.fixtures) {
      expect(ids.has(f.homeId) && ids.has(f.awayId)).toBe(true);
      for (const c of [f.homeId, f.awayId]) games.set(c, (games.get(c) ?? 0) + 1);
    }
    expect([...games.values()].every((n) => n === 38)).toBe(true);
    expect(games.size).toBe(20);
  });
});

describe('US-025: repeated turn gives identical states', () => {
  it('two turns from structurally equal closed seasons are byte-identical, three levels deep', () => {
    const a = turn(play(testGame(11)), []);
    const b = turn(play(testGame(11)), []);
    expect(JSON.stringify(b.closed.state)).toBe(JSON.stringify(a.closed.state));
    expect(JSON.stringify(b.next)).toBe(JSON.stringify(a.next));
    const a2 = turn(play(a.next), []);
    const b2 = turn(play(b.next), []);
    expect(JSON.stringify(b2.next)).toBe(JSON.stringify(a2.next));
  });
});

describe('US-025: a career of 5 chained seasons', () => {
  it('stays valid: 20 clubs, 500 players, valid attributes, pastSeasons within 3 KB each', () => {
    const human = Object.keys(testGame(5).clubs)[0]!;
    let state = testGame(5);
    const sizes: number[] = [bytes(state)];
    for (let season = 1; season <= 5; season++) {
      expect(state.season).toBe(season);
      state = play(state);
      const t = turn(state, [human]);
      state = t.next;
      sizes.push(bytes(state));
      expect(state.pastSeasons).toHaveLength(season);
      expect(state.year).toBe(2026 + season);
      expect(state.round).toBe(1);
      expect(Object.keys(state.clubs)).toHaveLength(20);
      expect(Object.keys(state.players)).toHaveLength(500);
      for (const p of Object.values(state.players)) {
        expect(validatePlayer(p).ok, p.id).toBe(true);
        expect(p.injuryRounds).toBe(0);
        expect(p.suspendedGames).toBe(0);
        expect(p.yellowCount).toBe(0);
      }
      for (const c of Object.values(state.clubs)) {
        expect(Number.isFinite(c.strength)).toBe(true);
        expect(c.fans).toBeGreaterThanOrEqual(0);
        expect(c.fans).toBeLessThanOrEqual(100);
      }
      for (const s of state.pastSeasons) expect(bytes(s)).toBeLessThanOrEqual(3 * 1024);
      // Ids of the calendar never repeat across seasons.
      expect(state.fixtures.every((f) => f.id.startsWith(`s${season + 1}-`))).toBe(true);
    }
    // The state grows at most 3 KB between the starts of two following seasons, on every turn from
    // the start of season 2 on (sizes[0] is the start of season 1). The first step, from the new
    // game, is not measured here: it is +16 KB, the first appearance of the season data (last
    // sheets, stats, evolved reals) and not a growth per turn.
    expect(sizes).toHaveLength(6);
    const growth = sizes.slice(2).map((size, k) => size - sizes[k + 1]!);
    expect(growth).toHaveLength(4);
    for (const g of growth) expect(g, JSON.stringify(growth)).toBeLessThanOrEqual(3 * 1024);
  }, 120_000);
});
