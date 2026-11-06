import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FACE_MAX_LENGTH, Rng } from '../../engine/index.ts';
import {
  FACE_COUNTS,
  FACE_FIELDS,
  FACE_WEIGHTS,
  HAIR_COLOR,
  HAIR_STYLE,
  NEUTRAL_FACE,
  RETIRED_TRAITS,
  SKIN_WEIGHTS,
  decodeFace,
  encodeFace,
  faceSpecFromSeed,
  greyChance,
  retiredTraitProblems,
  whiteChance,
  type FaceField,
  type FaceSpec,
  type RetiredTraits,
} from './face.ts';

const spec = (values: Partial<Record<FaceField, number>> = {}): FaceSpec => ({
  ...NEUTRAL_FACE,
  ...values,
});
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe('face codec (docs/art/avatares.md, 3)', () => {
  it('is the inverse of the encoder for every index of every field', () => {
    for (const field of FACE_FIELDS) {
      for (let i = 0; i < FACE_COUNTS[field]; i++) {
        const s = spec({ [field]: i, skin: (i * 5) % FACE_COUNTS.skin });
        const code = encodeFace(s);
        expect(code).toMatch(/^1[0-9a-z]{12}$/);
        expect(code.length).toBeLessThanOrEqual(FACE_MAX_LENGTH);
        expect(decodeFace(code)).toEqual(s);
      }
    }
  });

  it('keeps the example of the doc', () => {
    const s = decodeFace('1945005321000');
    expect(s).toEqual({
      skin: 9,
      shape: 4,
      hairStyle: 5,
      hairColor: 0,
      brows: 0,
      eyes: 5,
      nose: 3,
      mouth: 2,
      ears: 1,
      facial: 0,
      accessory: 0,
      marks: 0,
    });
    expect(encodeFace(s)).toBe('1945005321000');
  });

  it('never throws on hostile input and always gives a valid face', () => {
    const hostile: unknown[] = [
      '',
      '1',
      '2945005321000',
      '1a4f005321000'.toUpperCase(),
      '1zzzzzzzzzzzz',
      `1${'0'.repeat(32)}`,
      '<script>',
      '1945 05321000',
      null,
      undefined,
      42,
      {},
      ['1945005321000'],
    ];
    for (const code of hostile) {
      const s = decodeFace(code);
      for (const field of FACE_FIELDS) {
        expect(Number.isInteger(s[field])).toBe(true);
        expect(s[field]).toBeGreaterThanOrEqual(0);
        expect(s[field]).toBeLessThan(FACE_COUNTS[field]);
      }
    }
    expect(decodeFace('2945005321000')).toEqual(NEUTRAL_FACE);
    expect(decodeFace('1a4f005321000'.toUpperCase())).toEqual(NEUTRAL_FACE);
    // An index above the catalogue is 0 in that field only.
    expect(decodeFace('1z45005321000')).toEqual({ ...decodeFace('1945005321000'), skin: 0 });
  });

  it('reads a short code (fields that did not exist yet) as 0 in what is missing', () => {
    expect(decodeFace('19450')).toEqual(spec({ skin: 9, shape: 4, hairStyle: 5, hairColor: 0 }));
    // Characters after the known fields (a newer version of the catalogue) are ignored.
    expect(decodeFace('1945005321000zz')).toEqual(decodeFace('1945005321000'));
  });

  it('encodes an index outside the catalogue as 0', () => {
    expect(encodeFace(spec({ skin: 12, shape: -1, eyes: 1.5, nose: Number.NaN }))).toBe(
      encodeFace(NEUTRAL_FACE),
    );
  });
});

describe('the catalogue only grows (docs/art/avatares.md, 6.3)', () => {
  const fixture = readFileSync(
    new URL('./__fixtures__/avatar.catalog.snap', import.meta.url),
    'utf8',
  )
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => line.trim().split(/\s+/) as [string, string]);

  it('keeps every field of the fixture, in the same order, with at least its count', () => {
    expect(fixture.map(([field]) => field)).toEqual(FACE_FIELDS.slice(0, fixture.length));
    for (const [field, count] of fixture) {
      expect(FACE_COUNTS[field as FaceField], field).toBeGreaterThanOrEqual(Number(count));
    }
  });

  it('has room in the code: one base-36 character per field, 32 characters in all', () => {
    expect(1 + FACE_FIELDS.length).toBeLessThanOrEqual(FACE_MAX_LENGTH);
    for (const field of FACE_FIELDS) expect(FACE_COUNTS[field]).toBeLessThanOrEqual(36);
  });
});

