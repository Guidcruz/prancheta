import { describe, expect, it } from 'vitest';
import { FORMATIONS, FORMATION_SLOTS } from '@engine';
import { PITCH_COLUMNS, PITCH_LAYOUT, PITCH_ROWS } from './pitch-layout';

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
