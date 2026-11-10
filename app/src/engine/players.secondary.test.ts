import { describe, expect, it } from 'vitest';
import {
  FIT,
  IMPROVISED_MIN_FIT,
  POSITIONS,
  SECONDARY_FIT,
  secondaryNeighbours,
  secondaryPositionFor,
  validatePlayer,
  type PlayerIssue,
} from './players.ts';
import { Rng, seedFromString } from './rng.ts';
import { testPlayer } from './testing/players.ts';
import type { Position } from './types.ts';

/*
 * The secondary position (docs/design/posicao-secundaria.md; ADR-0022, items 2 and 6; T-078):
 * the neighbours from the FIT table, the draw of `secondaryPositionFor` and the validator. The
 * generation, the academy and the property over whole careers are in
 * generation.secondary.test.ts; the save migration in lib/save/migrations/.
 */

/** "Quem recebe e qual posição", the table of the design, written again (not read from FIT). */
const DESIGN_NEIGHBOURS: Readonly<Record<Position, readonly Position[]>> = {
  GK: [],
  CB: ['FB', 'DM'],
  FB: ['CB', 'DM', 'AM'],
  DM: ['CB', 'FB', 'AM'],
  AM: ['DM', 'ST'],
  ST: ['AM'],
};
const OUTFIELD: readonly Position[] = POSITIONS.filter((p) => p !== 'GK');
const CHANCE = 0.33;

/** The draw written again from the design ("Sorteio e determinismo"), for comparison. */
function byTheDesign(seed: number, id: string, position: Position, chance: number) {
  const neighbours = DESIGN_NEIGHBOURS[position];
  if (neighbours.length === 0) return { secondary: null, draws: 0 };
  const rng = new Rng(seedFromString(`${seed}-secondary-${id}`));
  if (rng.next() >= chance) return { secondary: null, draws: 1 };
  return { secondary: neighbours[rng.int(0, neighbours.length - 1)]!, draws: 2 };
}

/** `n` inputs spread over seeds, clubs and squad numbers, every position in turn. */
function inputs(n: number): { seed: number; id: string; position: Position }[] {
  const out: { seed: number; id: string; position: Position }[] = [];
  for (let i = 0; i < n; i++) {
    const seed = (Math.imul(i, 2654435761) >>> 0) % 0x1_0000_0000;
    const id = `clube-${(i % 20) + 1}#${(i % 125) + 1}`;
    out.push({ seed, id, position: POSITIONS[i % POSITIONS.length]! });
  }
  return out;
}

describe('secondary neighbours (ADR-0022, item 2)', () => {
  it('are those of the design table', () => {
    for (const position of POSITIONS) {
      expect(secondaryNeighbours(position), position).toEqual(DESIGN_NEIGHBOURS[position]);
    }
  });

  it('are computed from FIT: outfield, not the natural, fit ≥ IMPROVISED_MIN_FIT, POSITIONS order', () => {
    for (const position of POSITIONS) {
      const expected = POSITIONS.filter(
        (s) => s !== 'GK' && s !== position && position !== 'GK' && FIT[position][s] >= 0.85,
      );
      expect(secondaryNeighbours(position), position).toEqual(expected);
    }
    expect(IMPROVISED_MIN_FIT).toBe(0.85);
  });

  it('never hold the goal, and a goalkeeper has none', () => {
    expect(secondaryNeighbours('GK')).toEqual([]);
    for (const position of POSITIONS) expect(secondaryNeighbours(position)).not.toContain('GK');
  });

  it('give an empty list for a value that is not a position, without throwing', () => {
    for (const bad of ['LW', '', 'toString', '__proto__']) {
      expect(secondaryNeighbours(bad as Position), bad).toEqual([]);
    }
  });

  it('return a fresh list each time', () => {
    const a = secondaryNeighbours('DM');
    a.push('ST');
    expect(secondaryNeighbours('DM')).toEqual(['CB', 'FB', 'AM']);
  });

  it('keep SECONDARY_FIT at 0.95, above every neighbour of the table', () => {
    expect(SECONDARY_FIT).toBe(0.95);
    for (const position of OUTFIELD) {
      for (const s of secondaryNeighbours(position)) {
        expect(FIT[position][s]).toBeLessThan(SECONDARY_FIT);
      }
    }
  });
});