describe('retired traits (docs/art/avatares.md, 3)', () => {
  it('has a sound table (empty in T-027)', () => {
    expect(retiredTraitProblems(RETIRED_TRAITS)).toEqual([]);
  });

  it('swaps a retired index on decoding, before the catalogue check', () => {
    const table: RetiredTraits = { accessory: { 5: 0 }, hairStyle: { 10: 1 } };
    expect(retiredTraitProblems(table)).toEqual([]);
    const code = encodeFace(spec({ accessory: 5, hairStyle: 10, skin: 4 }));
    // The retired index is never drawn: it decodes exactly as its replacement.
    expect(decodeFace(code, table)).toEqual(spec({ accessory: 0, hairStyle: 1, skin: 4 }));
    expect(decodeFace(code)).toEqual(spec({ accessory: 5, hairStyle: 10, skin: 4 }));
  });

  it('refuses chains, loops, self maps and indices outside the catalogue', () => {
    expect(retiredTraitProblems({ hairStyle: { 3: 4, 4: 2 } })).toEqual([
      'hairStyle: 3 maps to the retired 4',
    ]);
    expect(retiredTraitProblems({ eyes: { 1: 2, 2: 1 } })).toHaveLength(2);
    expect(retiredTraitProblems({ eyes: { 1: 1 } })).toEqual(['eyes: 1 maps to itself']);
    expect(retiredTraitProblems({ ears: { 7: 0 } })).toEqual([
      'ears: retired 7 is outside the catalogue',
    ]);
    expect(retiredTraitProblems({ ears: { 1: 3 } })).toEqual([
      'ears: 1 maps outside the catalogue (3)',
    ]);
  });
});

describe('faceSpecFromSeed', () => {
  it('is pure', () => {
    for (const seed of [0, 1, 77, 0xffffffff]) {
      const ctx = { age: 26, nationality: 'BR' };
      expect(faceSpecFromSeed(seed, ctx)).toEqual(faceSpecFromSeed(seed, ctx));
    }
  });

  it('keeps the faces drawn by this version (a change here re-faces every new player)', () => {
    const codes = Array.from({ length: 12 }, (_, i) =>
      encodeFace(faceSpecFromSeed(i * 1_000_003, { age: 17 + i * 1.5, nationality: 'BR' })),
    );
    expect(codes).toMatchInlineSnapshot(`
      [
        "1155345041020",
        "1b17120200450",
        "1452155220000",
        "1733204201100",
        "1123230421000",
        "172d225110300",
        "1054044151000",
        "1b02010451020",
        "1202101312150",
        "1959115010550",
        "1535735150001",
        "1611000411021",
      ]
    `);
  });

  it('uses the Brazilian table for an unknown nationality', () => {
    for (let seed = 0; seed < 200; seed++) {
      const br = faceSpecFromSeed(seed, { age: 25, nationality: 'BR' });
      for (const nationality of ['XX', '', '__proto__', 'constructor', 'toString']) {
        expect(faceSpecFromSeed(seed, { age: 25, nationality })).toEqual(br);
      }
    }
  });

  it('puts an age outside the bands in the nearest one and treats a missing age as young', () => {
    for (let seed = 0; seed < 200; seed++) {
      const at = (age: number) => faceSpecFromSeed(seed, { age, nationality: 'BR' });
      expect(at(5)).toEqual(at(17));
      expect(at(Number.NaN)).toEqual(at(17));
      expect(at(Number.POSITIVE_INFINITY)).toEqual(at(17));
      // Above 36 every age rule is at its ceiling.
      expect(at(60)).toEqual(at(36));
    }
  });

  it('has weight rows that add up to 100', () => {
    const rows = [
      FACE_WEIGHTS.shape,
      FACE_WEIGHTS.eyes,
      FACE_WEIGHTS.brows,
      FACE_WEIGHTS.nose,
      FACE_WEIGHTS.mouth,
      FACE_WEIGHTS.ears,
      FACE_WEIGHTS.accessory,
      FACE_WEIGHTS.hairColor,
      ...FACE_WEIGHTS.hairStyle,
      ...FACE_WEIGHTS.facial,
      ...Object.values(SKIN_WEIGHTS),
    ];
    for (const row of rows) expect(sum(row)).toBe(100);
    expect(FACE_WEIGHTS.shape).toHaveLength(FACE_COUNTS.shape);
    expect(FACE_WEIGHTS.accessory).toHaveLength(FACE_COUNTS.accessory);
    for (const row of FACE_WEIGHTS.hairStyle) expect(row).toHaveLength(FACE_COUNTS.hairStyle);
    for (const row of FACE_WEIGHTS.facial) expect(row).toHaveLength(FACE_COUNTS.facial);
    for (const row of Object.values(SKIN_WEIGHTS)) {
      expect(row).toHaveLength(FACE_COUNTS.skin);
      // At least 5% in each band (light 0-3, medium 4-7, dark 8-11) in every country.
      for (const band of [0, 4, 8])
        expect(sum(row.slice(band, band + 4))).toBeGreaterThanOrEqual(5);
    }
  });
});

