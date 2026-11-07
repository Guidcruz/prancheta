import type { Formation } from '@engine';

/*
 * Where each of the 11 slots of a formation sits on the lineup pitch (docs/design/telas/
 * escalacao.md, "Desenho do campo"). Visual only: the slot order is the engine's
 * `FORMATION_SLOTS[formation]` (GK, CB, FB, DM, AM, ST), and this table never decides who plays
 * where.
 *
 * The pitch is a grid of 8 columns and 10 rows, attack at the top and the goal at the bottom.
 * Every slot covers 2 columns and 2 rows, so a slot can sit half a step to the side of or behind
 * its neighbour: that is how the lines of five (5-3-2 at the back, 3-5-2 in midfield) fit at
 * 360px with slots a quarter of the pitch wide, wide enough for "Fora de posição" in two lines.
 * Rule of the table: two slots never share a cell (|Δcol| ≥ 2 or |Δrow| ≥ 2), checked by
 * `pitch-layout.test.ts`.
 *
 * The first of each pair (the two FB, the two DM...) is the one on the left, as seen by the
 * player looking at the screen (own goal at the bottom).
 */

/** Columns and rows of the pitch grid. */
export const PITCH_COLUMNS = 8;
export const PITCH_ROWS = 10;

/** Top-left cell of a slot: column 1..7 and row 1..9 (each slot spans 2 × 2). */
export interface PitchCell {
  readonly col: number;
  readonly row: number;
}

const c = (col: number, row: number): PitchCell => ({ col, row });

/** One entry per slot, in the order of `FORMATION_SLOTS[formation]`. */
export const PITCH_LAYOUT: { readonly [F in Formation]: readonly PitchCell[] } = {
  // GK; CB CB; FB FB; DM DM; AM AM; ST ST
  '4-4-2': [
    c(4, 9),
    c(3, 7),
    c(5, 7),
    c(1, 6),
    c(7, 6),
    c(3, 4),
    c(5, 4),
    c(1, 3),
    c(7, 3),
    c(3, 1),
    c(5, 1),
  ],
  // GK; CB CB; FB FB; DM; AM AM; ST ST ST
  '4-3-3': [
    c(4, 9),
    c(3, 7),
    c(5, 7),
    c(1, 6),
    c(7, 6),
    c(4, 5),
    c(2, 3),
    c(6, 3),
    c(1, 1),
    c(4, 1),
    c(7, 1),
  ],
  // GK; CB CB; FB FB; DM DM; AM AM AM; ST
  '4-2-3-1': [
    c(4, 9),
    c(3, 7),
    c(5, 7),
    c(1, 6),
    c(7, 6),
    c(3, 5),
    c(5, 5),
    c(1, 3),
    c(4, 3),
    c(7, 3),
    c(4, 1),
  ],
  // GK; CB CB CB; FB FB (wing-backs, midfield); DM DM; AM; ST ST
  '3-5-2': [
    c(4, 9),
    c(2, 7),
    c(4, 7),
    c(6, 7),
    c(1, 4),
    c(7, 4),
    c(3, 5),
    c(5, 5),
    c(4, 3),
    c(3, 1),
    c(5, 1),
  ],
  // GK; CB CB CB; FB FB (wing-backs, midfield); DM DM; ST ST ST
  '3-4-3': [
    c(4, 9),
    c(2, 7),
    c(4, 7),
    c(6, 7),
    c(1, 4),
    c(7, 4),
    c(3, 5),
    c(5, 5),
    c(1, 1),
    c(4, 1),
    c(7, 1),
  ],
  // GK; CB CB CB; FB FB (defence, half a step ahead of the CBs); DM DM; AM; ST ST
  '5-3-2': [
    c(4, 9),
    c(2, 7),
    c(4, 7),
    c(6, 7),
    c(1, 5),
    c(7, 5),
    c(3, 4),
    c(5, 4),
    c(4, 2),
    c(2, 1),
    c(6, 1),
  ],
};

/**
 * The lines of each formation as its name reads them ("4-2-3-1" is a line of 4, of 2, of 3 and
 * of 1), from the back to the front, each with its slot indices from left to right. Visual only:
 * the miniatures of the FormationPicker join the dots of each line with a stroke, so the
 * 4 + 4 + 2 shows at a glance and 4-2-3-1 never looks like 3-5-2. The goalkeeper (slot 0) is in
 * no line. Checked by `pitch-layout.test.ts`: the sizes match the name, every outfield slot is in
 * exactly one line, and each line runs left to right in `PITCH_LAYOUT`.
 */
export const PITCH_LINES: { readonly [F in Formation]: readonly (readonly number[])[] } = {
  '4-4-2': [
    [3, 1, 2, 4],
    [7, 5, 6, 8],
    [9, 10],
  ],
  '4-3-3': [
    [3, 1, 2, 4],
    [6, 5, 7],
    [8, 9, 10],
  ],
  '4-2-3-1': [[3, 1, 2, 4], [5, 6], [7, 8, 9], [10]],
  '3-5-2': [
    [1, 2, 3],
    [4, 6, 8, 7, 5],
    [9, 10],
  ],
  '3-4-3': [
    [1, 2, 3],
    [4, 6, 7, 5],
    [8, 9, 10],
  ],
  '5-3-2': [
    [4, 1, 2, 3, 5],
    [6, 8, 7],
    [9, 10],
  ],
};
