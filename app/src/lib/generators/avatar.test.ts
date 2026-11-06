import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AVATAR_SMALL_SIZE,
  BACKDROP,
  BUZZ_COLORS,
  HAIR_COLORS,
  INK,
  SHIRT,
  SKIN_COLORS,
  SKIN_LIPS,
  SKIN_SHADES,
  avatarPalette,
  mixColor,
  renderFace,
} from './avatar.ts';
import { FACE_COUNTS, FACE_FIELDS, NEUTRAL_FACE, decodeFace, encodeFace } from './face.ts';
import { gameIdentitySource } from './identity.ts';
import { contrastRatio } from './shield.ts';

/** The 16 faces of the approved sheet (docs/art/avatares-exemplo.svg) and four more. */
const FIXED_CODES = [
  '1916221221000',
  '1453023021000',
  '1945005321000',
  '1411303501410',
  '140f051420030',
  '1601910311000',
  '1705020222000',
  '1512055321300',
  '1502110110500',
  '111f241410000',
  '1312330330400',
  '1202121212340',
  '101c232331300',
  '160c013410000',
  '1022123512400',
  '1355015430001',
  '1b39853452512',
  '1a0e911551621',
  '105a704530752',
  '162c730141432',
];
const SIZES = [96, 48, 32] as const;

/** 1,000 players created by the game's identity source, ages 17 to 34 (US-005). */
const PLAYERS = Array.from({ length: 40 }, (_, q) =>
  gameIdentitySource().squad({
    seed: 5_000 + q,
    nationality: 'BR',
    count: 25,
    ages: Array.from({ length: 25 }, (_, k) => 17 + ((q + k * 7) % 18)),
    existing: [],
  }),
).flat();

const elements = (svg: string) => (svg.match(/<(path|circle|rect)\b/g) ?? []).length;

/** Every tag is `svg`, `path`, `circle` or `rect`, attributes are `name="value"`, tags balance. */
function wellFormed(svg: string): string[] {
  const problems: string[] = [];
  const open: string[] = [];
  const tag = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[a-zA-Z][\w:-]*="[^"<]*")*)\s*(\/?)>/y;
  let i = 0;
  while (i < svg.length) {
    if (svg[i] !== '<') {
      problems.push(`text outside a tag at ${i}`);
      break;
    }
    tag.lastIndex = i;
    const m = tag.exec(svg);
    if (m === null) {
      problems.push(`bad tag at ${i}: ${svg.slice(i, i + 40)}`);
      break;
    }
    const [, closing, name, attrs, selfClosing] = m as unknown as [
      string,
      string,
      string,
      string,
      string,
    ];
    if (!['svg', 'path', 'circle', 'rect'].includes(name)) problems.push(`tag ${name}`);
    for (const value of attrs.matchAll(/="([^"]*)"/g)) {
      if (/&(?!amp;|lt;|gt;|quot;|#39;)/.test(value[1]!)) problems.push(`raw & in ${value[1]}`);
    }
    if (closing) {
      if (open.pop() !== name) problems.push(`unbalanced </${name}>`);
    } else if (!selfClosing) open.push(name);
    i = tag.lastIndex;
  }
  if (open.length > 0) problems.push(`unclosed ${open.join(',')}`);
  return problems;
}

