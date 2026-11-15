import type { CrestPattern } from '@engine';
import { Rng, seedFromString } from '../../engine/index.ts';
import {
  INK,
  NEUTRAL_DARK,
  NEUTRAL_LIGHT,
  SMALL_SIZE,
  contrastRatio,
  escapeText,
  onColor,
  safeColor,
} from './shield.ts';

/*
 * Club kit generator (docs/art/uniformes.md, T-026, US-002).
 * Pure and deterministic: the pattern and the collar come from `seedFromString` over fixed labels
 * built from the club id (never from list order, date or `Math.random`); the colours are the
 * club colours. The SVG is self-contained (no CSS variable, filter, text, link or script) and
 * has no number or brand: the interface draws those on top. `matchKits` is the data part that
 * the animated match (T-032) consumes.
 */

export const KIT_PATTERNS = [
  'plain',
  'hoops',
  'vstripes',
  'halves',
  'band',
  'sash',
  'sashMirror',
  'chevron',
  'yoke',
  'sleeves',
] as const;
export type KitPattern = (typeof KIT_PATTERNS)[number];
export const KIT_COLLARS = ['round', 'v', 'polo'] as const;
export type KitCollar = (typeof KIT_COLLARS)[number];
export type KitSlot = 'home' | 'away' | 'third' | 'gk';

/** The part of a ClubDef the kit needs; a ClubDef fits. */
export interface KitClub {
  id: string;
  colors: readonly [string, string];
  crestPattern: CrestPattern;
}

/** A full kit: what the card SVG draws. */
export interface Kit {
  /** Club the kit belongs to (only to derive unique SVG ids). */
  clubId: string;
  slot: KitSlot;
  base: string; // #rrggbb
  secondary: string;
  pattern: KitPattern;
  collar: KitCollar;
  shorts: string;
  socks: string;
}

/** What the animated match needs per outfield player or goalkeeper. */
export interface FieldKit {
  slot: KitSlot;
  fill: string; // dominant colour of the dot
  stripe: string | null; // second colour for double-mass patterns, else null
  ring: string; // 2 px outline, >= 3:1 against the pitch
  numberColor: string; // >= 4.5:1 against fill (and stripe, if any)
  numberPlate: string | null; // null unless no colour reaches 4.5:1 on both
}

export interface MatchKits {
  home: FieldKit;
  away: FieldKit;
  homeGk: FieldKit;
  awayGk: FieldKit;
  awaySlot: 'home' | 'away' | 'third'; // uniform 1, 2 or 3 of the visitor
  /** The same four kits in full, for the card SVG. */
  kits: { home: Kit; away: Kit; homeGk: Kit; awayGk: Kit };
}

export const KIT_MIN_DISTANCE = 30;
export const KIT_NUMBER_CONTRAST = 4.5;
export const KIT_RING_CONTRAST = 3;

const YELLOW = '#ffd400';
/** Night grass, the default pitch. */
export const KIT_PITCH_NIGHT = '#2fb866';
/** Goalkeeper palette: no green, all with delta E >= 58 against both pitches. */
export const KIT_GK_PALETTE = [
  '#F2D100',
  '#F26B1D',
  '#D81B7A',
  '#6E45C9',
  '#18A9D6',
  '#B7C0C8',
] as const;

// ------------------------------------------------------------------ colour distance

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const labF = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);

