import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as engine from './index.ts';
import { completeSheet, sheetProblems } from './draft.ts';
import { draftFromSheet } from './lineup.ts';
import { suggestSheet, validateLineup } from './ai.ts';
import { fitLevel } from './players.ts';
import { isAvailable, sheetStrength } from './strength.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import { ENGINE_VERSION } from './version.ts';

/*
 * QA acceptance for T-076 (docs/02-architecture.md, 4.1, "Ficha em edição e leituras para a
 * escalação"): the contract points that the unit and property tests do not pin directly.
 */
const params = testParams();
const state = testGame();
const clubId = Object.keys(state.clubs)[0]!;

function read(file: string): string {
  return readFileSync(new URL(file, import.meta.url), 'utf8');
}

describe('T-076 acceptance', () => {
  it('keeps ENGINE_VERSION at 16 (no golden depends on the readings)', () => {
    expect(ENGINE_VERSION).toBe(16);
  });

  it('exports the seven functions of the contract from index.ts', () => {
    for (const name of [
      'fitLevel',
      'isAvailable',
      'sheetStrength',
      'reshapeLineup',
      'completeSheet',
      'sheetRoles',
      'sheetProblems',
    ]) {
      expect(typeof (engine as Record<string, unknown>)[name], name).toBe('function');
    }
    expect((engine as Record<string, unknown>)['pickEleven']).toBeUndefined();
  });

  it('isAvailable: neither injured nor suspended, boundaries at 0', () => {
    expect(isAvailable({ injuryRounds: 0, suspendedGames: 0 })).toBe(true);
    expect(isAvailable({ injuryRounds: 1, suspendedGames: 0 })).toBe(false);
    expect(isAvailable({ injuryRounds: 0, suspendedGames: 1 })).toBe(false);
    expect(isAvailable({ injuryRounds: 3, suspendedGames: 2 })).toBe(false);
  });

  it('fitLevel: the three levels, including the 0.90 and 0.85 edges', () => {
    expect(fitLevel('CB', 'CB')).toBe('natural');
    expect(fitLevel('CB', 'FB')).toBe('improvised');
    expect(fitLevel('FB', 'DM')).toBe('improvised');
    expect(fitLevel('GK', 'ST')).toBe('outOfPosition');
  });

  it('strength.ts and draft.ts are free of Rng, Math.random and Date.now', () => {
    for (const file of ['./strength.ts', './draft.ts']) {
      const source = read(file);
      expect(source, file).not.toMatch(/^import .*rng\.ts/m);
      expect(source, file).not.toMatch(/new Rng\(|Math\.random|Date\.now/);
    }
  });

  it('the flow functions never call the new readings', () => {
    for (const file of ['./game.ts', './round.ts', './season.ts']) {
      let source = '';
      try {
        source = read(file);
      } catch {
        continue;
      }
      expect(source, file).not.toMatch(
        /\b(sheetStrength|reshapeLineup|completeSheet|sheetProblems|sheetRoles)\b/,
      );
    }
  });

  it('sheetStrength never gives NaN, even for an empty sheet and for an unknown club', () => {
    const empty = {
      formation: '4-4-2' as const,
      starters: Array<null>(11).fill(null),
    };
    const s = sheetStrength(state, clubId, empty)!;
    expect(Object.values(s)).toEqual([0, 0, 0, 0]);
    expect(sheetStrength(state, 'nope' as never, empty)).toBeUndefined();
  });

  it('the suggestion is a ready sheet, passes completeSheet unchanged and validates', () => {
    const { lineup, tactic } = suggestSheet(state, params, clubId, undefined, {
      controller: 'human',
      formation: '4-3-3',
    });
    const sheet = draftFromSheet({ lineup, tactic } as never);
    expect(sheetProblems(state, clubId, sheet).ready).toBe(true);
    const done = completeSheet(state, clubId, sheet);
    expect(done.lineup.starters).toEqual(lineup.starters);
    expect(done.lineup.bench).toEqual(lineup.bench);
    expect(validateLineup(state, clubId, done).ok).toBe(true);
  });
});
