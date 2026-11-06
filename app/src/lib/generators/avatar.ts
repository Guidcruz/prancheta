import { decodeFace, encodeFace, type FaceSpec } from './face.ts';
import { SMALL_SIZE, escapeText, safeColor } from './shield.ts';

/*
 * Player avatar renderer (docs/art/avatares.md, US-005): a bust in a medallion, flat colours,
 * `ink` outline, drawn from a FaceSpec (usually `Player.face`, decoded here). Pure and
 * deterministic. The output is a self-contained SVG with only `svg`, `path`, `circle` and
 * `rect`: no `id`, `defs`, `style`, `text` or link, so many avatars can share a page. With
 * `size <= 32` it draws the simple version. Runs only in the client (the server has face.ts).
 */

/** Width in px up to which the simple version is drawn (the same rule as the shield). */
export const AVATAR_SMALL_SIZE = SMALL_SIZE;
const MIN_SIZE = 16;
const MAX_SIZE = 512;
const FALLBACK_SIZE = 48;

// ------------------------------------------------------------------ closed palettes

export const INK = '#0b1118';
/** The medallion: the same for every player, never themed nor club-coloured. */
export const BACKDROP = '#5f7f98';
/** Neutral shirt, the default. */
export const SHIRT = '#e6ebf0';
const LIGHT_LIP = '#e3a6a0';
const TEETH = '#fff';
const HEADBAND = '#f2f5f7';
const EARRING = '#d9dee2';
const TAPE = '#f2f5f7';

