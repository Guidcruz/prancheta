import { describe, expect, it } from 'vitest';
import type { GameState } from './game.ts';
import type { Player } from './players.ts';
import { playRound, prepareRound, type RoundInput } from './round.ts';
import { getStandings } from './standings.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { PlayerId } from './types.ts';
import { reportOf, trackRound } from './testing/reports.ts';

/*
 * The "Realismo simplificado" between rounds (partida.md, "Modo Realismo simplificado"; T-014):
 * inside the match everything is the same (fatigue, cards, the injured leaving); between the
 * matches everyone is back to 100, the injured is available next round and the cards never
 * suspend. It holds for every club of the career. The full realism is round.test.ts.
 */

const params = testParams();
const SEED = 20261104;

function input(round: number, extra: Partial<RoundInput> = {}): RoundInput {
  return { round, sheets: {}, commands: {}, fanDecisions: {}, ...extra };
}

function play(state: GameState, extra: Partial<RoundInput> = {}) {
  const result = trackRound(playRound(state, params, input(state.round, extra)));
  if (!result.ok) throw new Error(`playRound: ${result.error}`);
  return result.value;
}

function simplified(state: GameState): GameState {
  return { ...state, rules: { realism: 'simplified' } };
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

const chains = new Map<string, GameState[]>();
function season(realism: 'full' | 'simplified'): GameState[] {
  const cached = chains.get(realism);
  if (cached !== undefined) return cached;
  const start = realism === 'full' ? testGame(SEED) : simplified(testGame(SEED));
  const states = [start];
  for (let r = 1; r <= 38; r++) states.push(play(states[r - 1]!).state);
  chains.set(realism, states);
  return states;
}

describe('simplified realism', () => {
  it('the match is the same: round 1 gives the same results in both modes', () => {
    const full = play(testGame(SEED)).report.results;
    const simple = play(simplified(testGame(SEED))).report.results;
    expect(simple).toEqual(full);
  });

  it('between the matches: condition 100, nobody injured or suspended, no such facts', () => {
    const all = season('simplified');
    let reds = 0;
    let yellows = 0;
    let injuries = 0;
    let suspensions = 0;
    for (let r = 1; r <= 38; r++) {
      const s = all[r]!;
      expect(s.rules.realism).toBe('simplified');
      for (const [id, p] of Object.entries(s.players)) {
        expect(p.condition, `round ${r}, ${id}`).toBe(100);
        expect(p.injuryRounds, `round ${r}, ${id}`).toBe(0);
        expect(p.suspendedGames, `round ${r}, ${id}`).toBe(0);
        // The yellow counter does not move in the simplified realism (partida.md, (1)).
        expect(p.yellowCount, `round ${r}, ${id}`).toBe(0);
      }
      const facts = reportOf(s).facts;
      expect(facts.some((f) => f.kind === 'suspended' || f.kind === 'injured')).toBe(false);
      for (const res of reportOf(s).results) {
        reds += res.events.filter((e) => e.type === 'red').length;
        yellows += res.events.filter((e) => e.type === 'yellow').length;
        for (const e of res.events) {
          if (e.type === 'yellow') expect(e.triggersSuspension, `round ${r}`).toBe(false);
        }
        injuries += res.newInjuries.length;
        suspensions += res.newSuspensions.length;
        // Inside the match the energy still drains.
        expect(Object.values(res.finalEnergy).some((e) => e < 100)).toBe(true);
      }
    }
    // Cards, sendings-off and injuries still happen in the match.
    expect(reds).toBeGreaterThan(0);
    expect(yellows).toBeGreaterThan(500);
    // The cards still count in the season stats and in the table's tie-break.
    const stats = Object.values(all[38]!.seasonStats);
    expect(stats.reduce((n, x) => n + x.yellows, 0)).toBe(yellows);
    expect(getStandings(all[38]!).reduce((n, row) => n + row.yellows, 0)).toBe(yellows);
    expect(injuries).toBeGreaterThan(0);
    expect(suspensions).toBeGreaterThan(0);
  });

  it('the injured of a round plays the next one if the AI picks him', () => {
    const all = season('simplified');
    let back = 0;
    for (let r = 1; r < 38; r++) {
      for (const res of reportOf(all[r]!).results) {
        for (const { player } of res.newInjuries) {
          if (reportOf(all[r + 1]!).results.some((x) => player in x.minutes)) back++;
        }
      }
    }
    expect(back).toBeGreaterThan(0);
  });

  it('the full realism of the same career does have them (the contrast)', () => {
    const all = season('full');
    let injured = 0;
    let suspended = 0;
    let tired = 0;
    for (let r = 1; r <= 38; r++) {
      for (const p of Object.values(all[r]!.players)) {
        if (p.injuryRounds > 0) injured++;
        if (p.suspendedGames > 0) suspended++;
        if (p.condition < 100) tired++;
      }
    }
    expect(injured).toBeGreaterThan(0);
    expect(suspended).toBeGreaterThan(0);
    expect(tired).toBeGreaterThan(0);
  });

  it('a suspension or an injury already in the state is still served and counted down', () => {
    const state = simplified(testGame(SEED));
    const plan = prepareRound(state, params);
    if (!plan.ok) throw new Error('prepareRound');
    const [a, b] = plan.value.matches[0]!.home.sheet.lineup.starters.slice(4, 6) as [
      string,
      string,
    ];
    let s = withPlayers(state, (p) =>
      p.id === a ? { suspendedGames: 1 } : p.id === b ? { injuryRounds: 2 } : undefined,
    );
    s = play(s).state;
    expect(reportOf(s).results.some((x) => a in x.minutes || b in x.minutes)).toBe(false);
    expect([s.players[a]!.suspendedGames, s.players[b]!.injuryRounds]).toEqual([0, 1]);
    s = play(s).state;
    expect(s.players[b]!.injuryRounds).toBe(0);
    expect(reportOf(s).results.some((x) => b in x.minutes)).toBe(false);
  });

  it('the morale, the form and the thermometer move as in the full realism', () => {
    const all = season('simplified');
    const first = all[0]!;
    const last = all[38]!;
    const moraleMoved = Object.keys(first.players).filter(
      (id) => first.players[id]!.morale !== last.players[id]!.morale,
    ).length;
    expect(moraleMoved).toBeGreaterThan(400);
    expect(Object.values(last.players).some((p) => p.recentRatings.length === 5)).toBe(true);
    expect(Object.values(last.clubs).some((c) => c.fans !== params.fans.start)).toBe(true);
  });
});