const FORBIDDEN = [
  /<script/i,
  /<style/i,
  /<text/i,
  /<image/i,
  /<foreignObject/i,
  /<use/i,
  /<defs/i,
  /<linearGradient/i,
  /<radialGradient/i,
  /<filter/i,
  /<clipPath/i,
  /href/i,
  /\son\w+=/i,
  /style=/i,
  /url\(/i,
  /\sid=/i,
  /class=/i,
  /data:/i,
  /javascript:/i,
];

describe('renderFace: stability (US-005, docs/art/avatares.md, 6.1)', () => {
  it('draws the same SVG for the same face, now and in other processes', async () => {
    const lines = FIXED_CODES.flatMap((code) =>
      SIZES.map((size) => {
        const svg = renderFace(code, size);
        expect(renderFace(code, size)).toBe(svg);
        expect(renderFace(decodeFace(code), size)).toBe(svg);
        return `${code} ${size} ${svg}`;
      }),
    );
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot(
      './__fixtures__/avatar.stability.snap',
    );
  });
});

/*
 * One face per index of each field, over a base face with short hair, so a change in the drawing
 * of a trait shows in the diff and goes to the art-director (docs/art/avatares.md, 6.3).
 */
describe('renderFace: golden per trait', () => {
  it('keeps the drawing of every trait', async () => {
    const base = decodeFace('1402100000000');
    const lines: string[] = [];
    for (const field of FACE_FIELDS) {
      for (let i = 0; i < FACE_COUNTS[field]; i++) {
        const code = encodeFace({ ...base, [field]: i });
        for (const size of [96, 32]) lines.push(`${field} ${i} ${size} ${renderFace(code, size)}`);
      }
    }
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot('./__fixtures__/avatar.traits.snap');
  });
});

describe('renderFace: size and safety over 1,000 players (US-005, 6.7)', () => {
  const palette = avatarPalette();

  it('has 1,000 players with distinct faces', () => {
    expect(PLAYERS).toHaveLength(1000);
    expect(new Set(PLAYERS.map((p) => p.face)).size).toBeGreaterThan(990);
  });

  it.each(SIZES)('stays light, closed and safe at %i px', (size) => {
    const small = size <= AVATAR_SMALL_SIZE;
    for (const { face, display } of PLAYERS) {
      for (const svg of [
        renderFace(face, size),
        renderFace(face, size, { shirt: '#AA1122', label: display }),
      ]) {
        expect(svg.length, face).toBeLessThanOrEqual(small ? 2400 : 3200);
        expect(elements(svg), face).toBeLessThanOrEqual(small ? 16 : 20);
        for (const re of FORBIDDEN) expect(svg, `${face} ${re}`).not.toMatch(re);
        expect(wellFormed(svg), face).toEqual([]);
        // Coordinates are rounded to 2 decimals.
        expect(svg, face).not.toMatch(/\d\.\d{3}/);
        for (const [, color] of svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]+)"/gi)) {
          expect(palette.has(color!) || color === '#aa1122', `${face} ${color}`).toBe(true);
        }
        // Fills and strokes are a palette colour or none: nothing else becomes a colour.
        for (const [, value] of svg.matchAll(/(?:fill|stroke)="([^"]*)"/g)) {
          expect(value, face).toMatch(/^(#[0-9a-f]{3,6}|none)$/);
        }
      }
    }
  });

  it('has only one opacity, the fixed one of the stubble', () => {
    for (const { face } of PLAYERS) {
      const svg = renderFace(face, 96);
      expect(svg.match(/opacity="[^"]*"/g) ?? []).toEqual(
        decodeFace(face).facial === 1 ? ['opacity=".38"'] : [],
      );
    }
  });
});