/** Skin tones by index, lightest to darkest (catalogue `skin`). */
export const SKIN_COLORS: readonly string[] = [
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

/** Hair colours by index (catalogue `hairColor`); beards use the same. */
export const HAIR_COLORS: readonly string[] = [
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

/**
 * Eyebrow colour by hair colour: natural tones only, never a blond or bleached hue (it turns
 * olive on skin). Blond, dark blond and bleached get brown; grey and white get grey.
 */
export const BROW_COLORS: readonly string[] = [
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

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** `hex` moved a fraction `t` towards `to` (integer channels, rounded). */
export function mixColor(hex: string, to: readonly [number, number, number], t: number): string {
  return `#${rgb(hex)
    .map((c, i) =>
      Math.round(c * (1 - t) + to[i]! * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/*
 * Derived tables, fixed by formula and computed once: shade (neck, nose, marks) is the skin 20%
 * towards black, the lip 40% towards #963240, and the shaved hair (buzz, mohawk sides) is an
 * opaque tone halfway between skin and hair, so it reads as short hair and never as a cap.
 */
export const SKIN_SHADES: readonly string[] = SKIN_COLORS.map((c) => mixColor(c, [0, 0, 0], 0.2));
export const SKIN_LIPS: readonly string[] = SKIN_COLORS.map((c) => mixColor(c, [150, 50, 64], 0.4));
export const BUZZ_COLORS: readonly (readonly string[])[] = SKIN_COLORS.map((skin) =>
  HAIR_COLORS.map((hair) => mixColor(skin, rgb(hair), 0.5)),
);

/** Every colour an avatar may use, without the shirt option (for the tests). */
export function avatarPalette(): Set<string> {
  return new Set([
    INK,
    BACKDROP,
    SHIRT,
    LIGHT_LIP,
    TEETH,
    HEADBAND,
    EARRING,
    TAPE,
    ...SKIN_COLORS,
    ...HAIR_COLORS,
    ...BROW_COLORS,
    ...SKIN_SHADES,
    ...SKIN_LIPS,
    ...BUZZ_COLORS.flat(),
  ]);
}

// ------------------------------------------------------------------ geometry helpers

const n = (v: number) => String(+v.toFixed(2));
const circ = (cx: number, cy: number, r: number) =>
  `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0Z`;

// ------------------------------------------------------------------ shapes

/** Head outlines by `shape`: oval, round, square, long, narrow chin, wide jaw. */
const FACES: readonly string[] = [
  'M24 8.5C31 8.5 34 14 34 21c0 8-4.5 14-10 14S14 29 14 21c0-7 3-12.5 10-12.5Z',
  'M24 9C31.5 9 35 14.5 35 22c0 7.5-5 13-11 13S13 29.5 13 22C13 14.5 16.5 9 24 9Z',
  'M24 9c6 0 10 1.5 10 6v9c0 6-2.5 11-10 11s-10-5-10-11v-9c0-4.5 4-6 10-6Z',
  'M24 7.5C30.5 7.5 33.5 13 33.5 20c0 9-4 15.5-9.5 15.5S14.5 29 14.5 20c0-7 3-12.5 9.5-12.5Z',
  'M24 9C31 9 35 13.5 35 19.5c0 6-4 10.5-8 14-1.5 1.3-2.2 2-3 2s-1.5-.7-3-2c-4-3.5-8-8-8-14C13 13.5 17 9 24 9Z',
  'M24 9.5c6.5 0 10.5 2.5 10.8 8 .4 6-.5 10-3 13.5-1.8 2.5-4.5 4-7.8 4s-6-1.5-7.8-4c-2.5-3.5-3.4-7.5-3-13.5.3-5.5 4.3-8 10.8-8Z',
];
/** Ear radius by `ears`: small, medium, sticking out. */
const EAR_R: readonly number[] = [1.8, 2.4, 3];
const EAR_Y = 22.5;
const EAR_X = [13.2, 34.8] as const;

/*
 * Hair is three layers, so it never leaves a gap against the skull (docs/art/avatares.md, 1):
 *  - silhouette, BEHIND ears and face (fill + ink stroke): it always covers the skull top, so the
 *    head sits on the hair and no backdrop shows between them;
 *  - hairline, an open path from the left temple to the right one (ink stroke);
 *  - fringe, fill only, in front of the face: the hairline closed through the inside of the
 *    silhouette, which hides the skull outline under the hair without a second contour.
 * Bald and crown have no fringe; buzz and mohawk use an opaque skin-and-hair tone, no outline.
 */
const CLOSE = 'C35.4 12 31 7.4 24 7.4S12.6 12 12.8 21.5Z';
const CLOSE_BUZZ = 'C34 12 31 9.2 24 9.2S14 12 14.2 21.5Z';
const CAP = 'M12.2 23C11.2 12 16.5 6.2 24 6.2S36.8 12 35.8 23Z';
const BUMPY =
  'M12 23Q9.5 17 13 13.5 12 9 17.5 8.5 19.5 4.5 24 6 28.5 4.5 30.5 8.5 36 9 35 13.5 38.5 17 36 23Z';
const HL_CAP = 'M12.8 21.5Q13 15.5 18.5 14.5Q24 12.8 29.5 14.5Q35 15.5 35.2 21.5';
const HL_SIDE = 'M12.8 21.5Q12.8 16 17 14.8Q22 14 26 12.5 28 14.5 32 14.8 35.2 15.8 35.2 21.5';
const HL_BUMPY =
  'M12.8 21.5Q12.5 16 15.5 14.5 18 15.8 20.5 14 22 15 24 14.2 26 15 27.5 14 30 15.8 32.5 14.5 35.5 16 35.2 21.5';
const HL_BUZZ = 'M14.2 21.5Q14.5 16.5 18.5 14.8Q24 13.5 29.5 14.8 33.5 16.5 33.8 21.5';
const STRANDS = 'M13.2 22 12.6 38M16 24 15.8 39M34.8 22 35.4 38M32 24 32.2 39';
const LOCS = 'M13.2 22 12.4 41M16 24 15.6 42M34.8 22 35.6 41M32 24 32.4 42';

interface HairPiece {
  d: string;
  /** `fill`: filled shape with ink outline; `strands`/`locs`: thick hair-coloured strokes. */
  kind: 'fill' | 'strands' | 'locs';
}
interface HairDef {
  sil?: readonly HairPiece[];
  hl?: string;
  /** Shaved: the fringe takes the skin-and-hair tone and the hairline has no ink. */
  buzz?: boolean;
  /** Thinner outline (crown: two thin crescents). */
  thin?: boolean;
  /** Mohawk crest, drawn over the fringe. */
  crest?: string;
}
const fill = (d: string): HairPiece => ({ d, kind: 'fill' });

/** By `hairStyle` (docs/art/avatares.md, 2); index 0 (bald) draws nothing. */
const HAIRS: readonly (HairDef | undefined)[] = [
  undefined,
  { buzz: true, hl: HL_BUZZ },
  { sil: [fill(CAP)], hl: HL_CAP },
  { sil: [fill(CAP)], hl: HL_SIDE },
  {
    sil: [fill('M11 30C8.5 12 15 5.8 24 5.8S39.5 12 37 30L34 30 34 23 14 23 14 30Z')],
    hl: HL_CAP,
  },
  { sil: [fill(BUMPY)], hl: HL_BUMPY },
  {
    sil: [fill('M10.5 26Q6.5 12 13.5 6.5 18 2.2 24 2.8T34.5 6.5Q41.5 12 37.5 26Z')],
    hl: 'M12.8 21.5Q12 15.5 16 13.8Q24 11 32 13.8 36 15.5 35.2 21.5',
  },
  {
    sil: [
      fill(
        'M11.5 24Q9 6.5 24 5.8T36.5 24Q38 35 36.5 42L32.5 42 33 24H15L15.5 42 11.5 42Q10.5 34 11.5 24Z',
      ),
    ],
    hl: HL_SIDE,
  },
  { sil: [fill(CAP), fill(circ(24, 5.2, 3.8))], hl: HL_CAP },
  { sil: [fill(CAP), { d: STRANDS, kind: 'strands' }], hl: HL_CAP },
  {
    buzz: true,
    hl: HL_BUZZ,
    crest: 'M19.5 13Q18.5 3 24 2.5T28.5 13Q26 11.5 24 11.5T19.5 13Z',
  },
  {
    sil: [fill(CAP)],
    hl: 'M12.8 21.5Q13 17.5 16.5 16L18.5 12.5Q20 14 22 14.8Q24 15.5 26 14.8 28 14 29.5 12.5L31.5 16Q35 17.5 35.2 21.5',
  },
  {
    thin: true,
    sil: [
      fill('M15.8 12.4Q10.8 15 11.4 21.5Q11.8 24.5 14 27Q12.8 21 15.6 12.4Z'),
      fill('M32.2 12.4Q37.2 15 36.6 21.5Q36.2 24.5 34 27Q35.2 21 32.4 12.4Z'),
    ],
  },
  {
    sil: [fill('M12 23Q10 5.5 24 4.2T36 23Z')],
    hl: 'M12.8 21.5Q13 15.5 17 13Q24 10.5 31 13 35 15.5 35.2 21.5',
  },
  {
    sil: [
      fill(
        'M11 30Q7.5 17 13 13.5 12 9 17.5 8.5 19.5 4.5 24 6 28.5 4.5 30.5 8.5 36 9 35 13.5 40.5 17 37 30L34 30 34 23 14 23 14 30Z',
      ),
    ],
    hl: HL_BUMPY,
  },
  { sil: [fill(BUMPY), { d: LOCS, kind: 'locs' }], hl: HL_BUMPY },
];

/** Back layer: silhouettes, behind ears and face. */
function hairBack(hair: HairDef | undefined, color: string, stroke: number): string {
  const sw = hair?.thin ? n(stroke * 0.7) : n(stroke);
  return (hair?.sil ?? [])
    .map(({ d, kind }) =>
      kind === 'fill'
        ? `<path d="${d}" fill="${color}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`
        : `<path d="${d}" fill="none" stroke="${color}" stroke-width="${kind === 'strands' ? 2.6 : 3.4}" stroke-linecap="round"/>`,
    )
    .join('');
}

/** Front layer: fill-only fringe, ink hairline, mohawk crest. */
function hairFront(hair: HairDef | undefined, color: string, stroke: number, buzz: string): string {
  if (hair?.hl === undefined) return '';
  let out = `<path d="${hair.hl}${hair.buzz ? CLOSE_BUZZ : CLOSE}" fill="${hair.buzz ? buzz : color}"/>`;
  if (!hair.buzz) {
    out += `<path d="${hair.hl}" fill="none" stroke="${INK}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (hair.crest !== undefined) {
    out += `<path d="${hair.crest}" fill="${color}" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round"/>`;
  }
  return out;
}

/** Stroke width by `brows`: thin straight, thick straight, arched, slanted, full, thin high. */
const BROW_WIDTH: readonly number[] = [1, 1.8, 1.2, 1.4, 2.4, 0.9];
/** Minimum brow width in the simple version. */
const SMALL_BROW_WIDTH = 1.6;

/** One brow; `s` is 1 for the left one and -1 for its mirror. */
function brow(type: number, s: 1 | -1): string {
  const x = (d: number) => n(24 - s * d);
  switch (type) {
    case 2:
      return `M${x(7)} 18.3Q${x(4.5)} 15.8 ${x(2.5)} 17.5`;
    case 3:
      return `M${x(7)} 16.3L${x(2.5)} 18.2`;
    case 4:
      return `M${x(7)} 17.8Q${x(5)} 16.2 ${x(2.5)} 17.6`;
    case 5:
      return `M${x(7)} 16.6Q${x(4.5)} 15.3 ${x(2.5)} 16.6`;
    default:
      return `M${x(7)} 17.5H${x(2.5)}`;
  }
}

/** Both eyes by `eyes`: round, almond, narrow, big, droopy, heavy lid; dots when small. */
function eyesPath(type: number, small: boolean): string {
  const one = (cx: number, s: 1 | -1) => {
    if (small) return circ(cx, 21.5, 1.5);
    switch (type) {
      case 1:
        return ell(cx, 21.5, 1.8, 1.1);
      case 2:
        return ell(cx, 21.5, 1.9, 0.7);
      case 3:
        return circ(cx, 21.5, 1.6);
      case 4:
        return `M${n(cx - 1.8)} ${n(21.2 - s * 0.5)}Q${n(cx)} ${n(21 + s * 0.2)} ${n(cx + 1.8)} ${n(22.4 + s * 0.4)}Q${n(cx)} 23.2 ${n(cx - 1.8)} ${n(21.2 - s * 0.5)}Z`;
      case 5:
        return ell(cx, 21.9, 1.5, 0.9);
      default:
        return circ(cx, 21.5, 1.3);
    }
  };
  return one(19.5, 1) + one(28.5, -1);
}

/** Nose strokes by `nose`: small, rounded, long straight, wide, round tip, narrow. */
const NOSES: readonly string[] = [
  'M22.8 26.2q1.2.9 2.4 0',
  'M22.4 26.2q.6 1.2 1.6 1.2t1.6-1.2',
  'M24.6 22v4.6q-.5.8-2 .6',
  'M21.2 26.3q.7 1.6 2.8 1.3 2.1.3 2.8-1.3',
  'M24 22.5v3.2m-1.7 1.3a1.7 1.7 0 0 0 3.4 0',
  'M23.4 22.5q-.3 2.5.1 4 .6.5 1.1 0',
];

/** Mouth by `mouth`: neutral, light smile, teeth, half smile, serious, full lips. */
function mouth(type: number, ink: string, lip: string, small: boolean): string {
  const w = small ? 1.7 : 1.1;
  const line = `fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round"`;
  switch (type) {
    case 1:
      return `<path d="M21.5 30.2q2.5 1.6 5 0" ${line}/>`;
    case 2:
      return `<path d="M20.8 29.8q3.2 3.8 6.4 0Z" fill="${TEETH}" stroke="${ink}" stroke-width="${w}" stroke-linejoin="round"/>`;
    case 3:
      return `<path d="M21.8 30.8q2 .2 3.2-.6.8-.4 1.2-.9" ${line}/>`;
    case 4:
      return `<path d="M21.5 31q2.5-1.5 5 0" ${line}/>`;
    case 5:
      return `<path d="M21 30.4q1.5-1.3 3-.5 1.5-.8 3 .5-1.5 2.3-3 2.3T21 30.4Z" fill="${lip}"/>`;
    default:
      return `<path d="M21.5 30.6h5" ${line}/>`;
  }
}

const MOUSTACHE = 'M20 28.2q2-1.2 4 0 2-1.2 4 0-.5 1.6-4 .9-3.5.7-4-.9Z';
/** Facial hair by `facial` (0 is none); full beards (4, 5) have a thin ink outline. */
const FACIAL: readonly (((color: string) => string) | undefined)[] = [
  undefined,
  (c) =>
    `<path d="M14.5 24.5Q16 34 24 35.2T33.5 24.5Q31 30 24 30.5T14.5 24.5Z" fill="${c}" fill-opacity=".38"/>`,
  (c) => `<path d="${MOUSTACHE}" fill="${c}"/>`,
  (c) =>
    `<path d="${MOUSTACHE}" fill="${c}"/><path d="M21.5 32.5q2.5 1.2 5 0l-.5 2.6q-2 1-4 0Z" fill="${c}"/>`,
  (c) =>
    `<path d="M14.2 23Q14 33 24 35.8T33.8 23Q33 28 31 29.5 28 27.5 24 27.8T17 29.5Q15 28 14.2 23Z" fill="${c}" stroke="${INK}" stroke-width=".8" stroke-linejoin="round"/>`,
  (c) =>
    `<path d="M13.5 21Q13 35 24 38T34.5 21Q33 27 30.5 27.5 28 26.8 24 27T17.5 27.5Q15 27 13.5 21Z" fill="${c}" stroke="${INK}" stroke-width=".8" stroke-linejoin="round"/>`,
  (c) =>
    `<path d="M14.6 24Q15 33 24 35.4T33.4 24" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`,
  (c) =>
    `<path d="${MOUSTACHE}" fill="${c}"/><path d="M21 32.5q3 1.5 6 0l-.5 2.8q-2.5 1-5 0Z" fill="${c}"/>`,
];
/** Full beards: the mouth line turns light so it shows on the beard. */
const FULL_BEARDS: readonly number[] = [4, 5];

/** Accessory by `accessory` (0 is none). Only glasses survive in the simple version. */
function accessory(type: number, ears: number, small: boolean): string {
  const glasses = small ? 1.4 : 0.9;
  switch (type) {
    case 1:
      return small
        ? ''
        : `<path d="M13.8 15.2Q24 11.5 34.2 15.2L34 18Q24 14.5 14 18Z" fill="${HEADBAND}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`;
    case 2:
      return small
        ? ''
        : `<circle cx="${EAR_X[0]}" cy="${n(EAR_Y + EAR_R[ears]! - 0.2)}" r="1" fill="${EARRING}" stroke="${INK}" stroke-width=".5"/>`;
    case 3:
      return `<path d="${circ(19.5, 21.5, 3.4)}${circ(28.5, 21.5, 3.4)}M22.9 21.3q1.1-.8 2.2 0" fill="none" stroke="${INK}" stroke-width="${glasses}"/>`;
    case 4:
      return `<path d="M16 19.2h7.2v4.8H16ZM24.8 19.2H32v4.8h-7.2ZM23.2 20.4h1.6" fill="none" stroke="${INK}" stroke-width="${glasses}" stroke-linejoin="round"/>`;
    case 5:
      return small
        ? ''
        : `<rect x="21.8" y="24.2" width="4.4" height="1.8" rx=".5" fill="${TAPE}" stroke="${INK}" stroke-width=".5"/>`;
    default:
      return '';
  }
}

// ------------------------------------------------------------------ render

/** A club colour for the shirt when it is `#rrggbb`, else the neutral shirt. */
const safeShirt = (c: unknown) =>
  typeof c === 'string' ? safeColor(c, SHIRT).toLowerCase() : SHIRT;
const safeSize = (size: number) =>
  Number.isFinite(size) && size >= MIN_SIZE && size <= MAX_SIZE ? size : FALLBACK_SIZE;

export interface RenderFaceOptions {
  /** Club colour for the shirt (`#rrggbb`); anything else gives the neutral shirt. */
  shirt?: string;
  /** Accessible name (the player's name, never a description of the face). Always escaped. */
  label?: string;
}

/**
 * Renders a face as SVG (viewBox 48x48, `size` px square, 16 to 512, else 48). `face` is
 * `Player.face` or a spec; either way it is decoded, so an invalid or retired index is drawn as
 * its replacement. Decorative (`aria-hidden`) unless `opts.label` is given.
 */
export function renderFace(
  face: string | FaceSpec,
  size: number,
  opts: RenderFaceOptions = {},
): string {
  const sp = decodeFace(typeof face === 'string' ? face : encodeFace(face));
  const px = safeSize(size);
  const small = px <= AVATAR_SMALL_SIZE;
  const sw = small ? 1.7 : 1.1;
  const skin = SKIN_COLORS[sp.skin]!;
  const shade = SKIN_SHADES[sp.skin]!;
  const hairColor = HAIR_COLORS[sp.hairColor]!;
  const hair = HAIRS[sp.hairStyle];
  const outline = `stroke="${INK}" stroke-width="${sw}"`;
  const a11y =
    opts.label !== undefined
      ? `role="img" aria-label="${escapeText(String(opts.label))}"`
      : 'aria-hidden="true" focusable="false"';

  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${px}" height="${px}" ${a11y}>`;
  o += `<circle cx="24" cy="24" r="24" fill="${BACKDROP}"/>`;
  o += `<path d="M4.5 38Q6 33 14 31.5H34Q42 33 43.5 38A24 24 0 0 1 4.5 38Z" fill="${safeShirt(opts.shirt)}" ${outline} stroke-linejoin="round"/>`;
  o += hairBack(hair, hairColor, sw);
  o += `<path d="M20.5 29V34L24 39 27.5 34V29Z" fill="${shade}" ${outline} stroke-linejoin="round"/>`;
  if (!small) {
    const r = EAR_R[sp.ears]!;
    o += `<path d="${circ(EAR_X[0], EAR_Y, r)}${circ(EAR_X[1], EAR_Y, r)}" fill="${skin}" ${outline}/>`;
  }
  o += `<path d="${FACES[sp.shape]}" fill="${skin}" ${outline} stroke-linejoin="round"/>`;
  if (!small && sp.marks > 0) {
    const lines = `M17.2 24.8Q16.6 28 18.5 30.2M30.8 24.8Q31.4 28 29.5 30.2${sp.marks === 2 ? 'M19 11.8q5-1 10 0' : ''}`;
    o += `<path d="${lines}" fill="none" stroke="${shade}" stroke-width=".7" stroke-linecap="round"/>`;
  }
  o += FACIAL[sp.facial]?.(hairColor) ?? '';
  const browWidth = BROW_WIDTH[sp.brows]!;
  o += `<path d="${brow(sp.brows, 1)}${brow(sp.brows, -1)}" fill="none" stroke="${BROW_COLORS[sp.hairColor]}" stroke-width="${small ? Math.max(browWidth, SMALL_BROW_WIDTH) : browWidth}" stroke-linecap="round"/>`;
  o += `<path d="${eyesPath(sp.eyes, small)}" fill="${INK}"/>`;
  if (!small) {
    o += `<path d="${NOSES[sp.nose]}" fill="none" stroke="${shade}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  o += mouth(
    sp.mouth,
    FULL_BEARDS.includes(sp.facial) ? LIGHT_LIP : INK,
    SKIN_LIPS[sp.skin]!,
    small,
  );
  o += hairFront(hair, hairColor, sw, BUZZ_COLORS[sp.skin]![sp.hairColor]!);
  o += accessory(sp.accessory, sp.ears, small);
  return `${o}</svg>`;
}
