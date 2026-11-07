import { describe, expect, it } from 'vitest';
import { pickBench, pickEleven, suggestSheet, validateLineup } from './ai.ts';
import { FORMATIONS } from './formations.ts';
import { Rng, seedFromString } from './rng.ts';
import { isAvailable } from './strength.ts';
import { drawnState } from './testing/draft.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { Formation } from './types.ts';

/*
 * `SuggestOptions.formation` (docs/02-architecture.md, 4.1; decision 6 of the CEO in T-029;
 * T-076): with `controller: 'human'` and a known formation the XI and the bench are picked in
 * it; with `controller: 'ai'` or an unknown value the option is ignored and the sheet is the one
 * without it (property over the 20 clubs, random availability and the six formations).
 */
const params = testParams();
const base = testGame();
const clubIds = Object.keys(base.clubs);
const FULL = process.env.PROPERTY_FULL === '1';
const ROUNDS = FULL ? 200 : 20;

describe('suggestSheet with a formation', () => {
  it('picks the XI and the bench of the coach in the formation asked for', () => {
    for (const clubId of clubIds) {
      const state = drawnState(base, clubId, new Rng(seedFromString(`formation-${clubId}`)), 0.3);
      const available = state.squads[clubId]!.map((id) => state.players[id]!).filter(isAvailable);
      for (const formation of FORMATIONS) {
        const sheet = suggestSheet(state, params, clubId, undefined, {
          controller: 'human',
          formation,
        });
        expect(sheet.lineup.formation).toBe(formation);
        const xi = pickEleven(available, formation, params.ai).starters;
        expect(sheet.lineup.starters).toEqual(xi.map((p) => p.id));
        const rest = available.filter((p) => !xi.includes(p));
        expect(sheet.lineup.bench).toEqual(pickBench(rest).map((p) => p.id));
        expect(validateLineup(state, clubId, sheet).ok).toBe(true);
      }
    }
  });

  it('is ignored with controller ai, with an unknown value and without the option', () => {
    const failures: string[] = [];
    for (let n = 0; n < ROUNDS; n++) {
      for (const clubId of clubIds) {
        const rng = new Rng(seedFromString(`formation-ignored-${n}-${clubId}`));
        const state = { ...drawnState(base, clubId, rng, 0.3), round: 1 + (n % 38) };
        const opponentId = clubIds[(clubIds.indexOf(clubId) + 1 + n) % clubIds.length]!;
        const formation = FORMATIONS[rng.int(0, FORMATIONS.length - 1)]!;
        const ai = suggestSheet(state, params, clubId, opponentId);
        const human = suggestSheet(state, params, clubId, opponentId, { controller: 'human' });
        const cases: [string, unknown, unknown][] = [
          [
            'ai + formation',
            suggestSheet(state, params, clubId, opponentId, { controller: 'ai', formation }),
            ai,
          ],
          [
            'default + formation',
            suggestSheet(state, params, clubId, opponentId, { formation }),
            ai,
          ],
          [
            'human + unknown',
            suggestSheet(state, params, clubId, opponentId, {
              controller: 'human',
              formation: 'x' as Formation,
            }),
            human,
          ],
          [
            'human + undefined',
            suggestSheet(state, params, clubId, opponentId, {
              controller: 'human',
              formation: undefined,
            }),
            human,
          ],
        ];
        for (const [label, got, want] of cases) {
          if (JSON.stringify(got) !== JSON.stringify(want))
            failures.push(`${n} ${clubId} ${label}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('keeps the captain, the takers and the tactic rule of the coach (traditional)', () => {
    const clubId = clubIds[2]!;
    const sheet = suggestSheet(base, params, clubId, undefined, {
      controller: 'human',
      formation: '3-4-3',
    });
    const without = suggestSheet(base, params, clubId, undefined, { controller: 'human' });
    expect(sheet.lineup.captains).toHaveLength(1);
    expect(sheet.lineup.starters).toContain(sheet.lineup.captains[0]);
    expect(sheet.lineup.starters).toContain(sheet.lineup.penaltyTakers[0]);
    expect(sheet.lineup.starters).toContain(sheet.lineup.freeKickTakers[0]);
    // Neutral ground, no opponent: Δ = 0, balanced and medium, as without the option.
    expect(sheet.tactic).toEqual(without.tactic);
  });
});