/*
 * Distribution over 20,000 faces, ages 17 to 34, Brazil (docs/art/avatares.md, 6.5). The expected
 * count of each value is computed exactly from the weights and the rules (age bands, curl by
 * skin, no natural light hair on dark skin, grey and white by age), and every count must be
 * within 30% of it.
 */
describe('distribution of 20,000 faces', () => {
  const N = 20_000;
  const AGES = Array.from({ length: 18 }, (_, i) => 17 + i);
  const rng = new Rng(20_027);
  const faces = Array.from({ length: N }, (_, i) => {
    const age = AGES[i % AGES.length]!;
    return { age, face: faceSpecFromSeed(rng.int(0, 0xffffffff), { age, nationality: 'BR' }) };
  });
  const norm = (w: readonly number[]) => w.map((x) => x / sum(w));
  const band = (age: number) => (age <= 23 ? 0 : age <= 29 ? 1 : 2);
  const skinP = norm(SKIN_WEIGHTS.BR!);

  function expected(field: FaceField): number[] {
    const out: number[] = Array.from({ length: FACE_COUNTS[field] }, () => 0);
    for (const age of AGES) {
      const pAge = 1 / AGES.length;
      for (let skin = 0; skin < FACE_COUNTS.skin; skin++) {
        const p = pAge * skinP[skin]!;
        let dist: number[];
        if (field === 'skin') dist = out.map((_, i) => (i === skin ? 1 : 0));
        else if (field === 'hairStyle') {
          const curl = skin >= 8 ? 1.5 : skin <= 3 ? 0.75 : 1;
          dist = norm(
            FACE_WEIGHTS.hairStyle[band(age)].map((w: number, i) =>
              [5, 6, 9, 15].includes(i) ? w * curl : w,
            ),
          );
        } else if (field === 'hairColor') {
          const base: number[] = [...FACE_WEIGHTS.hairColor];
          if (skin >= 7) {
            for (const i of [4, 5, 6]) {
              base[0] = base[0]! + base[i]!;
              base[i] = 0;
            }
          }
          const [pw, pg] = [whiteChance(age), greyChance(age)];
          dist = norm(base).map((x) => x * (1 - pw - pg));
          dist[HAIR_COLOR.grey]! += pg;
          dist[HAIR_COLOR.white]! += pw;
        } else if (field === 'facial') dist = norm(FACE_WEIGHTS.facial[band(age)]);
        else if (field === 'marks') {
          dist = norm(age < 28 ? [100, 0, 0] : age < 32 ? [75, 25, 0] : [45, 40, 15]);
        } else dist = norm(FACE_WEIGHTS[field as 'shape']);
        dist.forEach((x, i) => (out[i]! += p * x * N));
      }
    }
    return out;
  }

  it.each(FACE_FIELDS)('draws %s within 30% of the expected count', (field) => {
    const counts: number[] = Array.from({ length: FACE_COUNTS[field] }, () => 0);
    for (const { face } of faces) counts[face[field]]!++;
    expected(field).forEach((e, i) => {
      if (e === 0) expect(counts[i], `${field} ${i}`).toBe(0);
      else
        expect(Math.abs(counts[i]! - e), `${field} ${i}: ${counts[i]} vs ${e}`).toBeLessThan(
          0.3 * e,
        );
    });
  });

  it('follows the age and colour rules', () => {
    const young: number[] = [HAIR_STYLE.bald, HAIR_STYLE.receding, HAIR_STYLE.crown];
    for (const { age, face } of faces) {
      if (age <= 23) expect(young).not.toContain(face.hairStyle);
      if (age < 30) expect(face.hairColor).not.toBe(HAIR_COLOR.grey);
      if (age < 33) expect(face.hairColor).not.toBe(HAIR_COLOR.white);
      if (age < 28) expect(face.marks).toBe(0);
      if (face.skin >= 7) expect([4, 5, 6]).not.toContain(face.hairColor);
    }
    expect(new Set(faces.map(({ face }) => face.skin)).size).toBe(FACE_COUNTS.skin);
  });
});