describe('secondaryPositionFor (ADR-0022, item 2)', () => {
  it('follows the order of the draws of the design, for 30,000 inputs', () => {
    for (const { seed, id, position } of inputs(30_000)) {
      expect(secondaryPositionFor(seed, id, position, CHANCE), `${seed} ${id}`).toBe(
        byTheDesign(seed, id, position, CHANCE).secondary,
      );
    }
  });

  it('is deterministic: the same input gives the same output', () => {
    for (const { seed, id, position } of inputs(2_000)) {
      const first = secondaryPositionFor(seed, id, position, CHANCE);
      for (let k = 0; k < 3; k++)
        expect(secondaryPositionFor(seed, id, position, CHANCE)).toBe(first);
    }
  });

  it('gives fixed values (a change of the draw or of the neighbours fails here)', () => {
    const seed = 20261104;
    const got = Array.from({ length: 12 }, (_, i) => {
      const id = `clube-teste-01#${i + 1}`;
      return OUTFIELD.map((position) => secondaryPositionFor(seed, id, position, CHANCE));
    });
    const none = [null, null, null, null, null];
    // Columns: CB, FB, DM, AM, ST. The draw `u` is the player's (the label has no position), so a
    // player has a secondary in every position or in none.
    expect(got).toEqual([
      none,
      none,
      none,
      none,
      none,
      ['FB', 'CB', 'CB', 'DM', 'AM'],
      ['DM', 'AM', 'AM', 'ST', 'AM'],
      none,
      none,
      ['FB', 'CB', 'CB', 'DM', 'AM'],
      none,
      ['FB', 'DM', 'FB', 'DM', 'AM'],
    ]);
  });

  it('never gives a goalkeeper a secondary position, whatever the chance', () => {
    for (const { seed, id } of inputs(5_000)) {
      for (const chance of [0, CHANCE, 0.5, 1]) {
        expect(secondaryPositionFor(seed, id, 'GK', chance)).toBeNull();
      }
    }
  });

  it('gives only neighbours, never the natural nor the goal', () => {
    for (const { seed, id, position } of inputs(30_000)) {
      const secondary = secondaryPositionFor(seed, id, position, 1);
      if (position === 'GK') {
        expect(secondary).toBeNull();
        continue;
      }
      expect(secondaryNeighbours(position)).toContain(secondary);
      expect(secondary).not.toBe(position);
      expect(secondary).not.toBe('GK');
    }
  });

  it('gives a secondary to 31% to 35% of the outfield players, the neighbours equally', () => {
    const n = 120_000;
    let outfield = 0;
    let withSecondary = 0;
    const byPair = new Map<string, number>();
    const byPosition = new Map<Position, { all: number; with: number }>();
    for (const { seed, id, position } of inputs(n)) {
      if (position === 'GK') continue;
      outfield++;
      const row = byPosition.get(position) ?? { all: 0, with: 0 };
      row.all++;
      const secondary = secondaryPositionFor(seed, id, position, CHANCE);
      if (secondary !== null) {
        withSecondary++;
        row.with++;
        const key = `${position}>${secondary}`;
        byPair.set(key, (byPair.get(key) ?? 0) + 1);
      }
      byPosition.set(position, row);
    }
    const share = withSecondary / outfield;
    expect(share).toBeGreaterThanOrEqual(0.31);
    expect(share).toBeLessThanOrEqual(0.35);
    for (const position of OUTFIELD) {
      const row = byPosition.get(position)!;
      const own = row.with / row.all;
      expect(own, position).toBeGreaterThan(0.31);
      expect(own, position).toBeLessThan(0.35);
      const neighbours = secondaryNeighbours(position);
      for (const s of neighbours) {
        // Each neighbour takes an equal part of those with a secondary (± 2 points).
        const part = (byPair.get(`${position}>${s}`) ?? 0) / row.with;
        expect(Math.abs(part - 1 / neighbours.length), `${position}>${s}`).toBeLessThan(0.02);
      }
    }
  });

  it('gives none with chance 0 and always one with chance 1', () => {
    for (const { seed, id, position } of inputs(5_000)) {
      expect(secondaryPositionFor(seed, id, position, 0)).toBeNull();
      if (position !== 'GK') expect(secondaryPositionFor(seed, id, position, 1)).not.toBeNull();
    }
  });

  it('is monotonic in the chance: 0.33 → 0.40 never removes nor changes a secondary', () => {
    let gained = 0;
    for (const { seed, id, position } of inputs(30_000)) {
      const low = secondaryPositionFor(seed, id, position, CHANCE);
      const high = secondaryPositionFor(seed, id, position, 0.4);
      if (low !== null) expect(high, `${seed} ${id} ${position}`).toBe(low);
      else if (high !== null) gained++;
    }
    expect(gained).toBeGreaterThan(0);
  });

  it('depends on the seed and on the id, not on the order of the calls', () => {
    const a = inputs(3_000).map(({ seed, id, position }) =>
      secondaryPositionFor(seed, id, position, CHANCE),
    );
    const b = inputs(3_000)
      .reverse()
      .map(({ seed, id, position }) => secondaryPositionFor(seed, id, position, CHANCE))
      .reverse();
    expect(b).toEqual(a);
    // Another career (seed) gives other secondaries to the same squad numbers.
    const ids = Array.from({ length: 400 }, (_, i) => `clube-1#${i + 1}`);
    const of = (seed: number) => ids.map((id) => secondaryPositionFor(seed, id, 'DM', CHANCE));
    expect(of(1)).not.toEqual(of(2));
  });

  it('never throws, and a chance or a position that is not valid gives null', () => {
    for (const chance of [Number.NaN, -1]) {
      expect(secondaryPositionFor(1, 'clube-1#1', 'DM', chance)).toBeNull();
    }
    for (const bad of ['LW', '', 'toString', '__proto__']) {
      expect(secondaryPositionFor(1, 'clube-1#1', bad as Position, 1)).toBeNull();
    }
  });
});

