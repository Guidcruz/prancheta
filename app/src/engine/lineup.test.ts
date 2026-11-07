import { describe, expect, expectTypeOf, it } from 'vitest';
import { FORMATIONS, FORMATION_SLOTS } from './formations.ts';
import {
  BENCH_SIZE,
  draftFromSheet,
  type DraftLineup,
  type DraftSheet,
  type Lineup,
  type TeamSheet,
} from './lineup.ts';
import type { PlayerId } from './types.ts';

/*
 * The coach's sheet being edited (ADR-0021, item 2; docs/02-architecture.md, 4.1, "Ficha em
 * edição e leituras para a escalação"; T-075): the types and `draftFromSheet`.
 */

const ids = (prefix: string, n: number): PlayerId[] =>
  Array.from({ length: n }, (_, i) => `${prefix}#${i + 1}`);

function sheet(starters: number, bench: number): TeamSheet {
  const xi = ids('s', starters);
  return {
    lineup: {
      formation: '4-3-3',
      starters: xi,
      bench: ids('b', bench),
      captains: xi.slice(0, 2),
      penaltyTakers: xi.slice(3, 5),
      freeKickTakers: [xi[1] ?? 'x#1'],
    },
    tactic: { posture: 'attacking', pressure: 'high' },
  };
}

describe('DraftLineup and DraftSheet (types)', () => {
  it('a free slot is null, in the 11 and on the bench; the lists hold only ids', () => {
    expectTypeOf<DraftLineup['starters']>().toEqualTypeOf<readonly (PlayerId | null)[]>();
    expectTypeOf<DraftLineup['bench']>().toEqualTypeOf<readonly (PlayerId | null)[]>();
    expectTypeOf<DraftLineup['captains']>().toEqualTypeOf<readonly PlayerId[]>();
    expectTypeOf<DraftLineup['penaltyTakers']>().toEqualTypeOf<readonly PlayerId[]>();
    expectTypeOf<DraftLineup['freeKickTakers']>().toEqualTypeOf<readonly PlayerId[]>();
    expectTypeOf<DraftLineup['formation']>().toEqualTypeOf<Lineup['formation']>();
    expectTypeOf<DraftSheet['tactic']>().toEqualTypeOf<TeamSheet['tactic']>();
  });

  it('a draft is not a team sheet: the simulation can never take one', () => {
    expectTypeOf<DraftSheet>().not.toMatchTypeOf<TeamSheet>();
    expectTypeOf<DraftLineup>().not.toMatchTypeOf<Lineup>();
  });

  it('every formation has the 11 slots the draft always has', () => {
    for (const formation of FORMATIONS) expect(FORMATION_SLOTS[formation]).toHaveLength(11);
  });
});

describe('draftFromSheet (ADR-0021)', () => {
  it('fills the 11 and the bench of 7 with null; lists and tactic as they are', () => {
    const input = sheet(9, 4);
    const draft = draftFromSheet(input);
    expect(draft).toEqual({
      lineup: {
        formation: '4-3-3',
        starters: [...ids('s', 9), null, null],
        bench: [...ids('b', 4), null, null, null],
        captains: ['s#1', 's#2'],
        penaltyTakers: ['s#4', 's#5'],
        freeKickTakers: ['s#2'],
      },
      tactic: { posture: 'attacking', pressure: 'high' },
    });
  });

  it('keeps a full sheet slot for slot', () => {
    const input = sheet(11, BENCH_SIZE);
    const draft = draftFromSheet(input);
    expect(draft.lineup.starters).toEqual(input.lineup.starters);
    expect(draft.lineup.bench).toEqual(input.lineup.bench);
  });

  it('always gives 11 starters and 7 bench slots, cutting a longer list', () => {
    for (let starters = 0; starters <= 13; starters++) {
      for (let bench = 0; bench <= 9; bench++) {
        const input = sheet(starters, bench);
        const draft = draftFromSheet(input);
        expect(draft.lineup.starters).toHaveLength(11);
        expect(draft.lineup.bench).toHaveLength(BENCH_SIZE);
        // Slot i of the draft is slot i of the sheet: nothing moves.
        draft.lineup.starters.forEach((id, i) => {
          expect(id).toBe(input.lineup.starters[i] ?? null);
        });
        draft.lineup.bench.forEach((id, i) => expect(id).toBe(input.lineup.bench[i] ?? null));
      }
    }
  });

  it('is pure: the input is not changed and the output shares no list with it', () => {
    const input = sheet(10, 3);
    const frozen = structuredClone(input);
    const draft = draftFromSheet(Object.freeze(input));
    expect(input).toEqual(frozen);
    expect(draft.lineup.captains).not.toBe(input.lineup.captains);
    expect(draft.lineup.penaltyTakers).not.toBe(input.lineup.penaltyTakers);
    expect(draft.lineup.freeKickTakers).not.toBe(input.lineup.freeKickTakers);
    expect(draft.tactic).not.toBe(input.tactic);
    expect(draftFromSheet(input)).toEqual(draft);
  });
});
