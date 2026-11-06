// Prototype of the avatar style (docs/art/avatares.md). Generates docs/art/avatares-exemplo.svg
// and prints the checks quoted in the doc (bytes, elements, contrast, squad variety).
// It is NOT production code: the developer rewrites this in app/src/lib/generators/avatar.ts
// (typed, tested). Usage: node scripts/avatar-sheet.mjs [--check] [--png <path>]
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INK = '#0b1118';

// ------------------------------------------------------------------ closed palettes
const SKIN = [
  '#f6d9c4',
  '#efc7a8',
  '#e5b48f',
  '#d9a077',
  '#c98c62',
  '#b87a50',
  '#a46a43',
  '#8d5636',
  '#744429',
  '#5e351f',
  '#4a2a19',
  '#3a2014',
];
const HAIR = [
  '#15110f',
  '#2a1a12',
  '#4b2f1e',
  '#6e4a2b',
  '#9c7440',
  '#cfa75a',
  '#8f3d20',
  '#8f979d',
  '#dde1e4',
  '#e8d79a',
];
const mix = (hex, to, t) => {
  const f = (i) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t) + to[i >> 1] * t)
      .toString(16)
      .padStart(2, '0');
  return `#${f(1)}${f(3)}${f(5)}`;
};
const BLACK = [0, 0, 0];
const SKIN_SHADE = SKIN.map((c) => mix(c, BLACK, 0.2));
const SKIN_LIP = SKIN.map((c) => mix(c, [150, 50, 60], 0.4));
// Eyebrows are natural-looking and never take a blond/bleached hue (that turns olive on skin).
const BROW = [
  '#15110f',
  '#2a1a12',
  '#4b2f1e',
  '#5e3f26',
  '#5a3d22',
  '#62432a',
  '#6e2f18',
  '#6f777d',
  '#9aa1a6',
  '#5a3d22',
];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** Shaved hair: a tone between scalp and hair colour (opaque, so no "cap" edge). */
const buzzColor = (skin, hair) => mix(skin, rgb(hair), 0.5);
const SHIRT = '#e6ebf0';
const BACKDROP = '#5f7f98';
const LIGHT_LIP = '#e3a6a0';

// ------------------------------------------------------------------ catalog (field order = codec order)
export const FIELDS = [
  'skin',
  'shape',
  'hairStyle',
  'hairColor',
  'brows',
  'eyes',
  'nose',
  'mouth',
  'ears',
  'facial',
  'accessory',
  'marks',
];
export const COUNTS = {
  skin: 12,
  shape: 6,
  hairStyle: 16,
  hairColor: 10,
  brows: 6,
  eyes: 6,
  nose: 6,
  mouth: 6,
  ears: 3,
  facial: 8,
  accessory: 6,
  marks: 3,
};

export const encodeFace = (s) => '1' + FIELDS.map((f) => (s[f] ?? 0).toString(36)).join('');
export function decodeFace(code) {
  const ok = typeof code === 'string' && /^[0-9a-z]{2,32}$/.test(code) && code[0] === '1';
  const s = {};
  FIELDS.forEach((f, i) => {
    const v = ok ? parseInt(code[i + 1] ?? '0', 36) : 0;
    s[f] = Number.isInteger(v) && v < COUNTS[f] ? v : 0; // never throws; unknown index -> 0
  });
  return s;
}

// ------------------------------------------------------------------ drawing
const FACE = [
  'M24 8.5C31 8.5 34 14 34 21c0 8-4.5 14-10 14S14 29 14 21c0-7 3-12.5 10-12.5Z',
  'M24 9C31.5 9 35 14.5 35 22c0 7.5-5 13-11 13S13 29.5 13 22C13 14.5 16.5 9 24 9Z',
  'M24 9c6 0 10 1.5 10 6v9c0 6-2.5 11-10 11s-10-5-10-11v-9c0-4.5 4-6 10-6Z',
  'M24 7.5C30.5 7.5 33.5 13 33.5 20c0 9-4 15.5-9.5 15.5S14.5 29 14.5 20c0-7 3-12.5 9.5-12.5Z',
  'M24 9C31 9 35 13.5 35 19.5c0 6-4 10.5-8 14-1.500 1.300-2.200 2-3 2s-1.500-.7-3-2c-4-3.500-8-8-8-14C13 13.500 17 9 24 9Z',
  'M24 9.500c6.500 0 10.500 2.500 10.800 8 .4 6-.5 10-3 13.500-1.800 2.500-4.500 4-7.800 4s-6-1.500-7.800-4c-2.500-3.500-3.400-7.500-3-13.500.3-5.500 4.300-8 10.800-8Z',
];
const EAR_R = [1.8, 2.4, 3];

