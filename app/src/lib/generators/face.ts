import { Rng, seedFromString } from '../../engine/index.ts';

/*
 * Face specification of the players (docs/art/avatares.md, ADR-0012 and its note of 2026-11-06):
 * the catalogue of traits, the draw weights, the table of retired traits and the short encoding
 * stored in `Player.face`. No SVG here: the drawing is `renderFace` in avatar.ts, which runs only
 * in the client, while this file is shared with the server (docs/02-architecture.md, 5).
 *
 * `faceSpecFromSeed` runs once, when a player is created, and only inside identity.ts. A face
 * that exists is never drawn again by lot: screens decode `Player.face` and render it.
 */

/** Fields of a face, in codec order. The order never changes; a new field goes at the end. */
export const FACE_FIELDS = [
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
] as const;

export type FaceField = (typeof FACE_FIELDS)[number];

/** Index of each trait in its catalogue; 0 is always the neutral value and the fallback. */
export type FaceSpec = Readonly<Record<FaceField, number>>;

/**
 * Number of values of each field (docs/art/avatares.md, 2). The catalogue only grows: an index
 * never changes meaning nor is reused (a retired one goes to {@link RETIRED_TRAITS}). Each
 * field fits one base-36 character, so at most 36 values.
 */
export const FACE_COUNTS: Readonly<Record<FaceField, number>> = {
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

/** Named indices the drawing and the rules refer to (docs/art/avatares.md, 2). */
export const HAIR_STYLE = {
  bald: 0,
  buzz: 1,
  locsLong: 9,
  mohawk: 10,
  receding: 11,
  crown: 12,
} as const;
export const HAIR_COLOR = { black: 0, darkBlond: 4, blond: 5, red: 6, grey: 7, white: 8 } as const;

/** Version of the layout, the first character of every code. */
export const FACE_LAYOUT_VERSION = '1';

export type RetiredTraits = Partial<Record<FaceField, Readonly<Record<number, number>>>>;

/** Retired trait indices. A retired index is never reused; it maps to a live one. */
export const RETIRED_TRAITS: RetiredTraits = {};

/** The neutral face (every field 0): what any unreadable code decodes to. */
export const NEUTRAL_FACE: FaceSpec = Object.freeze(
  Object.fromEntries(FACE_FIELDS.map((f) => [f, 0])) as Record<FaceField, number>,
);

const CODE = /^[0-9a-z]{2,32}$/;

const validIndex = (field: FaceField, value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < FACE_COUNTS[field];

/**
 * Encodes a spec as `"1"` + one base-36 character per field (13 characters today). An index
 * outside the catalogue is written as 0, so the result always decodes to a valid face.
 */
export function encodeFace(spec: FaceSpec): string {
  return (
    FACE_LAYOUT_VERSION +
    FACE_FIELDS.map((f) => (validIndex(f, spec[f]) ? spec[f] : 0).toString(36)).join('')
  );
}

/**
 * Decodes `Player.face`. Never throws: a text that is not `^[0-9a-z]{2,32}$` or has an unknown
 * version gives the neutral face; a missing character (a code written before the field
 * existed) is 0; a retired index is swapped first, then anything outside the catalogue is 0.
 * `retired` is a parameter only so tests can try a synthetic table.
 */
export function decodeFace(code: unknown, retired: RetiredTraits = RETIRED_TRAITS): FaceSpec {
  if (typeof code !== 'string' || !CODE.test(code) || code[0] !== FACE_LAYOUT_VERSION) {
    return NEUTRAL_FACE;
  }
  const spec = {} as Record<FaceField, number>;
  FACE_FIELDS.forEach((field, i) => {
    const char = code[i + 1];
    let value = char === undefined ? 0 : parseInt(char, 36);
    const swaps = retired[field];
    if (swaps !== undefined && Object.hasOwn(swaps, value)) value = swaps[value]!;
    spec[field] = validIndex(field, value) ? value : 0;
  });
  return spec;
}

/**
 * Problems of a retired-trait table (empty when it is sound): every source and destination is
 * in the catalogue, a destination is never itself retired (no chain, no loop), no index maps to
 * itself.
 */
export function retiredTraitProblems(table: RetiredTraits): string[] {
  const problems: string[] = [];
  for (const [field, swaps] of Object.entries(table)) {
    if (!(FACE_FIELDS as readonly string[]).includes(field)) {
      problems.push(`unknown field ${field}`);
      continue;
    }
    const f = field as FaceField;
    for (const [from, to] of Object.entries(swaps ?? {})) {
      const source = Number(from);
      if (!validIndex(f, source)) problems.push(`${f}: retired ${from} is outside the catalogue`);
      if (!validIndex(f, to)) problems.push(`${f}: ${from} maps outside the catalogue (${to})`);
      if (source === to) problems.push(`${f}: ${from} maps to itself`);
      else if (swaps !== undefined && Object.hasOwn(swaps, to)) {
        problems.push(`${f}: ${from} maps to the retired ${to}`);
      }
    }
  }
  return problems;
}

// ------------------------------------------------------------------ draw weights

type Weights = readonly number[];
/** Age bands of the draw: up to 23, 24 to 29, 30 or more. */
type AgeBand = 0 | 1 | 2;

/**
 * Weights of the draws (docs/art/avatares.md, "Pesos dos sorteios"), in index order. Only the
 * skin tone depends on the nationality; nothing else does.
 */
export const FACE_WEIGHTS = {
  shape: [24, 18, 16, 14, 12, 16],
  eyes: [22, 20, 14, 16, 12, 16],
  brows: [18, 22, 20, 14, 14, 12],
  nose: [20, 18, 18, 16, 16, 12],
  mouth: [24, 22, 14, 12, 14, 14],
  ears: [40, 40, 20],
  accessory: [78, 4, 8, 3, 3, 4],
  /** By age band. Bald, receding and crown never under 24. */
  hairStyle: [
    [0, 10, 16, 14, 8, 12, 5, 3, 3, 5, 5, 0, 0, 8, 4, 7],
    [3, 10, 15, 13, 7, 11, 4, 3, 3, 4, 4, 3, 2, 8, 4, 6],
    [8, 9, 14, 12, 6, 9, 3, 2, 2, 3, 2, 8, 6, 7, 3, 6],
  ],
  /** Base hair colour; grey and white come only from the age rule. */
  hairColor: [34, 24, 16, 8, 5, 3, 2, 0, 0, 8],
  /** By age band. */
  facial: [
    [66, 14, 3, 4, 6, 2, 3, 2],
    [48, 14, 5, 7, 13, 6, 4, 3],
    [40, 12, 6, 8, 15, 10, 5, 4],
  ],
} as const satisfies Record<string, Weights | readonly Weights[]>;

/**
 * Skin-tone weights by nationality (ISO 3166-1 alpha-2). Etapa 1 has only Brazil; the other
 * countries come in Etapa 5, approved by the CEO, with at least 5% in each band (light 0 to 3,
 * medium 4 to 7, dark 8 to 11). An unknown nationality uses Brazil's.
 */
export const SKIN_WEIGHTS: Readonly<Record<string, Weights>> = {
  BR: [10, 11, 9, 8, 9, 11, 12, 10, 7, 6, 4, 3],
};
const DEFAULT_SKIN_NATIONALITY = 'BR';

/** Curly and coiled styles (short curls, afro, braids, locs), weighted by skin tone. */
const CURLY_STYLES: readonly number[] = [5, 6, 9, 15];
/** Natural light hair (dark blond, blond, red), never drawn for skin 7 or darker. */
const NATURAL_LIGHT_HAIR: readonly number[] = [
  HAIR_COLOR.darkBlond,
  HAIR_COLOR.blond,
  HAIR_COLOR.red,
];
/** Age used when the context has none (not a finite number): the youngest band. */
const FALLBACK_AGE = 17;

const ageBand = (age: number): AgeBand => (age <= 23 ? 0 : age <= 29 ? 1 : 2);

/** Index drawn from `weights` with a uniform `u` in [0, 1). */
function pick(weights: Weights, u: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = u * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i]!;
    if (x < 0) return i;
  }
  return weights.length - 1;
}

