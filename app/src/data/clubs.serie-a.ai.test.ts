import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BENCH_SIZE,
  FORMATION_SLOTS,
  newGame,
  suggestSheet,
  validateLineup,
} from '../engine/index.ts';
import { BENCH_LINES } from '../engine/ai.ts';
import type { ClubDef, GameState, PlayerId } from '../engine/index.ts';
import { fixedIdentitySource } from '../engine/testing/identity.ts';
import { testParams } from '../engine/testing/params.ts';

/*
 * The pre-match AI (T-011, US-011) with the 20 real clubs of the game: in 50 careers, every club's
 * suggested sheet for its round-1 match passes validateLineup, with a goalkeeper in goal, one
 * goalkeeper in the XI, a full bench with a goalkeeper and every line, and the formation of its
 * profile; the same career gives the same sheets.
 */
const clubs = JSON.parse(
  readFileSync(new URL('./clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];
const params = testParams();
const CAREERS = 50;

function start(seed: number): GameState {
  const result = newGame(
    { seed, year: 2026, realism: 'full' },
    clubs,
    params,
    fixedIdentitySource(),
  );
  if (!result.ok) throw new Error('newGame failed');
  return result.value;
}

describe('suggestSheet with the 20 real clubs', () => {
  it(`passes validateLineup for every club in ${CAREERS} careers`, { timeout: 60_000 }, () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= CAREERS; seed++) {
      const state = start(seed);
      for (const club of Object.values(state.clubs)) {
        const id = club.def.id;
        const sheet = suggestSheet(state, params, id);
        const { lineup } = sheet;
        const where = `seed ${seed} ${id}`;
        if (!validateLineup(state, id, sheet).ok) problems.push(`${where}: invalid`);
        const xi = lineup.starters.map((p: PlayerId) => state.players[p]!);
        if (FORMATION_SLOTS[lineup.formation][0] !== 'GK' || xi[0]?.position !== 'GK') {
          problems.push(`${where}: no goalkeeper in goal`);
        }
        if (xi.filter((p) => p.position === 'GK').length !== 1) {
          problems.push(`${where}: not one goalkeeper`);
        }
        const bench = lineup.bench.map((p: PlayerId) => state.players[p]!);
        if (bench.length !== BENCH_SIZE) problems.push(`${where}: bench of ${bench.length}`);
        if (bench[0]?.position !== 'GK') problems.push(`${where}: bench without goalkeeper`);
        for (const line of ['def', 'mid', 'atk'] as const) {
          if (!bench.some((p) => BENCH_LINES[p.position] === line)) {
            problems.push(`${where}: bench without ${line}`);
          }
        }
        if (club.profile !== 'chaotic' && !club.preferredFormations.includes(lineup.formation)) {
          problems.push(`${where}: formation ${lineup.formation} not preferred`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('is deterministic for a career', () => {
    const a = start(7);
    const b = start(7);
    for (const id of Object.keys(a.clubs)) {
      expect(JSON.stringify(suggestSheet(a, params, id))).toBe(
        JSON.stringify(suggestSheet(b, params, id)),
      );
    }
  });
});
