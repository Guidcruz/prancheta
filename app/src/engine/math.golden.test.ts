import { describe, expect, it } from 'vitest';
import { expectGolden } from './testing/golden.ts';
import {
  EXP_TABLE_SIZE,
  expTable,
  expTableInputs,
  kSwitch,
  reductionK,
  ulpStep,
} from './testing/exp-table.ts';

/*
 * Table golden of the engine's exp (ADR-0020, test 3): the bits of exp on 4,096 fixed inputs,
 * compared with __golden__/exp-table.json, never with a Math.exp. The same table runs in the
 * browser golden (tests/e2e/golden.spec.ts, Chromium and WebKit). A change in math.ts that moves
 * one bit of it needs a bump of ENGINE_VERSION.
 */
describe('golden: exp', () => {
  it('keeps the bits of exp on the 4,096 inputs of the table', () => {
    const table = expTable();
    expect(table).toHaveLength(EXP_TABLE_SIZE);
    expect(new Set(table.map((entry) => entry.split(' ')[0])).size).toBe(EXP_TABLE_SIZE);
    expectGolden('exp-table', table);
  });

  it('crosses each change of the general k it lists: 2 inputs with the old k, 3 with the new', () => {
    const inputs = new Set(expTableInputs());
    let crossings = 0;
    for (let m = -13; m <= 12; m++) {
      if (m === -1 || m === 0) continue;
      const point = kSwitch(m);
      const window = [-2, -1, 0, 1, 2].map((d) => ulpStep(point, d));
      for (const x of window) expect(inputs.has(x), `m = ${m}`).toBe(true);
      const ks = window.map(reductionK);
      expect(ks, `m = ${m}`).toEqual([m, m, m + 1, m + 1, m + 1]);
      crossings++;
    }
    expect(crossings).toBe(24);
  });
});
