import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  getStandings,
  newGame,
  playRound,
  prepareRound,
  simulateMatch,
  validateLineup,
} from '../engine/index.ts';
import type { ClubDef, GameState, MatchCommand, PlayerId } from '../engine/index.ts';
import { fixedIdentitySource } from '../engine/testing/identity.ts';
import { testParams } from '../engine/testing/params.ts';

/*
 * Career acceptance (T-013, QA gate 2), engine only: the coach's club goes through the same
 * calls the live screen and the round summary make. The match seen live (prepareRound +
 * simulateMatch + commands) must be the one playRound records.
 */
const clubs = JSON.parse(
  readFileSync(new URL('./clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];
const params = testParams();
const COACH = clubs[0]!.id;
const MODES = [
  'full',
  'full',
  'highlights',
  'result',
  'full',
  'result',
  'highlights',
  'result',
] as const;

function start(seed: number): GameState {
  const created = newGame(
    { seed, year: 2026, realism: 'full' },
    clubs,
    params,
    fixedIdentitySource(),
  );
  if (!created.ok) throw new Error('newGame failed');
  return created.value;
}

describe('career round by round, coach club', () => {
  it('live match equals the recorded one; table, suspensions, injuries and condition follow', () => {
    let state = start(77);
    let sawCommand = 0;
    let sawSuspensionServed = 0;
    let sawInjuryCount = 0;
    let sawRecovery = 0;

    for (let i = 0; i < MODES.length; i++) {
      const mode = MODES[i]!;
      const round = state.round;
      expect(round).toBe(i + 1);

      // The screen asks for the suggested sheet first, then plans with it.
      const first = prepareRound(state, params, { coaches: { [COACH]: mode } });
      if (!first.ok) throw new Error(first.error);
      const sheet = first.value.suggested[COACH]!;
      expect(validateLineup(state, COACH, sheet).ok).toBe(true);
      const setup = { sheets: { [COACH]: sheet }, coaches: { [COACH]: mode } };
      const plan = prepareRound(state, params, setup);
      if (!plan.ok) throw new Error(plan.error);
      const match = plan.value.matches.find(
        (m) => m.home.clubId === COACH || m.away.clubId === COACH,
      )!;
      const side = match.home.clubId === COACH ? 'home' : 'away';
      expect(match[side].controller).toBe(mode === 'result' ? 'ai' : 'human');
      expect(match[side].profile).toBe('traditional');

      // Commands only where the coach plays live: a substitution of outfield players at 60'.
      const commands: Record<string, MatchCommand[]> = {};
      if (mode !== 'result') {
        const pos = (id: PlayerId) => state.players[id]!.position;
        const out = sheet.lineup.starters.find((id) => pos(id) !== 'GK');
        const inn = sheet.lineup.bench.find((id) => pos(id) !== 'GK');
        if (out !== undefined && inn !== undefined) {
          commands[match.fixtureId] = [
            { minute: 60, side, kind: 'substitution', out, in: inn },
            { minute: 70, side, kind: 'tactic', posture: 'attacking' },
          ];
          sawCommand++;
        }
      }

      // Live view.
      const live = simulateMatch(match, params, commands[match.fixtureId]);

      const before = state;
      const sus = before.squads[COACH]!.filter((id) => before.players[id]!.suspendedGames > 0);
      const inj = before.squads[COACH]!.filter((id) => before.players[id]!.injuryRounds > 0);
      // Never in the suggested sheet while out.
      for (const id of [...sheet.lineup.starters, ...sheet.lineup.bench]) {
        expect(sus).not.toContain(id);
        expect(inj).not.toContain(id);
      }

      const played = playRound(state, params, {
        round,
        sheets: setup.sheets,
        commands,
        fanDecisions: {},
        coaches: setup.coaches,
      });
      if (!played.ok) throw new Error(played.error);
      state = played.value.state;
      const fixture = state.fixtures.find((f) => f.id === match.fixtureId)!;
      expect(fixture.result?.score).toEqual(live.score);
      const recorded = played.value.report.results.find((r) => r.fixtureId === match.fixtureId)!;
      expect(recorded.score).toEqual(live.score);
      expect(recorded.events).toEqual(live.events);
      expect(state.round).toBe(round + 1);
      expect(played.value.report.round).toBe(round);
      expect('lastRound' in state).toBe(false);
      expect(state.lastSheets[COACH]).toEqual(sheet);
      expect(played.value.report.results).toHaveLength(10);

      // Table: one game more for everybody; points and goals match the scores.
      const table = getStandings(state);
      expect(table).toHaveLength(20);
      for (const row of table) {
        expect(row.played).toBe(round);
        expect(row.points).toBe(row.wins * 3 + row.draws);
        expect(row.wins + row.draws + row.losses).toBe(row.played);
        expect(row.goalDifference).toBe(row.goalsFor - row.goalsAgainst);
      }
      const gf = table.reduce((s, r) => s + r.goalsFor, 0);
      const ga = table.reduce((s, r) => s + r.goalsAgainst, 0);
      const scored = state.fixtures
        .filter((f) => f.result !== undefined)
        .reduce((s, f) => s + f.result!.score[0] + f.result!.score[1], 0);
      expect(gf).toBe(scored);
      expect(ga).toBe(scored);

      // Suspensions served, injuries counting down, condition recovering.
      const minutes = recorded.minutes;
      for (const id of sus) {
        const was = before.players[id]!.suspendedGames;
        const now = state.players[id]!.suspendedGames;
        expect(minutes[id]).toBeUndefined(); // suspended players never play
        expect(now).toBe(Math.max(0, was - 1));
        sawSuspensionServed++;
      }
      for (const id of inj) {
        expect(minutes[id]).toBeUndefined();
        expect(state.players[id]!.injuryRounds).toBe(before.players[id]!.injuryRounds - 1);
        sawInjuryCount++;
      }
      for (const { player, rounds } of live.newInjuries) {
        if (state.players[player]!.clubId === COACH) {
          expect(state.players[player]!.injuryRounds).toBeGreaterThanOrEqual(Math.min(rounds, 1));
        }
      }
      for (const id of before.squads[COACH]!) {
        const b = before.players[id]!;
        const a = state.players[id]!;
        const energy = recorded.finalEnergy[id];
        if (energy !== undefined) {
          // Played: tired at the whistle, then recovering (never below the final energy).
          expect(a.condition).toBeGreaterThanOrEqual(energy);
          if (energy < 100) sawRecovery++;
        } else if (b.condition < 100) {
          expect(a.condition).toBeGreaterThan(b.condition); // rested players recover
          sawRecovery++;
        }
        expect(a.condition).toBeLessThanOrEqual(100);
        expect(a.condition).toBeGreaterThanOrEqual(0);
      }

      // Replaying the same round: typed error, state intact.
      const snapshot = structuredClone(state);
      const again = playRound(state, params, {
        round,
        sheets: setup.sheets,
        commands,
        fanDecisions: {},
        coaches: setup.coaches,
      });
      expect(again.ok).toBe(false);
      if (!again.ok) expect(again.error).toBe('round-already-played');
      expect(state).toEqual(snapshot);
      expect(getStandings(state)).toEqual(table);
    }
    expect(sawCommand).toBeGreaterThan(0);
    expect(sawRecovery).toBeGreaterThan(0);
    // These two depend on the dice; reported, asserted by the dedicated tests in round.test.ts.
    console.info(`served suspensions ${sawSuspensionServed}, injured counted ${sawInjuryCount}`);
  });

  it('a red card of the coach club is served in the next round and cleared after', () => {
    // Search seeds until the coach club gets a suspension in rounds 1..10, then follow it.
    let found = false;
    for (let seed = 1; seed <= 12 && !found; seed++) {
      let state = start(seed);
      for (let r = 1; r <= 12 && !found; r++) {
        const res = playRound(state, params, {
          round: state.round,
          sheets: {},
          commands: {},
          fanDecisions: {},
          coaches: { [COACH]: 'result' },
        });
        if (!res.ok) throw new Error(res.error);
        state = res.value.state;
        const out = state.squads[COACH]!.find((id) => state.players[id]!.suspendedGames > 0);
        if (out === undefined) continue;
        found = true;
        const games = state.players[out]!.suspendedGames;
        for (let k = 0; k < games; k++) {
          const plan = prepareRound(state, params, { coaches: { [COACH]: 'full' } });
          if (!plan.ok) throw new Error(plan.error);
          const s = plan.value.suggested[COACH]!;
          expect([...s.lineup.starters, ...s.lineup.bench]).not.toContain(out);
          const next = playRound(state, params, {
            round: state.round,
            sheets: {},
            commands: {},
            fanDecisions: {},
            coaches: { [COACH]: 'full' },
          });
          if (!next.ok) throw new Error(next.error);
          state = next.value.state;
        }
        expect(state.players[out]!.suspendedGames).toBeLessThanOrEqual(0 + games); // sanity
        expect(state.players[out]!.suspendedGames).toBe(0);
      }
    }
    expect(found).toBe(true);
  });
});
