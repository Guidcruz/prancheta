import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { CLUB_SETS } from './club-sets.ts';

/*
 * The short name of every club fits whole in the name column of the Tabela at 360px
 * (docs/design/telas/tabela.md, "360px" and the Vitest asks of T-031): 95px in `body-strong`
 * (Barlow 600, 15px), the coach's row. A wider name would end in an ellipsis, so a new list of
 * clubs fails here, in `npm run content:check`, instead of cutting a name quietly; the fix is a
 * shorter name or a new decision on the column (ux-designer).
 *
 * The width is the sum of the advance widths of the font the game ships (@fontsource, WOFF),
 * without kerning, which errs by less than 1px (the method of the text batches).
 */

/** The width of the name column at 360px (tabela.md: 171px of content minus the rest). */
const NAME_COLUMN_PX = 95;
/** `body-strong` (design/tokens.json): Barlow 600, 15px. */
const FONT_PX = 15;
/**
 * The subsets the game loads, in the order the browser tries them (`unicode-range` of
 * @fontsource): a letter not in `latin` (ő, ł, ș...) comes from `latin-ext`.
 */
const FONT_FILES = [
  '@fontsource/barlow/files/barlow-latin-600-normal.woff',
  '@fontsource/barlow/files/barlow-latin-ext-600-normal.woff',
];

/** The tables of a WOFF 1 file, uncompressed. */
function woffTables(file: Uint8Array): Map<string, DataView> {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (view.getUint32(0) !== 0x774f4646) throw new Error('not a WOFF 1 file');
  const tables = new Map<string, DataView>();
  const count = view.getUint16(12);
  for (let i = 0; i < count; i++) {
    const at = 44 + i * 20;
    const tag = String.fromCharCode(...file.subarray(at, at + 4));
    const offset = view.getUint32(at + 4);
    const compLength = view.getUint32(at + 8);
    const origLength = view.getUint32(at + 12);
    const raw = file.subarray(offset, offset + compLength);
    const data = compLength < origLength ? new Uint8Array(inflateSync(raw)) : raw;
    tables.set(tag, new DataView(data.buffer, data.byteOffset, data.byteLength));
  }
  return tables;
}

/** The glyph of a character, from the Windows Unicode BMP subtable (format 4) of `cmap`. */
function glyphLookup(cmap: DataView): (code: number) => number {
  const count = cmap.getUint16(2);
  let sub: number | undefined;
  for (let i = 0; i < count; i++) {
    const platform = cmap.getUint16(4 + i * 8);
    const encoding = cmap.getUint16(6 + i * 8);
    if (platform === 3 && encoding === 1) sub = cmap.getUint32(8 + i * 8);
  }
  if (sub === undefined || cmap.getUint16(sub) !== 4) throw new Error('no cmap format 4');
  const segments = cmap.getUint16(sub + 6) / 2;
  const ends = sub + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;
  return (code) => {
    for (let s = 0; s < segments; s++) {
      if (cmap.getUint16(ends + s * 2) < code) continue;
      const start = cmap.getUint16(starts + s * 2);
      if (start > code) return 0;
      const delta = cmap.getUint16(deltas + s * 2);
      const range = cmap.getUint16(ranges + s * 2);
      if (range === 0) return (code + delta) & 0xffff;
      const glyph = cmap.getUint16(ranges + s * 2 + range + (code - start) * 2);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

/** The advance of each character in one font file, in em (`undefined`: not in the file). */
function advances(path: string): (code: number) => number | undefined {
  const tables = woffTables(new Uint8Array(readFileSync(path)));
  const unitsPerEm = tables.get('head')!.getUint16(18);
  const metrics = tables.get('hhea')!.getUint16(34);
  const hmtx = tables.get('hmtx')!;
  const glyphOf = glyphLookup(tables.get('cmap')!);
  return (code) => {
    const glyph = glyphOf(code);
    if (glyph === 0) return undefined;
    return hmtx.getUint16(Math.min(glyph, metrics - 1) * 4) / unitsPerEm;
  };
}

/**
 * Measures a text at `px` by the advance widths (no kerning), each character from the first
 * font file that has it, as the browser picks among the subsets.
 */
function measurer(paths: readonly string[], px: number): (text: string) => number {
  const fonts = paths.map(advances);
  return (text) => {
    let em = 0;
    for (const char of text.normalize('NFC')) {
      const code = char.codePointAt(0)!;
      const width = fonts.map((font) => font(code)).find((w) => w !== undefined);
      if (width === undefined) throw new Error(`"${char}" is in no subset of ${paths.join(', ')}`);
      em += width;
    }
    return em * px;
  };
}

const resolver = createRequire(import.meta.url);
const measure = measurer(
  FONT_FILES.map((file) => resolver.resolve(file)),
  FONT_PX,
);

describe('short names of the clubs in the Tabela (T-031)', () => {
  it('measures like the text batches ("Inter-Regional" is about 94.8px)', () => {
    expect(measure('Inter-Regional')).toBeGreaterThan(93);
    expect(measure('Inter-Regional')).toBeLessThan(96);
  });

  it('measures a letter outside latin from latin-ext, as the browser does', () => {
    // "ő" and "ł" are only in latin-ext: measured, never refused.
    expect(measure('Győr')).toBeGreaterThan(measure('Gyr'));
    expect(measure('Łódź')).toBeGreaterThan(0);
  });

  for (const set of CLUB_SETS) {
    it(`${set.baseSeason}: every short name fits whole in ${NAME_COLUMN_PX}px of body-strong`, () => {
      const wide = set.clubs
        .map((club) => ({ name: club.shortName, px: measure(club.shortName) }))
        .filter((club) => club.px > NAME_COLUMN_PX)
        .map((club) => `${club.name} (${club.px.toFixed(1)}px)`);
      expect(wide, 'short names that would end in an ellipsis in the Tabela').toEqual([]);
    });
  }
});