describe('renderFace: options', () => {
  const code = FIXED_CODES[0]!;

  it('is decorative without a label', () => {
    const svg = renderFace(code, 48);
    expect(svg).toContain('aria-hidden="true" focusable="false"');
    expect(svg).not.toContain('role=');
    expect(svg).not.toContain('aria-label');
  });

  it('escapes the label and turns it into the accessible name', () => {
    const svg = renderFace(code, 48, { label: `Zé "Foguete" <b>&'` });
    expect(svg).toContain('role="img" aria-label="Zé &quot;Foguete&quot; &lt;b&gt;&amp;&#39;"');
    expect(svg).not.toContain('aria-hidden');
    expect(wellFormed(svg)).toEqual([]);
  });

  it('takes a club colour for the shirt only when it is #rrggbb', () => {
    const shirtOf = (shirt?: string) =>
      /<path d="M4.5 38[^"]*" fill="([^"]+)"/.exec(renderFace(code, 96, { shirt }))?.[1];
    expect(shirtOf()).toBe(SHIRT);
    expect(shirtOf('#C0FFEE')).toBe('#c0ffee');
    for (const bad of ['red', '#fff', '#12345g', 'url(#x)', '" onload="x', '']) {
      expect(shirtOf(bad), bad).toBe(SHIRT);
    }
  });

  it('accepts sizes from 16 to 512 and falls back to 48 otherwise', () => {
    const width = (size: number) => /width="([^"]+)"/.exec(renderFace(code, size))?.[1];
    expect(width(16)).toBe('16');
    expect(width(512)).toBe('512');
    for (const bad of [0, 15, 513, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(width(bad), String(bad)).toBe('48');
    }
  });

  it('draws the simple version up to 32 px: no ears, nose, marks nor small accessories', () => {
    const face = decodeFace('1945005321112');
    const small = renderFace(face, 32);
    expect(small).toBe(renderFace({ ...face, ears: 0, nose: 3, marks: 0, accessory: 0 }, 32));
    for (const accessory of [1, 2, 5]) {
      expect(renderFace({ ...face, accessory }, 32)).toBe(
        renderFace({ ...face, accessory: 0 }, 32),
      );
    }
    for (const accessory of [3, 4]) {
      expect(renderFace({ ...face, accessory }, 32)).not.toBe(
        renderFace({ ...face, accessory: 0 }, 32),
      );
    }
    expect(elements(small)).toBeLessThan(elements(renderFace(face, 33)));
    // The outline is never dropped, not even in the simple version.
    expect(small).toContain(`stroke="${INK}" stroke-width="1.7"`);
  });

  it('draws an invalid spec as the neutral value of each bad field', () => {
    const bad = { ...NEUTRAL_FACE, skin: 99, hairStyle: -1, eyes: 2.5 };
    expect(renderFace(bad, 96)).toBe(renderFace(NEUTRAL_FACE, 96));
    expect(renderFace('<svg onload=x>', 96)).toBe(renderFace(NEUTRAL_FACE, 96));
  });
});

describe('avatar colours', () => {
  it('derives shade, lip and shaved hair from fixed formulas', () => {
    expect(mixColor('#ffffff', [0, 0, 0], 0.2)).toBe('#cccccc');
    SKIN_COLORS.forEach((skin, i) => {
      expect(SKIN_SHADES[i]).toBe(mixColor(skin, [0, 0, 0], 0.2));
      // Lip: 40% towards #963240 (docs/art/avatares.md, 2).
      expect(SKIN_LIPS[i]).toBe(mixColor(skin, [0x96, 0x32, 0x40], 0.4));
      HAIR_COLORS.forEach((hair, j) => {
        const [r, g, b] = [1, 3, 5].map((k) => parseInt(hair.slice(k, k + 2), 16));
        expect(BUZZ_COLORS[i]![j]).toBe(mixColor(skin, [r!, g!, b!], 0.5));
      });
    });
    expect(SKIN_COLORS).toHaveLength(FACE_COUNTS.skin);
    expect(HAIR_COLORS).toHaveLength(FACE_COUNTS.hairColor);
  });

  it('keeps the medallion and its outline readable on both themes (tokens.json)', () => {
    const tokens = JSON.parse(
      readFileSync(new URL('../../../../design/tokens.json', import.meta.url), 'utf8'),
    ) as {
      color: {
        themes: { id: string }[];
        tokens: { name: string; value: Record<string, string> }[];
      };
    };
    const themes = tokens.color.themes.map((t) => t.id);
    expect(themes.length).toBeGreaterThanOrEqual(2);
    for (const name of ['surface-0', 'surface-1']) {
      const token = tokens.color.tokens.find((t) => t.name === name);
      expect(token, name).toBeDefined();
      for (const theme of themes) {
        const bg = token!.value[theme]!;
        expect(contrastRatio(BACKDROP, bg), `${name} ${theme}`).toBeGreaterThanOrEqual(3);
      }
    }
    expect(contrastRatio(INK, BACKDROP)).toBeGreaterThanOrEqual(3);
  });
});
