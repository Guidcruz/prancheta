import { describe, expect, it } from 'vitest';
import { suggestSheet } from './ai.ts';
import { FORMATIONS, FORMATION_SLOTS } from './formations.ts';
import type { GameState } from './game.ts';
import type { DraftLineup } from './lineup.ts';
import type { Player } from './players.ts';
import { Rng, seedFromString } from './rng.ts';
import { selectionValue } from './selection.ts';
import {
  FORMATION_MULTIPLIERS,
  FORMATION_SECTORS,
  sectorStrengths,
  sheetStrength,
  teamStrength,
  type SheetStrength,
} from './strength.ts';
import { deepFrozen, drawnDraft, drawnState } from './testing/draft.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { PlayerId } from './types.ts';

/*
 * The strength of the sheet being edited (docs/02-architecture.md, 4.1, "Ficha em edição e
 * leituras para a escalação"; escalacao.md, "Força do time"; the scale approved by the CEO on
 * 2026-11-07; T-076), criteria (a) to (d): equal to `teamStrength` and `sectorStrengths` with 11
 * available at condition 100; a free slot never raises a number (property); an unavailable
 * starter is worth a free slot; pure and never NaN.
 */
const FULL = process.env.PROPERTY_FULL === '1';
const CASES = FULL ? 20_000 : 2_000;
const params = testParams();
const base = testGame();
const clubIds = Object.keys(base.clubs);

/** `base` with everyone at condition 100 and morale 50. */
function freshState(): GameState {
  const players: Record<PlayerId, Player> = {};
  for (const [id, p] of Object.entries(base.players)) {
    players[id] = { ...p, condition: 100, morale: 50, injuryRounds: 0, suspendedGames: 0 };
  }
  return { ...base, players };
}

function values(s: SheetStrength): number[] {
  return [s.overall, s.def, s.mid, s.atk];
}