const circ = (cx, cy, r) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const ell = (cx, cy, rx, ry) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const n = (v) => String(+v.toFixed(2));

// Hair is three layers, so it can never leave a gap against the skull:
//  sil     silhouette drawn BEHIND ears and face (fill + ink stroke): it always contains the skull top,
//          so the head sits on the hair and no backdrop shows between them;
//  hl      hairline, an open path from A (left temple) to B (right temple);
//  fringe  fill-only cap in front of the face: hl + CLOSE, closed through the inside of `sil`, so it
//          hides the skull outline under the hair without drawing a second contour. The hairline gets
//          its own ink stroke.
// Invariants (tested in the sheet check): sil spans x 12..36 at y 21, top <= 6.2; fringe closure stays
// >= 0.8 inside sil; hl starts/ends on the skull side at y 21.5.
const CLOSE = 'C35.400 12 31 7.400 24 7.400S12.600 12 12.800 21.500Z';
const CLOSE_BUZZ = 'C34 12 31 9.200 24 9.200S14 12 14.200 21.500Z';
const CAP = 'M12.200 23C11.200 12 16.500 6.200 24 6.200S36.800 12 35.800 23Z';
const BUMPY =
  'M12 23Q9.500 17 13 13.500 12 9 17.500 8.500 19.500 4.500 24 6 28.500 4.500 30.500 8.500 36 9 35 13.500 38.500 17 36 23Z';
const HL_CAP =
  'M12.800 21.500Q13 15.500 18.500 14.500Q24 12.800 29.500 14.500Q35 15.500 35.200 21.500';
const HL_SIDE =
  'M12.800 21.500Q12.800 16 17 14.800Q22 14 26 12.500 28 14.500 32 14.800 35.200 15.800 35.200 21.500';
const HL_BUMPY =
  'M12.800 21.500Q12.500 16 15.500 14.500 18 15.800 20.500 14 22 15 24 14.200 26 15 27.500 14 30 15.800 32.500 14.500 35.500 16 35.200 21.500';
