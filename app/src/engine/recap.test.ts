import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { GameState } from './game.ts';
import type { MatchResult } from './match/types.ts';
import { MATCH_SHEET_EVENTS, matchSheet, roundRecap, type MatchRecap } from './recap.ts';
import { playRound, type RoundReport } from './round.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';

/*
 * The round's report outside the state (T-049; docs/02-architecture.md, 4.1, "Relatório da
 * rodada fora do estado"): the state after `playRound` has no report, and `roundRecap` and
 * `matchSheet` are pure projections of the report with the fields of the contract, within the
 * size budget of the decision (a Série A round: recap up to 8 KB and the 10 sheets up to 3 KB,
 * both in gzip).
 */

const params = testParams();

/** The 38 rounds of the synthetic league by the AI: the state and the report of each round. */
function season(): { states: GameState[]; reports: RoundReport[] } {
  let state = testGame();
  const states: GameState[] = [];
  const reports: RoundReport[] = [];
  while (state.round <= 38) {
    const r = playRound(state, params, {
      round: state.round,
      sheets: {},
      commands: {},
      fanDecisions: {},
    });
    if (!r.ok) throw new Error(`playRound: ${r.error}`);
    state = r.value.state;
    states.push(state);
    reports.push(r.value.report);
  }
  return { states, reports };
}

const played = season();
const gzipBytes = (value: unknown) => gzipSync(JSON.stringify(value)).length;
const MATCH_RECAP_KEYS = [
  'attendance',
  'events',
  'fixtureId',
  'markers',
  'motm',
  'motmRating',
  'score',
  'stats',
];

describe('the round report is not in the state (T-049)', () => {
  it('no state after playRound has lastRound, and the report still has the 10 full results', () => {
    expect(played.states).toHaveLength(38);
    for (const [i, state] of played.states.entries()) {
      expect('lastRound' in state, `round ${i + 1}`).toBe(false);
      expect(JSON.stringify(state)).not.toContain('"lastRound"');
      const report = played.reports[i]!;
      expect(report.round).toBe(i + 1);
      expect(report.results).toHaveLength(10);
      for (const result of report.results) {
        expect(Object.keys(result.ratings).length).toBeGreaterThan(0);
        expect(Object.keys(result.minutes).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('roundRecap', () => {
  it('keeps per match the fields of the contract and the facts, nothing else', () => {
    for (const report of played.reports) {
      const recap = roundRecap(report);
      expect(recap.season).toBe(report.season);
      expect(recap.round).toBe(report.round);
      expect(recap.facts).toEqual(report.facts);
      expect(recap.results).toHaveLength(report.results.length);
      for (const [i, m] of recap.results.entries()) {
        const full = report.results[i]!;
        for (const key of Object.keys(m)) expect(MATCH_RECAP_KEYS).toContain(key);
        expect(m.fixtureId).toBe(full.fixtureId);
        expect(m.score).toEqual(full.score);
        expect(m.events).toEqual(full.events);
        expect(m.stats).toEqual(full.stats);
        expect(m.markers).toEqual(full.markers);
        expect(m.attendance).toBe(full.attendance);
        expect(m.motm).toBe(full.motm);
        const rating = full.motm === undefined ? undefined : full.ratings[full.motm];
        expect(m.motmRating).toBe(rating ?? undefined);
      }
    }
  });

  it('is JSON-exact and does not change nor share the arrays of the report', () => {
    const report = played.reports[5]!;
    const before = JSON.stringify(report);
    const recap = roundRecap(report);
    expect(JSON.stringify(report)).toBe(before);
    expect(JSON.parse(JSON.stringify(recap))).toEqual(recap);
    expect(recap.facts).not.toBe(report.facts);
    expect(recap.results[0]!.events).not.toBe(report.results[0]!.events);
    expect(recap.results[0]!.markers).not.toBe(report.results[0]!.markers);
    expect(recap.results[0]!.score).not.toBe(report.results[0]!.score);
    expect(recap.results[0]!.stats.home).not.toBe(report.results[0]!.stats.home);
    expect(JSON.stringify(roundRecap(report))).toBe(JSON.stringify(recap));
  });

  it('leaves motm and motmRating out when there is no best on the pitch or he has no rating', () => {
    const full = played.reports[0]!.results[0]!;
    const { motm, ...noMotm } = full;
    expect(motm).toBeDefined();
    const without = roundRecap({ ...played.reports[0]!, results: [noMotm as MatchResult] });
    expect('motm' in without.results[0]!).toBe(false);
    expect('motmRating' in without.results[0]!).toBe(false);
    const unrated: MatchResult = { ...full, ratings: { ...full.ratings, [motm!]: null } };
    const recap = roundRecap({ ...played.reports[0]!, results: [unrated] }).results[0]!;
    expect(recap.motm).toBe(motm);
    expect('motmRating' in recap).toBe(false);
    expect('motmRating' in matchSheet(unrated)).toBe(false);
  });

  it('fits a Série A round in 8 KB of gzip (measured on the 38 rounds)', () => {
    const sizes = played.reports.map((r) => gzipBytes(roundRecap(r)));
    expect(Math.max(...sizes)).toBeLessThanOrEqual(8 * 1024);
    // Well below the whole report, which keeps the per-player maps.
    const whole = played.reports.map(gzipBytes);
    expect(sizes.reduce((a, b) => a + b)).toBeLessThan(0.75 * whole.reduce((a, b) => a + b));
  });
});

describe('matchSheet', () => {
  it('keeps only the sheet events, in match order, and the rating of the best on the pitch', () => {
    const types = new Set(MATCH_SHEET_EVENTS);
    for (const report of played.reports) {
      for (const result of report.results) {
        const sheet = matchSheet(result);
        expect(Object.keys(sheet).sort()).toEqual(
          result.motm === undefined
            ? ['events', 'fixtureId']
            : ['events', 'fixtureId', 'motmRating'],
        );
        expect(sheet.fixtureId).toBe(result.fixtureId);
        expect(sheet.events).toEqual(result.events.filter((e) => types.has(e.type as never)));
        if (result.motm !== undefined) expect(sheet.motmRating).toBe(result.ratings[result.motm]);
      }
    }
    // The season has every kind of sheet event.
    const seen = new Set(
      played.reports.flatMap((r) =>
        r.results.flatMap((x) => matchSheet(x).events.map((e) => e.type)),
      ),
    );
    expect([...seen].sort()).toEqual([...MATCH_SHEET_EVENTS].sort());
  });

  it('gives the same sheet from the full result and from its recap', () => {
    for (const report of played.reports.slice(0, 5)) {
      const recap = roundRecap(report);
      for (const [i, result] of report.results.entries()) {
        const fromRecap: MatchRecap = recap.results[i]!;
        expect(matchSheet(fromRecap)).toEqual(matchSheet(result));
      }
    }
  });

  it('does not change its input and fits the 10 sheets of a round in 3 KB of gzip', () => {
    const report = played.reports[10]!;
    const before = JSON.stringify(report);
    const sheets = Object.fromEntries(report.results.map((r) => [r.fixtureId, matchSheet(r)]));
    expect(JSON.stringify(report)).toBe(before);
    expect(matchSheet(report.results[0]!).events).not.toBe(report.results[0]!.events);
    expect(JSON.parse(JSON.stringify(sheets))).toEqual(sheets);
    const sizes = played.reports.map((r) =>
      gzipBytes(Object.fromEntries(r.results.map((x) => [x.fixtureId, matchSheet(x)]))),
    );
    expect(Math.max(...sizes)).toBeLessThanOrEqual(3 * 1024);
  });
});
