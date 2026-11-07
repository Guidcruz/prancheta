import { describe, expect, it } from 'vitest';
import { FORMATIONS, FORMATION_SLOTS } from '@engine';
import { PITCH_COLUMNS, PITCH_LAYOUT, PITCH_LINES, PITCH_ROWS } from './pitch-layout';

describe('PITCH_LINES (tatica.md, "Miniatura da formação")', () => {
  it.each(FORMATIONS)('%s has the lines its name reads', (formation) => {
    const sizes = PITCH_LINES[formation].map((line) => line.length);
    expect(sizes.join('-')).toBe(formation);
  });

  it.each(FORMATIONS)('%s puts every outfield slot in exactly one line', (formation) => {
    const all = PITCH_LINES[formation].flat().sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
  });

  it.each(FORMATIONS)('%s runs each line left to right on the pitch', (formation) => {
    const cells = PITCH_LAYOUT[formation];
    for (const line of PITCH_LINES[formation]) {
      const cols = line.map((slot) => cells[slot]!.col);
      expect(cols).toEqual([...cols].sort((a, b) => a - b));
      expect(new Set(cols).size).toBe(cols.length);
    }
  });
});

describe('PITCH_LAYOUT (escalacao.md, "Desenho do campo")', () => {
  it.each(FORMATIONS)('%s has one cell per slot, inside the grid', (formation) => {
    const cells = PITCH_LAYOUT[formation];
    expect(cells).toHaveLength(FORMATION_SLOTS[formation].length);
    for (const { col, row } of cells) {
      expect(col).toBeGreaterThanOrEqual(1);
      expect(col + 1).toBeLessThanOrEqual(PITCH_COLUMNS);
      expect(row).toBeGreaterThanOrEqual(1);
      expect(row + 1).toBeLessThanOrEqual(PITCH_ROWS);
    }
  });

  it.each(FORMATIONS)('%s never puts two slots on the same cell', (formation) => {
    const cells = PITCH_LAYOUT[formation];
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i]!;
        const b = cells[j]!;
        const apart = Math.abs(a.col - b.col) >= 2 || Math.abs(a.row - b.row) >= 2;
        expect(apart, `${formation}: slots ${i} and ${j}`).toBe(true);
      }
    }
  });

  it.each(FORMATIONS)('%s keeps the goalkeeper at the bottom, alone', (formation) => {
    const [gk, ...rest] = PITCH_LAYOUT[formation];
    expect(FORMATION_SLOTS[formation][0]).toBe('GK');
    for (const cell of rest) expect(cell.row).toBeLessThan(gk!.row);
  });
});