function issuesOf(raw: unknown): string[] {
  const result = validatePlayer(raw);
  return result.ok ? [] : result.detail.map((i: PlayerIssue) => `${i.field}:${i.problem}`);
}

describe('validatePlayer: secondaryPosition (ADR-0022, item 6)', () => {
  it('demands the key', () => {
    const raw: Record<string, unknown> = { ...testPlayer() };
    delete raw.secondaryPosition;
    expect(issuesOf(raw)).toEqual(['secondaryPosition:missing']);
  });

  it('accepts null and any outfield position other than the natural, neighbour or not', () => {
    for (const position of OUTFIELD) {
      expect(issuesOf(testPlayer({ position, secondaryPosition: null })), position).toEqual([]);
      for (const secondary of OUTFIELD) {
        if (secondary === position) continue;
        // Not a neighbour too (a change of the FIT table must never invalidate a save).
        const raw = testPlayer({ position, secondaryPosition: secondary });
        expect(issuesOf(raw), `${position} ${secondary}`).toEqual([]);
      }
    }
    const striker = validatePlayer(testPlayer({ secondaryPosition: 'CB' }));
    expect(striker.ok && striker.value.secondaryPosition).toBe('CB');
    const none = validatePlayer(testPlayer({ secondaryPosition: null }));
    expect(none.ok && none.value.secondaryPosition).toBeNull();
  });

  it('refuses the goal, the natural, a text out of POSITIONS and a number', () => {
    for (const value of ['GK', 'ST', 'LW', 'st', '', 7, true, {}, [], undefined]) {
      expect(issuesOf({ ...testPlayer(), secondaryPosition: value }), String(value)).toEqual([
        'secondaryPosition:invalid-secondary-position',
      ]);
    }
  });

  it('refuses any secondary position for a goalkeeper, and takes his null', () => {
    for (const value of ['CB', 'FB', 'DM', 'AM', 'ST', 'GK']) {
      expect(
        issuesOf(testPlayer({ position: 'GK', secondaryPosition: value as Position })),
        value,
      ).toEqual(['secondaryPosition:invalid-secondary-position']);
    }
    expect(issuesOf(testPlayer({ position: 'GK', secondaryPosition: null }))).toEqual([]);
  });

  it('reports the problem with the field and the value', () => {
    const result = validatePlayer({ ...testPlayer(), secondaryPosition: 'GK' });
    expect(result.ok ? [] : result.detail).toEqual([
      { field: 'secondaryPosition', problem: 'invalid-secondary-position', value: 'GK' },
    ]);
  });
});