const STRANDS = 'M13.200 22 12.600 38M16 24 15.800 39M34.800 22 35.400 38M32 24 32.200 39';
const LOCS = 'M13.200 22 12.400 41M16 24 15.600 42M34.800 22 35.600 41M32 24 32.400 42';
const HAIRS = {
  0: null,
  1: {
    buzz: true,
    hl: 'M14.200 21.500Q14.500 16.500 18.500 14.800Q24 13.500 29.500 14.800 33.500 16.500 33.800 21.500',
  },
  2: { sil: [[CAP]], hl: HL_CAP },
  3: { sil: [[CAP]], hl: HL_SIDE },
  4: {
    sil: [['M11 30C8.500 12 15 5.800 24 5.800S39.500 12 37 30L34 30 34 23 14 23 14 30Z']],
    hl: HL_CAP,
  },
  5: { sil: [[BUMPY]], hl: HL_BUMPY },
  6: {
    sil: [['M10.500 26Q6.500 12 13.500 6.500 18 2.200 24 2.800T34.500 6.500Q41.500 12 37.500 26Z']],
    hl: 'M12.800 21.500Q12 15.500 16 13.800Q24 11 32 13.800 36 15.500 35.200 21.500',
  },
  7: {
    sil: [
      [
        'M11.500 24Q9 6.500 24 5.800T36.500 24Q38 35 36.500 42L32.500 42 33 24H15L15.500 42 11.500 42Q10.500 34 11.500 24Z',
      ],
    ],
    hl: HL_SIDE,
  },
  8: { sil: [[CAP], [circ(24, 5.2, 3.8)]], hl: HL_CAP },
  9: { sil: [[CAP], [STRANDS, 's']], hl: HL_CAP },
  10: {
    buzz: true,
    hl: 'M14.200 21.500Q14.500 16.500 18.500 14.800Q24 13.500 29.500 14.800 33.500 16.500 33.800 21.500',
    crest: 'M19.500 13Q18.500 3 24 2.500T28.500 13Q26 11.500 24 11.500T19.500 13Z',
  },
  11: {
    sil: [[CAP]],
    hl: 'M12.800 21.500Q13 17.500 16.500 16L18.500 12.500Q20 14 22 14.800Q24 15.500 26 14.800 28 14 29.500 12.500L31.500 16Q35 17.500 35.200 21.500',
  },
  12: {
    thin: true,
    sil: [
      ['M15.800 12.400Q10.800 15 11.400 21.500Q11.800 24.500 14 27Q12.800 21 15.600 12.400Z'],
      ['M32.200 12.400Q37.200 15 36.600 21.500Q36.200 24.500 34 27Q35.200 21 32.400 12.400Z'],
    ],
  },
  13: {
    sil: [['M12 23Q10 5.500 24 4.200T36 23Z']],
    hl: 'M12.800 21.500Q13 15.500 17 13Q24 10.500 31 13 35 15.500 35.200 21.500',
  },
  14: {
    sil: [
      [
        'M11 30Q7.500 17 13 13.500 12 9 17.500 8.500 19.500 4.500 24 6 28.500 4.500 30.500 8.500 36 9 35 13.500 40.500 17 37 30L34 30 34 23 14 23 14 30Z',
      ],
    ],
    hl: HL_BUMPY,
  },
  15: { sil: [[BUMPY], [LOCS, 's6']], hl: HL_BUMPY },
};