/*
 * Variety in a squad of 30 (docs/art/avatares.md, 6.6): 300 squads, ages 17 to 34. The minimum
 * the prototype saw is in parentheses; the limits are lower so the test is not fragile.
 */
describe('variety in a squad of 30', () => {
  it('has many skins, styles and combinations and never repeats a face', () => {
    const rng = new Rng(30);
    const mins = { skins: 99, styles: 99, triples: 99 };
    let repeats = 0;
    for (let q = 0; q < 300; q++) {
      const squad = Array.from({ length: 30 }, (_, j) =>
        faceSpecFromSeed(rng.int(0, 0xffffffff), {
          age: 17 + ((q + j * 5) % 18),
          nationality: 'BR',
        }),
      );
      mins.skins = Math.min(mins.skins, new Set(squad.map((s) => s.skin)).size);
      mins.styles = Math.min(mins.styles, new Set(squad.map((s) => s.hairStyle)).size);
      mins.triples = Math.min(
        mins.triples,
        new Set(squad.map((s) => `${s.skin}-${s.hairStyle}-${s.hairColor}`)).size,
      );
      repeats += 30 - new Set(squad.map(encodeFace)).size;
    }
    expect(mins.skins).toBeGreaterThanOrEqual(6); // prototype: 7
    expect(mins.styles).toBeGreaterThanOrEqual(7); // prototype: 8
    expect(mins.triples).toBeGreaterThanOrEqual(24); // prototype: 26
    expect(repeats).toBe(0); // prototype: 0
  });
});

/*
 * ADR-0012 (note of 2026-11-06), conformance: a face is drawn by lot only when a player is
 * created, in identity.ts. Any other caller of faceSpecFromSeed (a screen, the save, a script)
 * would re-face an existing player, so it fails here before it reaches review.
 */
describe('faceSpecFromSeed is called only by identity.ts', () => {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  const allowed = new Set(['app/src/lib/generators/face.ts', 'app/src/lib/generators/identity.ts']);
  const skip = new Set(['node_modules', 'dist', 'dist-e2e', '.astro', '.git']);

  function* files(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) yield* files(path);
      else if (/\.(ts|mjs|js|svelte|astro)$/.test(name) && !/\.test\.ts$/.test(name)) yield path;
    }
  }

  it('has no other production caller', () => {
    const offenders: string[] = [];
    for (const top of ['app/src', 'scripts', 'site/src', 'server']) {
      let dir: string;
      try {
        dir = join(root, top);
        statSync(dir);
      } catch {
        continue;
      }
      for (const file of files(dir)) {
        const rel = relative(root, file).split('\\').join('/');
        if (allowed.has(rel)) continue;
        if (readFileSync(file, 'utf8').includes('faceSpecFromSeed')) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