function lab(hex: string): [number, number, number] {
  const c = safeColor(hex);
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(c.slice(i, i + 2), 16) / 255)) as [
    number,
    number,
    number,
  ];
  const x = labF((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = labF(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = labF((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** Delta E76 in CIE Lab (D65) between two `#rrggbb` colours; invalid input becomes grey. */
export function colorDistance(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

// ------------------------------------------------------------------ patterns

/**
 * Which kit patterns each crest pattern forbids on the kit of the same club (the crest pattern
 * evokes the real club, ADR-0014; the kit never repeats its kind). A new crest pattern needs an
 * entry here (a test enforces it).
 */
export const KIT_PATTERN_OF_CREST: Record<CrestPattern, readonly KitPattern[]> = {
  none: ['plain'],
  hoops: ['hoops'],
  vstripes: ['vstripes'],
  pales: ['vstripes'],
  split: ['halves'],
  bend: ['sash', 'sashMirror'],
  bendMirror: ['sash', 'sashMirror'],
  fess: ['band'],
  chief: ['yoke'],
  chevron: ['chevron'],
};

/** Draw weights (sum 100); changing one changes the kit of existing clubs. */
export const KIT_WEIGHTS: Record<KitPattern, number> = {
  plain: 24,
  hoops: 14,
  vstripes: 14,
  halves: 8,
  band: 10,
  sash: 4,
  sashMirror: 4,
  chevron: 6,
  yoke: 8,
  sleeves: 8,
};

/** Patterns whose two colours cover a similar area (the rest is dominated by `base`). */
const DUAL: ReadonlySet<KitPattern> = new Set(['hoops', 'vstripes', 'halves']);
const SASHES: readonly KitPattern[] = ['sash', 'sashMirror'];

const unit = (label: string) => new Rng(seedFromString(label)).next();

/** Weighted pick; excluded patterns have weight 0 and the rest is renormalised. */
function pickPattern(u: number, excluded: ReadonlySet<KitPattern>): KitPattern {
  const left = KIT_PATTERNS.filter((p) => !excluded.has(p));
  const total = left.reduce((s, p) => s + KIT_WEIGHTS[p], 0);
  let acc = 0;
  for (const p of left) {
    acc += KIT_WEIGHTS[p] / total;
    if (u < acc) return p;
  }
  return left[left.length - 1] ?? 'plain';
}

// ------------------------------------------------------------------ colour choices

/** Plain shorts: the most contrasting colour that is also >= 30 apart in Lab, else the base. */
function shortsFor(base: string, secondary: string): string {
  const ok = [base, secondary, NEUTRAL_DARK, NEUTRAL_LIGHT].filter(
    (c) => colorDistance(base, c) >= KIT_MIN_DISTANCE,
  );
  let best = base;
  let bestRatio = -1;
  for (const c of ok) {
    const r = contrastRatio(c, base);
    if (r > bestRatio) {
      best = c;
      bestRatio = r;
    }
  }
  return best;
}

const massOf = (k: Kit): string[] => (DUAL.has(k.pattern) ? [k.base, k.secondary] : [k.base]);

const makeKit = (
  clubId: string,
  slot: KitSlot,
  base: string,
  secondary: string,
  pattern: KitPattern,
  collar: KitCollar,
): Kit => {
  const shorts = shortsFor(base, secondary);
  return { clubId, slot, base, secondary, pattern, collar, shorts, socks: shorts };
};

/** Uniforms 1 (home) and 2 (away) of a club. Depends only on `id`, `colors` and `crestPattern`. */
export function kitsFor(club: KitClub): { home: Kit; away: Kit } {
  const id = String(club.id);
  const c0 = safeColor(club.colors?.[0] as string);
  const c1 = safeColor(club.colors?.[1] as string);
  const banned = new Set<KitPattern>(
    Object.hasOwn(KIT_PATTERN_OF_CREST, club.crestPattern)
      ? KIT_PATTERN_OF_CREST[club.crestPattern]
      : [],
  );
  const p1 = pickPattern(unit(`${id}-kit1-pattern`), banned);
  const banned2 = new Set<KitPattern>(banned);
  banned2.add(p1);
  if (SASHES.includes(p1)) for (const s of SASHES) banned2.add(s);
  const p2 = pickPattern(unit(`${id}-kit2-pattern`), banned2);
  const collar = KIT_COLLARS[Math.floor(unit(`${id}-kit-collar`) * KIT_COLLARS.length)] ?? 'round';
  return {
    home: makeKit(id, 'home', c0, c1, p1, collar),
    away: makeKit(id, 'away', c1, c0, p2, collar),
  };
}

/** True when two kits would be confused on the pitch (section 2.2 of the design). */
export function kitConflict(a: Kit, b: Kit): boolean {
  if (colorDistance(a.base, b.base) < KIT_MIN_DISTANCE) return true;
  if (!DUAL.has(a.pattern) && !DUAL.has(b.pattern)) return false;
  const [ma, mb] = [massOf(a), massOf(b)];
  const near = (c: string, list: string[]) =>
    list.some((x) => colorDistance(c, x) < KIT_MIN_DISTANCE);
  // The kit with more colours in play must be covered by the other one: a striped shirt is not
  // confused with a plain one that matches only one of its stripes.
  const aCovered = ma.every((c) => near(c, mb));
  const bCovered = mb.every((c) => near(c, ma));
  if (ma.length > mb.length) return aCovered;
  if (mb.length > ma.length) return bCovered;
  return aCovered || bCovered;
}

/** Uniform 3: the colours (white, black, yellow) farthest from the home kit; always plain. */
export function thirdKit(home: Kit, clubId: string = home.clubId): Kit {
  const pool = [NEUTRAL_LIGHT, NEUTRAL_DARK, YELLOW];
  const mass = massOf(home);
  const gap = (c: string, from: string[]) => Math.min(...from.map((x) => colorDistance(c, x)));
  let base = pool[0]!;
  for (const c of pool) if (gap(c, mass) > gap(base, mass)) base = c;
  const rest = pool.filter((c) => c !== base);
  let secondary = rest[0]!;
  for (const c of rest) if (colorDistance(c, base) > colorDistance(secondary, base)) secondary = c;
  return makeKit(String(clubId), 'third', base, secondary, 'plain', 'round');
}

/** The goalkeeper's kit: first palette colour from the club's own start that is free. */
export function goalkeeperKit(
  club: KitClub,
  avoid: readonly string[],
  pitch: string = KIT_PITCH_NIGHT,
): Kit {
  const id = String(club.id);
  const pit = safeColor(pitch, KIT_PITCH_NIGHT);
  const start = seedFromString(`${id}-kit-gk`) % KIT_GK_PALETTE.length;
  const others = [...avoid.map((c) => safeColor(c)), pit];
  const gap = (c: string) => Math.min(...others.map((x) => colorDistance(c, x)));
  let chosen: string | undefined;
  let best = KIT_GK_PALETTE[start]!;
  for (let i = 0; i < KIT_GK_PALETTE.length; i++) {
    const c = KIT_GK_PALETTE[(start + i) % KIT_GK_PALETTE.length]!;
    if (gap(c) >= KIT_MIN_DISTANCE) {
      chosen = c;
      break;
    }
    if (gap(c) > gap(best)) best = c;
  }
  const base = chosen ?? best;
  return makeKit(id, 'gk', base, onColor(base, [base]), 'plain', 'round');
}

// ------------------------------------------------------------------ field data

/** Number colour and plate for a dot of one or two colours. */
function numberFor(fill: string, stripe: string | null, secondary: string) {
  const masses = stripe === null ? [fill] : [fill, stripe];
  const score = (c: string) => Math.min(...masses.map((m) => contrastRatio(c, m)));
  let best = NEUTRAL_LIGHT;
  for (const c of [secondary, NEUTRAL_LIGHT, NEUTRAL_DARK]) {
    if (score(c) > score(best)) best = c;
  }
  if (score(best) >= KIT_NUMBER_CONTRAST) return { numberColor: best, numberPlate: null };
  // No colour reaches 4.5:1 on every mass: a plain plate behind a number of the opposite neutral.
  const plate = score(NEUTRAL_LIGHT) >= score(NEUTRAL_DARK) ? NEUTRAL_LIGHT : NEUTRAL_DARK;
  return {
    numberColor: plate === NEUTRAL_LIGHT ? NEUTRAL_DARK : NEUTRAL_LIGHT,
    numberPlate: plate,
  };
}

/** What the animated match draws for one kit (a dot with ring and number). */
export function fieldKit(kit: Kit, pitch: string = KIT_PITCH_NIGHT): FieldKit {
  const pit = safeColor(pitch, KIT_PITCH_NIGHT);
  const fill = safeColor(kit.base);
  const secondary = safeColor(kit.secondary);
  const stripe = DUAL.has(kit.pattern) ? secondary : null;
  const ring = contrastRatio(INK, pit) >= KIT_RING_CONTRAST ? INK : NEUTRAL_LIGHT;
  return { slot: kit.slot, fill, stripe, ring, ...numberFor(fill, stripe, secondary) };
}

/**
 * Who wears what in a match. The home side always wears uniform 1; the visitor wears 1, then 2,
 * then 3 (against the home kit) until nothing conflicts. A function of the two clubs only.
 */
export function matchKits(
  home: KitClub,
  away: KitClub,
  options: { pitch?: string } = {},
): MatchKits {
  const pitch = safeColor(options.pitch ?? KIT_PITCH_NIGHT, KIT_PITCH_NIGHT);
  const h = kitsFor(home).home;
  const { home: a1, away: a2 } = kitsFor(away);
  let awayKit = a1;
  let awaySlot: MatchKits['awaySlot'] = 'home';
  if (kitConflict(h, awayKit)) {
    awayKit = a2;
    awaySlot = 'away';
    if (kitConflict(h, awayKit)) {
      awayKit = thirdKit(h, String(away.id));
      awaySlot = 'third';
    }
  }
  const line = [...massOf(h), ...massOf(awayKit)];
  const homeGk = goalkeeperKit(home, line, pitch);
  const awayGk = goalkeeperKit(away, [...line, homeGk.base], pitch);
  return {
    home: fieldKit(h, pitch),
    away: fieldKit(awayKit, pitch),
    homeGk: fieldKit(homeGk, pitch),
    awayGk: fieldKit(awayGk, pitch),
    awaySlot,
    kits: { home: h, away: awayKit, homeGk, awayGk },
  };
}

// ------------------------------------------------------------------ SVG

// viewBox 64x72: shirt on top (y 3..40), shorts (42..58), socks (60..71)
const SHIRT = 'M23 3 8 8 1 22l9 5 4-4V40H50V23l4 4 9-5L56 8 41 3Q32 13 23 3Z';
const SHORTS = 'M14 42H50L52 58H34L32 52 30 58H12Z';

const rect = (x: number, y: number, w: number, h: number, c: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;

function patternSvg(p: KitPattern, c: string, small: boolean): string {
  switch (p) {
    case 'plain':
      return '';
    case 'hoops':
      return small
        ? rect(-2, 15, 68, 12, c)
        : rect(-2, 10.4, 68, 7.4, c) + rect(-2, 25.2, 68, 7.4, c);
    case 'vstripes':
      return small
        ? rect(21.3, -2, 21.4, 46, c)
        : rect(-2, -2, 14.8, 46, c) + rect(25.6, -2, 12.8, 46, c) + rect(51.2, -2, 14.8, 46, c);
    case 'halves':
      return rect(32, -2, 34, 46, c);
    case 'band':
      return rect(-2, 17, 68, small ? 12 : 10, c);
    case 'sash':
      return `<path d="M6-2H24L60 44H42Z" fill="${c}"/>`;
    case 'sashMirror':
      return `<path d="M58-2H40L4 44H22Z" fill="${c}"/>`;
    case 'chevron':
      return `<path d="M-2 11 32 27 66 11V23L32 39-2 23Z" fill="${c}"/>`;
    case 'yoke':
      return rect(-2, -2, 68, 17, c);
    case 'sleeves':
      return rect(-2, -2, 16, 32, c) + rect(50, -2, 16, 32, c);
  }
}

function collarSvg(collar: KitCollar, c: string): string {
  const s = `fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round"`;
  if (collar === 'v') return `<path d="M23 3 32 13 41 3" ${s}/>`;
  if (collar === 'polo') {
    return `<path d="M23 3Q32 13 41 3" ${s}/><path d="M32 9V17" fill="none" stroke="${c}" stroke-width="2"/>`;
  }
  return `<path d="M23 3Q32 13 41 3" ${s}/>`;
}

/**
 * Renders the kit as SVG (viewBox 64x72, `size` px wide, 16..512, else 64). With `size <= 32` it
 * draws the simple version (no collar, cuffs or sock stripe; wider stripes). Clip ids derive from
 * the club id, the slot and `instance`, so several kits can share a page.
 */
export function kitSvg(
  kit: Kit,
  size = 64,
  options: { label?: string; instance?: string } = {},
): string {
  const px = Number.isFinite(size) && size >= 16 && size <= 512 ? size : 64;
  const small = px <= SMALL_SIZE;
  const base = safeColor(kit.base);
  const secondary = safeColor(kit.secondary);
  const shorts = safeColor(kit.shorts, base);
  const socks = safeColor(kit.socks, base);
  const pattern: KitPattern = Object.hasOwn(KIT_WEIGHTS, kit.pattern) ? kit.pattern : 'plain';
  const collar: KitCollar = (KIT_COLLARS as readonly string[]).includes(kit.collar)
    ? kit.collar
    : 'round';
  const trim = onColor(base, [secondary]);
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const slot = slug(String(kit.slot));
  const k = `kt-${slug(String(kit.clubId))}-${slot}${small ? '-s' : ''}${options.instance ? `-${slug(options.instance)}` : ''}`;
  const a11y =
    options.label !== undefined
      ? `role="img" aria-label="${escapeText(options.label)}"`
      : 'aria-hidden="true" focusable="false"';
  const head = `<svg viewBox="0 0 64 72" width="${px}" height="${Math.round(px * 1.125)}" xmlns="http://www.w3.org/2000/svg" ${a11y}>`;
  const sw = small ? 2.6 : 2;
  const legs =
    `<path d="${SHORTS}" fill="${shorts}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>` +
    [16, 36]
      .map(
        (x) =>
          `<rect x="${x}" y="60" width="12" height="11" fill="${socks}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`,
      )
      .join('') +
    (small ? '' : [16, 36].map((x) => rect(x, 63, 12, 1, trim)).join(''));
  const detail = small
    ? ''
    : collarSvg(collar, trim) +
      `<path d="M2 23l8 4M54 27l8-4M15 38.6H49" fill="none" stroke="${trim}" stroke-width="1.6"/>`;
  return `${head}<defs><clipPath id="${k}"><path d="${SHIRT}"/></clipPath></defs>${legs}<g clip-path="url(#${k})">${rect(-2, -2, 68, 46, base)}${patternSvg(pattern, secondary, small)}</g>${detail}<path d="${SHIRT}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
}
