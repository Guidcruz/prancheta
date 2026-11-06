// Sample sheet of the player avatars (docs/art/avatares.md), drawn by the production code
// (app/src/lib/generators/avatar.ts and face.ts). Writes docs/art/avatares-exemplo.svg with the
// 16 faces approved by the CEO, at 96, 48 and 32 px on both themes, and with --check prints the
// contrast and size measures quoted in the doc. The draw rules (distribution, squad variety, age)
// are tested in app/src/lib/generators/face.test.ts; this tool never draws a face by lot.
// Usage: node scripts/avatar-sheet.mjs [--sheet] [--check] [--out <file>]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BACKDROP,
  INK,
  SHIRT,
  SKIN_COLORS,
  HAIR_COLORS,
  renderFace,
} from '../app/src/lib/generators/avatar.ts';
import { FACE_COUNTS, FACE_FIELDS, encodeFace } from '../app/src/lib/generators/face.ts';
import { contrastRatio } from '../app/src/lib/generators/shield.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

/** The faces of the approved sheet (prototype of 2026-11-06), by code. */
export const SHEET_CODES = [
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
];

/** surface-0 and surface-1 of each theme, from the design tokens. */
function themeBackgrounds() {
  const tokens = JSON.parse(readFileSync(resolve(root, 'design/tokens.json'), 'utf8'));
  const value = (name, theme) => tokens.color.tokens.find((t) => t.name === name).value[theme];
  return Object.fromEntries(
    ['dia', 'noite'].map((theme) => [
      theme,
      [value('surface-0', theme), value('surface-1', theme)],
    ]),
  );
}

/** Places an avatar SVG at (x, y) of the sheet. */
const at = (svg, x, y) => svg.replace('<svg ', `<svg x="${x}" y="${y}" `);

export function sheet() {
  const bgs = themeBackgrounds();
  const PW = 4 * 96 + 5 * 16;
  const PH = 16 + 4 * 112 + 16 + 48 + 16 + 32 + 16;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW * 2} ${PH}" width="${PW * 2}" height="${PH}">`;
  ['dia', 'noite'].forEach((theme, k) => {
    const ox = k * PW;
    out += `<rect x="${ox}" y="0" width="${PW}" height="${PH}" fill="${bgs[theme][0]}"/>`;
    out += `<rect x="${ox + 8}" y="8" width="${PW - 16}" height="${4 * 112 + 8}" rx="12" fill="${bgs[theme][1]}"/>`;
    SHEET_CODES.forEach((code, i) => {
      out += at(renderFace(code, 96), ox + 16 + (i % 4) * 112, 16 + Math.floor(i / 4) * 112);
    });
    const y48 = 16 + 4 * 112 + 16;
    for (let i = 0; i < 8; i++) out += at(renderFace(SHEET_CODES[i], 48), ox + 16 + i * 56, y48);
    const y32 = y48 + 48 + 16;
    for (let i = 0; i < 12; i++) {
      out += at(renderFace(SHEET_CODES[i + 4], 32), ox + 16 + i * 36, y32);
    }
  });
  return `${out}</svg>`;
}

function check() {
  const bgs = themeBackgrounds();
  for (const theme of ['noite', 'dia']) {
    for (const bg of bgs[theme]) {
      console.log('backdrop vs', theme, bg, contrastRatio(BACKDROP, bg).toFixed(2));
    }
  }
  console.log('ink vs backdrop', contrastRatio(INK, BACKDROP).toFixed(2));
  console.log(
    'skin vs backdrop',
    SKIN_COLORS.map((c) => contrastRatio(c, BACKDROP).toFixed(1)).join(' '),
  );
  console.log(
    'hair vs backdrop',
    HAIR_COLORS.map((c) => contrastRatio(c, BACKDROP).toFixed(1)).join(' '),
  );
  console.log('shirt vs backdrop', contrastRatio(SHIRT, BACKDROP).toFixed(2));
  // Every index of every field, each combined with 20 different settings of the other fields.
  const stats = { full: { max: 0, tot: 0, el: 0 }, small: { max: 0, tot: 0, el: 0 }, n: 0 };
  for (const field of FACE_FIELDS) {
    for (let i = 0; i < FACE_COUNTS[field]; i++) {
      for (let k = 0; k < 20; k++) {
        const spec = Object.fromEntries(
          FACE_FIELDS.map((g, j) => [g, g === field ? i : (k * 7 + j * 5 + i) % FACE_COUNTS[g]]),
        );
        const code = encodeFace(spec);
        stats.n++;
        for (const [key, size] of [
          ['full', 96],
          ['small', 32],
        ]) {
          const svg = renderFace(code, size);
          const s = stats[key];
          s.max = Math.max(s.max, svg.length);
          s.tot += svg.length;
          s.el = Math.max(s.el, (svg.match(/<(path|circle|rect)\b/g) ?? []).length);
        }
      }
    }
  }
  for (const key of ['full', 'small']) {
    const s = stats[key];
    console.log(key, 'bytes max', s.max, 'avg', Math.round(s.tot / stats.n), 'elements max', s.el);
  }
}

if (args.includes('--check')) check();
if (args.includes('--sheet') || !args.includes('--check')) {
  const i = args.indexOf('--out');
  const file =
    i >= 0 && args[i + 1] ? resolve(args[i + 1]) : resolve(root, 'docs/art/avatares-exemplo.svg');
  const out = sheet();
  writeFileSync(file, out);
  console.log('sheet', file, 'bytes', out.length);
}