/** Back layer: silhouettes (behind ears and face). */
function hairBack(h, hc, sw0) {
  const sw = h?.thin ? sw0 * 0.7 : sw0;
  return (h?.sil ?? [])
    .map(([d, k]) => {
      if (k === 's' || k === 's6') {
        const w = k === 's' ? 2.6 : 3.4;
        return `<path d="${d}" fill="none" stroke="${hc}" stroke-width="${w}" stroke-linecap="round"/>`;
      }
      return `<path d="${d}" fill="${hc}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    })
    .join('');
}

/** Front layer: fill-only fringe, ink hairline, optional crest (mohawk). */
function hairFront(h, hc, sw, buzzFill) {
  if (!h?.hl) return '';
  let o = `<path d="${h.hl}${h.buzz ? CLOSE_BUZZ : CLOSE}" fill="${h.buzz ? buzzFill : hc}"/>`;
  if (!h.buzz)
    o += `<path d="${h.hl}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (h.crest)
    o += `<path d="${h.crest}" fill="${hc}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  return o;
}

// brows: left brow as [dx-from-centre, y] points; right brow is mirrored by the same function
const brow = (type, s, col, small) => {
  const X = (d) => n(24 - s * d);
  const w = [1, 1.8, 1.2, 1.4, 2.4, 0.9][type];
  const W = small ? Math.max(w, 1.6) : w;
  const d = [
    `M${X(7)} 17.500H${X(2.5)}`,
    `M${X(7)} 17.500H${X(2.5)}`,
    `M${X(7)} 18.300Q${X(4.5)} 15.800 ${X(2.5)} 17.500`,
    `M${X(7)} 16.300L${X(2.5)} 18.200`,
    `M${X(7)} 17.800Q${X(5)} 16.200 ${X(2.5)} 17.600`,
    `M${X(7)} 16.600Q${X(4.5)} 15.300 ${X(2.5)} 16.600`,
  ][type];
  return [d, W];
};

function eyesPath(type, small) {
  const L = 4.5;
  const one = (cx, s) => {
    if (small) return circ(cx, 21.5, 1.5);
    switch (type) {
      case 0:
        return circ(cx, 21.5, 1.3);
      case 1:
        return ell(cx, 21.5, 1.8, 1.1);
      case 2:
        return ell(cx, 21.5, 1.9, 0.7);
      case 3:
        return circ(cx, 21.5, 1.6);
      case 4:
        return `M${n(cx - 1.8)} ${n(21.2 - s * 0.5)}Q${cx} ${n(21 + s * 0.2)} ${n(cx + 1.8)} ${n(22.4 + s * 0.4)}Q${cx} ${n(23.2)} ${n(cx - 1.8)} ${n(21.2 - s * 0.5)}Z`;
      default:
        return ell(cx, 21.9, 1.5, 0.9);
    }
  };
  return one(24 - L, 1) + one(24 + L, -1);
}

const NOSE = [
  'M22.800 26.200q1.200.9 2.400 0',
  'M22.400 26.200q.6 1.200 1.600 1.200t1.600-1.200',
  'M24.600 22v4.600q-.5.8-2 .6',
  'M21.200 26.300q.7 1.600 2.800 1.300 2.100.3 2.800-1.300',
  'M24 22.500v3.200m-1.700 1.300a1.700 1.700 0 0 0 3.400 0',
  'M23.400 22.500q-.3 2.500.1 4 .6.5 1.100 0',
];

function mouth(type, ink, lip, small) {
  const w = small ? 1.7 : 1.1;
  const st = `fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round"`;
  switch (type) {
    case 0:
      return `<path d="M21.500 30.600h5" ${st}/>`;
    case 1:
      return `<path d="M21.500 30.200q2.500 1.600 5 0" ${st}/>`;
    case 2:
      return `<path d="M20.800 29.800q3.200 3.800 6.400 0Z" fill="#fff" stroke="${ink}" stroke-width="${w}" stroke-linejoin="round"/>`;
    case 3:
      return `<path d="M21.800 30.800q2 .2 3.200-.6.800-.4 1.200-.9" ${st}/>`;
    case 4:
      return `<path d="M21.500 31q2.500-1.500 5 0" ${st}/>`;
    default:
      return `<path d="M21 30.400q1.500-1.300 3-.5 1.500-.8 3 .5-1.500 2.300-3 2.300T21 30.400Z" fill="${lip}"/>`;
  }
}

const FACIAL = {
  1: (c) =>
    `<path d="M14.500 24.500Q16 34 24 35.200T33.500 24.500Q31 30 24 30.500T14.500 24.500Z" fill="${c}" fill-opacity=".38"/>`,
  2: (c) =>
    `<path d="M20 28.200q2-1.200 4 0 2-1.200 4 0-.5 1.600-4 .9-3.500.700-4-.9Z" fill="${c}"/>`,
  3: (c) =>
    `<path d="M20 28.200q2-1.200 4 0 2-1.200 4 0-.5 1.600-4 .9-3.500.700-4-.9Z" fill="${c}"/><path d="M21.500 32.500q2.500 1.200 5 0l-.5 2.600q-2 1-4 0Z" fill="${c}"/>`,
  4: (c) =>
    `<path d="M14.200 23Q14 33 24 35.800T33.800 23Q33 28 31 29.500 28 27.500 24 27.800T17 29.500Q15 28 14.200 23Z" fill="${c}" stroke="${INK}" stroke-width=".8" stroke-linejoin="round"/>`,
  5: (c) =>
    `<path d="M13.500 21Q13 35 24 38T34.500 21Q33 27 30.500 27.500 28 26.800 24 27T17.500 27.500Q15 27 13.500 21Z" fill="${c}" stroke="${INK}" stroke-width=".8" stroke-linejoin="round"/>`,
  6: (c) =>
    `<path d="M14.600 24Q15 33 24 35.400T33.400 24" fill="none" stroke="${c}" stroke-width="1.500" stroke-linecap="round"/>`,
  7: (c) =>
    `<path d="M20 28.200q2-1.200 4 0 2-1.200 4 0-.5 1.600-4 .9-3.500.700-4-.9Z" fill="${c}"/><path d="M21 32.500q3 1.500 6 0l-.5 2.800q-2.500 1-5 0Z" fill="${c}"/>`,
};

/** Full SVG. size <= 32 draws the simple version. */
export function renderFace(spec, size = 96, opts = {}) {
  const sp = decodeFace(typeof spec === 'string' ? spec : encodeFace(spec));
  const small = size <= 32;
  const sw = small ? 1.7 : 1.1;
  const skin = SKIN[sp.skin];
  const shade = SKIN_SHADE[sp.skin];
  const hc = HAIR[sp.hairColor];
  const bc = BROW[sp.hairColor];
  const shirt = /^#[0-9a-f]{6}$/i.test(opts.shirt ?? '') ? opts.shirt : SHIRT;
  const hair = HAIRS[sp.hairStyle];
  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" focusable="false">`;
  o += `<circle cx="24" cy="24" r="24" fill="${BACKDROP}"/>`;
  o += `<path d="M4.500 38Q6 33 14 31.500H34Q42 33 43.500 38A24 24 0 0 1 4.500 38Z" fill="${shirt}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  o += hairBack(hair, hc, sw);
  o += `<path d="M20.500 29V34L24 39 27.500 34V29Z" fill="${shade}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  if (!small) {
    const r = EAR_R[sp.ears];
    o += `<path d="${circ(13.2, 22.5, r)}${circ(34.8, 22.5, r)}" fill="${skin}" stroke="${INK}" stroke-width="${sw}"/>`;
  }
  o += `<path d="${FACE[sp.shape]}" fill="${skin}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  if (!small && sp.marks) {
    const lines = `M17.200 24.800Q16.600 28 18.500 30.200M30.800 24.800Q31.400 28 29.500 30.200${sp.marks === 2 ? 'M19 11.800q5-1 10 0' : ''}`;
    o += `<path d="${lines}" fill="none" stroke="${shade}" stroke-width=".7" stroke-linecap="round"/>`;
  }
  if (sp.facial) o += FACIAL[sp.facial](hc);
  const [bl, bw] = brow(sp.brows, 1, bc, small);
  const [br] = brow(sp.brows, -1, bc, small);
  o += `<path d="${bl}${br}" fill="none" stroke="${bc}" stroke-width="${bw}" stroke-linecap="round"/>`;
  o += `<path d="${eyesPath(sp.eyes, small)}" fill="${INK}"/>`;
  if (!small)
    o += `<path d="${NOSE[sp.nose]}" fill="none" stroke="${shade}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`;
  o += mouth(
    sp.mouth,
    sp.facial === 4 || sp.facial === 5 ? LIGHT_LIP : INK,
    SKIN_LIP[sp.skin],
    small,
  );
  o += hairFront(hair, hc, sw, buzzColor(skin, hc));
  switch (sp.accessory) {
    case 1:
      if (!small)
        o += `<path d="M13.800 15.200Q24 11.500 34.200 15.200L34 18Q24 14.500 14 18Z" fill="#f2f5f7" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
      break;
    case 2:
      if (!small)
        o += `<circle cx="13.200" cy="${n(22.5 + EAR_R[sp.ears] - 0.2)}" r="1" fill="#d9dee2" stroke="${INK}" stroke-width=".5"/>`;
      break;
    case 3:
      o += `<path d="${circ(19.5, 21.5, 3.4)}${circ(28.5, 21.5, 3.4)}M22.900 21.300q1.100-.8 2.200 0" fill="none" stroke="${INK}" stroke-width="${small ? 1.4 : 0.9}"/>`;
      break;
    case 4:
      o += `<path d="M16 19.200h7.200v4.800H16ZM24.800 19.200H32v4.800h-7.200ZM23.200 20.400h1.600" fill="none" stroke="${INK}" stroke-width="${small ? 1.4 : 0.9}" stroke-linejoin="round"/>`;
      break;
    case 5:
      if (!small)
        o += `<rect x="21.800" y="24.200" width="4.400" height="1.800" rx=".5" fill="#f2f5f7" stroke="${INK}" stroke-width=".5"/>`;
      break;
    default:
  }
  return o + '</svg>';
}

// ------------------------------------------------------------------ sampler (prototype of faceSpecFromSeed)
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
};
const stream = (seed, field) => {
  let a = fnv(`${seed}|face|${field}`);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const pick = (w, u) => {
  const tot = w.reduce((a, b) => a + b, 0);
  let x = u * tot;
  for (let i = 0; i < w.length; i++) {
    x -= w[i];
    if (x < 0) return i;
  }
  return w.length - 1;
};
const W = {
  shape: [24, 18, 16, 14, 12, 16],
  eyes: [22, 20, 14, 16, 12, 16],
  brows: [18, 22, 20, 14, 14, 12],
  nose: [20, 18, 18, 16, 16, 12],
  mouth: [24, 22, 14, 12, 14, 14],
  ears: [40, 40, 20],
  accessory: [78, 4, 8, 3, 3, 4],
  skinBR: [10, 11, 9, 8, 9, 11, 12, 10, 7, 6, 4, 3],
  hairStyle: [
    [0, 10, 16, 14, 8, 12, 5, 3, 3, 5, 5, 0, 0, 8, 4, 7],
    [3, 10, 15, 13, 7, 11, 4, 3, 3, 4, 4, 3, 2, 8, 4, 6],
    [8, 9, 14, 12, 6, 9, 3, 2, 2, 3, 2, 8, 6, 7, 3, 6],
  ],
  hairColor: [34, 24, 16, 8, 5, 3, 2, 0, 0, 8],
  facial: [
    [66, 14, 3, 4, 6, 2, 3, 2],
    [48, 14, 5, 7, 13, 6, 4, 3],
    [40, 12, 6, 8, 15, 10, 5, 4],
  ],
};
export function faceSpecFromSeed(seed, ctx = { age: 25 }) {
  const age = ctx.age;
  const br = age <= 23 ? 0 : age <= 29 ? 1 : 2;
  const U = (f) => stream(seed, f)();
  const s = {};
  s.skin = pick(W.skinBR, U('skin'));
  s.shape = pick(W.shape, U('shape'));
  let hs = [...W.hairStyle[br]];
  for (const i of [5, 6, 9, 15]) hs[i] *= s.skin >= 8 ? 1.5 : s.skin <= 3 ? 0.75 : 1;
  s.hairStyle = pick(hs, U('hairStyle'));
  let hc = [...W.hairColor];
  if (s.skin >= 7) {
    hc[0] += hc[4] + hc[5] + hc[6];
    hc[4] = hc[5] = hc[6] = 0;
  }
  const u = U('hairColor');
  const pGrey = Math.min(0.3, Math.max(0, (age - 29) * 0.06));
  const pWhite = age >= 33 ? Math.min(0.08, 0.02 * (age - 32)) : 0;
  s.hairColor =
    u < pWhite ? 8 : u < pWhite + pGrey ? 7 : pick(hc, (u - pWhite - pGrey) / (1 - pWhite - pGrey));
  s.brows = pick(W.brows, U('brows'));
  s.eyes = pick(W.eyes, U('eyes'));
  s.nose = pick(W.nose, U('nose'));
  s.mouth = pick(W.mouth, U('mouth'));
  s.ears = pick(W.ears, U('ears'));
  s.facial = pick(W.facial[br], U('facial'));
  s.accessory = pick(W.accessory, U('accessory'));
  const m = age < 28 ? [100, 0, 0] : age < 32 ? [75, 25, 0] : [45, 40, 15];
  s.marks = pick(m, U('marks'));
  return s;
}

// ------------------------------------------------------------------ contrast
const lum = (hex) => {
  const v = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const cr = (a, b) => {
  const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (h + 0.05) / (l + 0.05);
};

// ------------------------------------------------------------------ sheet
const bgs = { dia: ['#f3f5f7', '#ffffff'], noite: ['#0f1a24', '#172534'] };
const picks = [
  [18, 11],
  [19, 207],
  [20, 3],
  [21, 98],
  [22, 41],
  [24, 77],
  [25, 5],
  [26, 150],
  [27, 19],
  [28, 233],
  [29, 64],
  [30, 12],
  [31, 88],
  [32, 45],
  [33, 301],
  [34, 7],
].map(([age, seed]) => faceSpecFromSeed(seed, { age }));

if (process.argv.includes('--sheet') || !process.argv.includes('--check')) {
  const PW = 4 * 96 + 5 * 16;
  const PH = 16 + 4 * 112 + 16 + 48 + 16 + 32 + 16 + 8 * 0;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW * 2} ${PH}" width="${PW * 2}" height="${PH}">`;
  ['dia', 'noite'].forEach((t, k) => {
    const ox = k * PW;
    out += `<rect x="${ox}" y="0" width="${PW}" height="${PH}" fill="${bgs[t][0]}"/>`;
    out += `<rect x="${ox + 8}" y="8" width="${PW - 16}" height="${4 * 112 + 8}" rx="12" fill="${bgs[t][1]}"/>`;
    picks.forEach((sp, i) => {
      const x = ox + 16 + (i % 4) * 112;
      const y = 16 + Math.floor(i / 4) * 112;
      out += renderFace(sp, 96).replace('<svg ', `<svg x="${x}" y="${y}" `);
    });
    const y48 = 16 + 4 * 112 + 16;
    for (let i = 0; i < 8; i++) {
      out += renderFace(picks[i], 48).replace('<svg ', `<svg x="${ox + 16 + i * 56}" y="${y48}" `);
    }
    const y32 = y48 + 48 + 16;
    for (let i = 0; i < 12; i++) {
      out += renderFace(picks[i + 4], 32).replace(
        '<svg ',
        `<svg x="${ox + 16 + i * 36}" y="${y32}" `,
      );
    }
  });
  out += '</svg>';
  writeFileSync(resolve(root, 'docs/art/avatares-exemplo.svg'), out);
  console.log('sheet bytes', out.length, 'codes', picks.map(encodeFace).join(' '));
}

if (process.argv.includes('--check')) {
  for (const t of ['noite', 'dia'])
    for (const b of bgs[t]) console.log('backdrop vs', t, b, cr(BACKDROP, b).toFixed(2));
  console.log('ink vs backdrop', cr(INK, BACKDROP).toFixed(2));
  console.log(
    'skin vs backdrop min',
    Math.min(...SKIN.map((c) => cr(c, BACKDROP))).toFixed(2),
    SKIN.map((c) => cr(c, BACKDROP).toFixed(1)).join(' '),
  );
  console.log('hair vs backdrop', HAIR.map((c) => cr(c, BACKDROP).toFixed(1)).join(' '));
  console.log('shirt vs backdrop', cr(SHIRT, BACKDROP).toFixed(2));
  let max = 0,
    maxS = 0,
    tot = 0,
    maxEl = 0,
    maxElS = 0;
  const codes = new Set();
  const dist = {};
  for (let i = 0; i < 1000; i++) {
    const age = 17 + (i % 18);
    const sp = faceSpecFromSeed(i * 7919 + 3, { age });
    codes.add(encodeFace(sp));
    for (const f of FIELDS) (dist[f] ??= Array(COUNTS[f]).fill(0))[sp[f]]++;
    const a = renderFace(sp, 96),
      b = renderFace(sp, 32);
    max = Math.max(max, a.length);
    maxS = Math.max(maxS, b.length);
    tot += a.length;
    maxEl = Math.max(maxEl, (a.match(/<(path|circle|rect)/g) ?? []).length);
    maxElS = Math.max(maxElS, (b.match(/<(path|circle|rect)/g) ?? []).length);
  }
  console.log(
    'bytes full max',
    max,
    'avg',
    Math.round(tot / 1000),
    'small max',
    maxS,
    'elements full max',
    maxEl,
    'small max',
    maxElS,
    'distinct codes/1000',
    codes.size,
  );
  for (const f of ['skin', 'hairStyle', 'hairColor', 'facial']) console.log(f, dist[f].join(','));
  // squads of 30
  const stats = { skin: [], style: [], triple: [], dup: [] };
  for (let q = 0; q < 300; q++) {
    const sq = [];
    for (let j = 0; j < 30; j++)
      sq.push(faceSpecFromSeed(q * 1000 + j * 13 + 1, { age: 17 + ((q + j * 5) % 18) }));
    stats.skin.push(new Set(sq.map((s) => s.skin)).size);
    stats.style.push(new Set(sq.map((s) => s.hairStyle)).size);
    stats.triple.push(new Set(sq.map((s) => `${s.skin}${s.hairStyle}${s.hairColor}`)).size);
    stats.dup.push(30 - new Set(sq.map(encodeFace)).size);
  }
  for (const [k, v] of Object.entries(stats)) {
    v.sort((a, b) => a - b);
    console.log('squad', k, 'min', v[0], 'p1', v[3], 'p5', v[15], 'median', v[150]);
  }
}