describe('sheetStrength', () => {
  it('(a) equals teamStrength and sectorStrengths with 11 available at condition 100', () => {
    const state = freshState();
    for (const clubId of clubIds) {
      for (const formation of FORMATIONS) {
        const { lineup } = suggestSheet(state, params, clubId, undefined, {
          controller: 'human',
          formation,
        });
        expect(lineup.formation).toBe(formation);
        expect(lineup.starters).toHaveLength(11);
        const strength = sheetStrength(state, clubId, lineup)!;
        expect(strength.overall).toBe(teamStrength(state, clubId, lineup));
        const squad = state.squads[clubId]!.map((id) => state.players[id]!);
        const sectors = sectorStrengths(
          squad,
          { lineup, tactic: { posture: 'balanced', pressure: 'medium' } },
          { home: 0 },
          params,
        );
        if (!sectors.ok) throw new Error('sectorStrengths refused the suggestion');
        expect(strength.def).toBe(sectors.value.def);
        expect(strength.mid).toBe(sectors.value.mid);
        expect(strength.atk).toBe(sectors.value.atk);
      }
    }
  });

  it('follows the scale: Σv/11, the sector means times the formation, the goalkeeper only in overall', () => {
    const state = drawnState(base, clubIds[0]!, new Rng(7), 0);
    const clubId = clubIds[0]!;
    const { lineup } = suggestSheet(state, params, clubId, undefined, {
      controller: 'human',
      formation: '3-5-2',
    });
    const v = lineup.starters.map((id, i) =>
      selectionValue(state.players[id]!, FORMATION_SLOTS['3-5-2'][i]!),
    );
    const sectors = FORMATION_SECTORS['3-5-2'];
    const mean = (key: string) => {
      const picked = v.filter((_, i) => sectors[i] === key);
      return picked.reduce((a, b) => a + b, 0) / picked.length;
    };
    const strength = sheetStrength(state, clubId, lineup)!;
    expect(strength.overall).toBeCloseTo(v.reduce((a, b) => a + b, 0) / 11, 10);
    expect(strength.def).toBeCloseTo(mean('def') * FORMATION_MULTIPLIERS['3-5-2'].def, 10);
    expect(strength.mid).toBeCloseTo(mean('mid') * FORMATION_MULTIPLIERS['3-5-2'].mid, 10);
    expect(strength.atk).toBeCloseTo(mean('atk') * FORMATION_MULTIPLIERS['3-5-2'].atk, 10);
    // The goalkeeper: a free goal lowers only the overall.
    const noKeeper = sheetStrength(state, clubId, {
      formation: '3-5-2',
      starters: [null, ...lineup.starters.slice(1)],
    })!;
    expect(noKeeper.overall).toBeCloseTo(strength.overall - v[0]! / 11, 10);
    expect([noKeeper.def, noKeeper.mid, noKeeper.atk]).toEqual([
      strength.def,
      strength.mid,
      strength.atk,
    ]);
  });

  it('counts 0 for a free slot, an id out of the squad and the second occurrence of an id', () => {
    const clubId = clubIds[0]!;
    const state = freshState();
    const { lineup } = suggestSheet(state, params, clubId, undefined, { controller: 'human' });
    const free = (i: number): (PlayerId | null)[] =>
      lineup.starters.map((id, j) => (j === i ? null : id));
    const foreign = state.squads[clubIds[1]!]![0]!;
    for (let i = 0; i < 11; i++) {
      const withFree = sheetStrength(state, clubId, { ...lineup, starters: free(i) });
      const withForeign = sheetStrength(state, clubId, {
        ...lineup,
        starters: lineup.starters.map((id, j) => (j === i ? foreign : id)),
      });
      expect(withForeign).toEqual(withFree);
      if (i > 0) {
        // Slot 0 repeated in slot i: the repetition counts 0.
        const repeated = sheetStrength(state, clubId, {
          ...lineup,
          starters: lineup.starters.map((id, j) => (j === i ? lineup.starters[0]! : id)),
        });
        expect(repeated).toEqual(withFree);
      }
    }
    const empty = sheetStrength(state, clubId, { formation: '4-4-2', starters: [] });
    expect(empty).toEqual({ overall: 0, def: 0, mid: 0, atk: 0 });
  });

  it('(c) an unavailable starter is worth the same as a free slot', () => {
    for (const clubId of clubIds) {
      const rng = new Rng(seedFromString(`sheet-strength-c-${clubId}`));
      const state = drawnState(base, clubId, rng, 0.3);
      const draft = drawnDraft(state, clubId, rng, { repeats: false }).lineup;
      const outside = state.squads[clubId]!.filter((id) => !draft.starters.includes(id));
      for (let i = 0; i < 11; i++) {
        const id = outside[i % outside.length]!;
        const injured = { ...state.players[id]!, injuryRounds: 2 };
        const suspended = { ...state.players[id]!, suspendedGames: 1 };
        const freeSlot = sheetStrength(state, clubId, {
          ...draft,
          starters: draft.starters.map((s, j) => (j === i ? null : s)),
        });
        const starters = draft.starters.map((s, j) => (j === i ? id : s));
        for (const player of [injured, suspended]) {
          const withOut = { ...state, players: { ...state.players, [id]: player } };
          expect(sheetStrength(withOut, clubId, { ...draft, starters })).toEqual(freeSlot);
        }
      }
    }
  });

  it(
    `(b) freeing a starter's slot never raises a number, and never NaN (${CASES} drafts)`,
    { timeout: 300_000 },
    () => {
      const failures: string[] = [];
      for (let n = 0; n < CASES; n++) {
        const rng = new Rng(seedFromString(`sheet-strength-b-${n}`));
        const clubId = clubIds[rng.int(0, clubIds.length - 1)]!;
        const state = drawnState(base, clubId, rng);
        // The save never holds a repeated id (ADR-0021); with one, freeing the first occurrence
        // would make the second count.
        const draft: DraftLineup = drawnDraft(state, clubId, rng, { repeats: false }).lineup;
        const before = sheetStrength(state, clubId, draft)!;
        if (!values(before).every(Number.isFinite)) failures.push(`case ${n}: ${values(before)}`);
        for (let i = 0; i < 11; i++) {
          if (draft.starters[i] === null) continue;
          const after = sheetStrength(state, clubId, {
            ...draft,
            starters: draft.starters.map((id, j) => (j === i ? null : id)),
          })!;
          const raised = values(after).some((x, k) => x > values(before)[k]!);
          if (raised || !values(after).every(Number.isFinite)) {
            failures.push(`case ${n}, slot ${i}: ${values(before)} -> ${values(after)}`);
          }
        }
      }
      expect(failures).toEqual([]);
    },
  );

  it('(d) is pure: same answer twice, input unchanged; undefined only for a club with no squad', () => {
    const rng = new Rng(11);
    const clubId = clubIds[3]!;
    const state = deepFrozen(drawnState(base, clubId, rng));
    const draft = deepFrozen(drawnDraft(state, clubId, rng).lineup);
    const first = sheetStrength(state, clubId, draft);
    expect(sheetStrength(state, clubId, draft)).toEqual(first);
    expect(first).toBeDefined();
    expect(sheetStrength(state, 'nao-existe', draft)).toBeUndefined();
    // A damaged formation reads as 4-4-2, never throws nor NaN.
    const damaged = { ...draft, formation: 'x' as DraftLineup['formation'] };
    expect(sheetStrength(state, clubId, damaged)).toEqual(
      sheetStrength(state, clubId, { ...draft, formation: '4-4-2' }),
    );
  });
});
