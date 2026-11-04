import { describe, expect, it } from 'vitest';
import { bestForSlot, correctedCondition, selectionValue, winsTie } from './selection.ts';
import { testPlayer } from './testing/players.ts';

describe('selectionValue (ia-clubes.md, "Escalação", step 2)', () => {
  it('is overall × fit × (0.80 + 0.20 × condition / 100)', () => {
    const striker = testPlayer({ position: 'ST', overall: 80, condition: 70 });
    expect(selectionValue(striker, 'ST')).toBeCloseTo(80 * 1 * 0.94, 12);
    // A centre-back slot: fit(ST, CB) = 0.65.
    expect(selectionValue(striker, 'CB')).toBeCloseTo(80 * 0.65 * 0.94, 12);
    expect(selectionValue({ ...striker, condition: 100 }, 'ST')).toBe(80);
  });

  it('reads a damaged condition clipped to 0..100 (NaN as 0)', () => {
    expect(correctedCondition(testPlayer({ condition: Number.NaN }))).toBe(0);
    expect(correctedCondition(testPlayer({ condition: 140 }))).toBe(100);
    expect(correctedCondition(testPlayer({ condition: -5 }))).toBe(0);
    expect(selectionValue(testPlayer({ overall: 80, condition: 140 }), 'ST')).toBe(80);
  });
});

describe('bestForSlot and the tie-break (step 3)', () => {
  const base = { position: 'ST' as const, overall: 70, age: 27, condition: 100 };

  it('takes the highest selection value', () => {
    const a = testPlayer({ ...base, id: 'c#1', overall: 70 });
    const b = testPlayer({ ...base, id: 'c#2', overall: 75 });
    expect(bestForSlot([a, b], 'ST')?.id).toBe('c#2');
  });

  it('breaks ties by higher overall, then younger, then the lower id number', () => {
    // Same value, 60, in a MEI slot: a MEI of 60 (fit 1) and a ZAG of 80 (fit 0.75, exact in
    // binary): the higher overall wins.
    const am = testPlayer({ ...base, id: 'c#1', position: 'AM', overall: 60 });
    const cb = testPlayer({ ...base, id: 'c#2', position: 'CB', overall: 80 });
    expect(selectionValue(cb, 'AM')).toBe(selectionValue(am, 'AM'));
    expect(bestForSlot([am, cb], 'AM')?.id).toBe('c#2');

    const older = testPlayer({ ...base, id: 'c#1', age: 30 });
    const younger = testPlayer({ ...base, id: 'c#3', age: 22 });
    expect(bestForSlot([older, younger], 'ST')?.id).toBe('c#3');

    // `#2` beats `#10`: the number, not the text (a text comparison puts "#10" first).
    const ten = testPlayer({ ...base, id: 'c#10' });
    const two = testPlayer({ ...base, id: 'c#2' });
    expect(bestForSlot([ten, two], 'ST')?.id).toBe('c#2');
    expect(winsTie(two, 1, ten, 0)).toBe(true);
    expect(winsTie(ten, 0, two, 1)).toBe(false);
  });

  it('skips the excluded players and returns undefined when nobody is left', () => {
    const a = testPlayer({ ...base, id: 'c#1', overall: 80 });
    const b = testPlayer({ ...base, id: 'c#2', overall: 60 });
    expect(bestForSlot([a, b], 'ST', (p) => p.id === 'c#1')?.id).toBe('c#2');
    expect(bestForSlot([a], 'ST', () => true)).toBeUndefined();
    expect(bestForSlot([], 'GK')).toBeUndefined();
  });
});