/** Probability of grey hair at creation: `min(30%, (age - 29) x 6%)`, nothing up to 29. */
export function greyChance(age: number): number {
  return Math.min(0.3, Math.max(0, (age - 29) * 0.06));
}

/** Probability of white hair at creation: `min(8%, (age - 32) x 2%)`, only from 33. */
export function whiteChance(age: number): number {
  return age >= 33 ? Math.min(0.08, 0.02 * (age - 32)) : 0;
}

/** Weights of the expression marks: none under 28, light from 28, stronger from 32. */
function marksWeights(age: number): Weights {
  return age < 28 ? [100, 0, 0] : age < 32 ? [75, 25, 0] : [45, 40, 15];
}

export interface FaceContext {
  /** Age at creation (it is not stored: the face never ages). */
  age: number;
  /** ISO 3166-1 alpha-2; weighs only the skin tone. */
  nationality: string;
}

/**
 * Draws the traits of a new player's face. Pure: the same seed, age and nationality give the
 * same spec. Each field has a stream of its own (`${seed}-face-${field}`), so a field added in
 * the future does not move the others. Only identity.ts calls this (ADR-0012): any other place
 * reads `Player.face`.
 */
export function faceSpecFromSeed(seed: number, ctx: FaceContext): FaceSpec {
  const age = Number.isFinite(ctx.age) ? ctx.age : FALLBACK_AGE;
  const band = ageBand(age);
  const base = seed >>> 0;
  const u = (field: FaceField) => new Rng(seedFromString(`${base}-face-${field}`)).next();

  const skinWeights = Object.hasOwn(SKIN_WEIGHTS, ctx.nationality)
    ? SKIN_WEIGHTS[ctx.nationality]!
    : SKIN_WEIGHTS[DEFAULT_SKIN_NATIONALITY]!;
  const skin = pick(skinWeights, u('skin'));

  const curl = skin >= 8 ? 1.5 : skin <= 3 ? 0.75 : 1;
  const styles = FACE_WEIGHTS.hairStyle[band].map((w: number, i) =>
    CURLY_STYLES.includes(i) ? w * curl : w,
  );
  const hairStyle = pick(styles, u('hairStyle'));

  const colors: number[] = [...FACE_WEIGHTS.hairColor];
  if (skin >= 7) {
    // Natural light hair does not come with dark skin: its weight goes to black.
    for (const i of NATURAL_LIGHT_HAIR) {
      colors[HAIR_COLOR.black] = colors[HAIR_COLOR.black]! + colors[i]!;
      colors[i] = 0;
    }
  }
  const pWhite = whiteChance(age);
  const pGrey = greyChance(age);
  const uc = u('hairColor');
  const hairColor =
    uc < pWhite
      ? HAIR_COLOR.white
      : uc < pWhite + pGrey
        ? HAIR_COLOR.grey
        : pick(colors, (uc - pWhite - pGrey) / (1 - pWhite - pGrey));

  return {
    skin,
    shape: pick(FACE_WEIGHTS.shape, u('shape')),
    hairStyle,
    hairColor,
    brows: pick(FACE_WEIGHTS.brows, u('brows')),
    eyes: pick(FACE_WEIGHTS.eyes, u('eyes')),
    nose: pick(FACE_WEIGHTS.nose, u('nose')),
    mouth: pick(FACE_WEIGHTS.mouth, u('mouth')),
    ears: pick(FACE_WEIGHTS.ears, u('ears')),
    facial: pick(FACE_WEIGHTS.facial[band], u('facial')),
    accessory: pick(FACE_WEIGHTS.accessory, u('accessory')),
    marks: pick(marksWeights(age), u('marks')),
  };
}
