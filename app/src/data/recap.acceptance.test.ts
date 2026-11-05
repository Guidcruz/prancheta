import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  MATCH_SHEET_EVENTS,
  endSeason,
  matchSheet,
  newGame,
  playRound,
  roundRecap,
  startNextSeason,
} from '../engine/index.ts';
import type { ClubDef, GameState, RoundReport } from '../engine/index.ts';
import { fixedIdentitySource } from '../engine/testing/identity.ts';
import { testParams } from '../engine/testing/params.ts';

/*
 * QA acceptance of T-049 (docs/02-architecture.md, 4.1, "Relatório da rodada fora do estado"):
 * with the 20 real clubs of the Série A, a whole season in both realisms. The state after every
 * `playRound` has no `lastRound`, the recap of a round fits 8 KB of gzip and the 10 sheets of a
 * round fit 3 KB, and the season turn keeps the state without a report.
 */
const clubs = JSON.parse(
  readFileSync(new URL('./clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];
const params = testParams();
const gzipBytes = (value: unknown) => gzipSync(JSON.stringify(value)).length;

function season(seed: number, realism: 'full' | 'simplified') {
  const created = newGame({ seed, year: 2026, realism }, clubs, params, fixedIdentitySource());
  if (!created.ok) throw new Error(`newGame: ${created.error}`);
  let state: GameState = created.value;
  const states: GameState[] = [];
  const reports: RoundReport[] = [];
  for (let round = 1; round <= 38; round++) {
    const r = playRound(state, params, { round, sheets: {}, commands: {}, fanDecisions: {} });
    if (!r.ok) throw new Error(`playRound ${round}: ${r.error}`);
    state = r.value.state;
    states.push(state);
    reports.push(r.value.report);
  }
  return { states, reports, final: state };
}

describe.each([
  ['full', 'full' as const],
  ['simplified', 'simplified' as const],
])('T-049 with the 20 real clubs, %s realism', (_label, realism) => {
  const played = season(4049, realism);

  it('has 20 clubs and 10 matches per round', () => {
    expect(clubs).toHaveLength(20);
    expect(played.reports).toHaveLength(38);
    for (const report of played.reports) expect(report.results).toHaveLength(10);
  });

  it('leaves no lastRound in the state after any round, nor after endSeason and startNextSeason', () => {
    for (const [i, state] of played.states.entries()) {
      expect('lastRound' in state, `round ${i + 1}`).toBe(false);
      expect(JSON.stringify(state)).not.toContain('"lastRound"');
    }
    const humans = [clubs[0]!.id];
    const closed = endSeason(played.final, params, humans);
    if (!closed.ok) throw new Error(`endSeason: ${closed.error}`);
    expect('lastRound' in closed.value.state).toBe(false);
    const next = startNextSeason(closed.value.state, params, fixedIdentitySource());
    if (!next.ok) throw new Error(`startNextSeason: ${next.error}`);
    expect('lastRound' in next.value).toBe(false);
    expect(JSON.stringify(next.value)).not.toContain('"lastRound"');
  });

  it('fits every round recap in 8 KB of gzip', () => {
    const sizes = played.reports.map((r) => gzipBytes(roundRecap(r)));
    expect(Math.max(...sizes)).toBeLessThanOrEqual(8 * 1024);
  });

  it('fits the 10 sheets of every round in 3 KB of gzip, with only sheet events', () => {
    const allowed = new Set<string>(MATCH_SHEET_EVENTS);
    const sizes = played.reports.map((r) => {
      const sheets = Object.fromEntries(r.results.map((m) => [m.fixtureId, matchSheet(m)]));
      expect(Object.keys(sheets)).toHaveLength(10);
      for (const s of Object.values(sheets)) {
        for (const e of s.events) expect(allowed.has(e.type)).toBe(true);
      }
      return gzipBytes(sheets);
    });
    expect(Math.max(...sizes)).toBeLessThanOrEqual(3 * 1024);
  });

  it('is pure: same input, same output, and the report is not changed', () => {
    for (const report of played.reports) {
      const before = JSON.stringify(report);
      expect(JSON.stringify(roundRecap(report))).toBe(JSON.stringify(roundRecap(report)));
      for (const m of report.results) {
        expect(JSON.stringify(matchSheet(m))).toBe(JSON.stringify(matchSheet(m)));
      }
      expect(JSON.stringify(report)).toBe(before);
    }
  });
});
