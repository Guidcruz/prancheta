import type { ClubSize } from '@engine/types';
import type { CrestPattern, CrestShape, CrestSymbol } from '@engine/clubs';

/*
 * Club crest generator, style A v5 (docs/art/escudos-estilos/README.md, ADR-0014).
 * Pure and deterministic: shape, pattern, base colour and symbol are fixed data of each club
 * (`crest*` fields of app/src/data/clubs.serie-a.json); nothing here is drawn by lot. The output
 * is a self-contained SVG (no CSS variables, no filters) so it renders in the browser, in Astro
 * at build time and in librsvg (share images). At 32 px or less it switches to a simple version.
 */

export interface ShieldTitles {
  /** Série A titles: gold stars. */
  league: number;
  /** Série B titles: silver stars (future field of the club data; absent today). */
  leagueB?: number;
}

/** The part of a ClubDef the shield needs; a ClubDef fits. */
export interface ShieldClub {
  id: string;
  /** Used as the accessible name when `label` is wanted: see {@link ShieldSpec.label}. */
  shortName?: string;
  colors: readonly [string, string];
  size: ClubSize;
  titles: ShieldTitles;
  crestShape: CrestShape;
  crestPattern: CrestPattern;
  crestBase: 0 | 1;
  crestSymbol: CrestSymbol;
}

export interface ShieldSpec {
  id: string;
  /** Accessible name. Absent: the SVG is decorative (`aria-hidden`). Always escaped. */
  label?: string;
  colors: [string, string];
  size: ClubSize;
  titles: ShieldTitles;
  shape: CrestShape;
  pattern: CrestPattern;
  base: 0 | 1;
  symbol: CrestSymbol;
}

const HEX = /^#[0-9a-f]{6}$/i;
const FALLBACK = '#777777';
const INK = '#0b1118';
const NEUTRAL_DARK = '#111417';
const NEUTRAL_LIGHT = '#ffffff';
/** Width in px up to which the simple version is drawn. */
export const SMALL_SIZE = 32;

const escapeText = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
const safeColor = (c: string) => (HEX.test(c) ? c : FALLBACK);

// ------------------------------------------------------------------ colour maths

const luminance = (hex: string): number => {
  const v = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!;
};

/** WCAG contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A colour for what is drawn over `bg`: a club colour when it has 3:1, else a neutral. */
function onColor(bg: string, candidates: readonly string[]): string {
  const best = candidates
    .filter((c) => c.toLowerCase() !== bg.toLowerCase())
    .sort((x, y) => contrastRatio(y, bg) - contrastRatio(x, bg))[0];
  if (best !== undefined && contrastRatio(best, bg) >= 3) return best;
  return contrastRatio(NEUTRAL_DARK, bg) >= contrastRatio(NEUTRAL_LIGHT, bg)
    ? NEUTRAL_DARK
    : NEUTRAL_LIGHT;
}

const mix = (hex: string, to: number, t: number): string => {
  const f = (i: number) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t) + to * t)
      .toString(16)
      .padStart(2, '0');
  return `#${f(1)}${f(3)}${f(5)}`;
};

/** The colour of the medallion and of the symbol drawn on it (always >= 3:1). */
export function medallionColors(colors: readonly [string, string]): {
  fill: string;
  symbol: string;
} {
  const [c1, c2] = [safeColor(colors[0]), safeColor(colors[1])];
  const fill = luminance(c1) > luminance(c2) ? c1 : c2;
  return { fill, symbol: onColor(fill, [c1, c2]) };
}

// ------------------------------------------------------------------ shapes and patterns

// viewBox 64x72; the field starts at y=12 (stars sit above it)
const SHAPES: Record<CrestShape, string> = {
  rounded: 'M6 16q0-3 3-3h46q3 0 3 3v24c0 15-11 24-26 29C17 64 6 55 6 40Z',
  french: 'M6 13h52v22c0 16-10 27-26 35C16 62 6 51 6 35Z',
  swiss: 'M6 13h14q12 7 24 0h14v27c0 15-11 24-26 29C17 64 6 55 6 40Z',
  oval: 'M6 41a26 29 0 0 1 52 0a26 29 0 0 1-52 0Z',
  chamfer: 'M15 13h34l9 9v20l-9 14-17 14-17-14-9-14V22Z',
  disc: 'M4 41a28 28 0 0 1 56 0a28 28 0 0 1-56 0Z',
};

const BEND = (c: string) => `<path d="M-6 42 42-6H62L-6 62Z" fill="${c}"/>`;
const PATTERNS: Record<CrestPattern, (c: string) => string> = {
  none: () => '',
  hoops: (c) =>
    `<g fill="${c}"><rect x="-2" y="18" width="70" height="12"/><rect x="-2" y="42" width="70" height="12"/><rect x="-2" y="66" width="70" height="12"/></g>`,
  vstripes: (c) =>
    `<g fill="${c}">${[1, 3, 5].map((i) => `<rect x="${(i * 64) / 6}" y="0" width="${64 / 6}" height="80"/>`).join('')}</g>`,
  pales: (c) =>
    `<g fill="${c}"><rect x="12" y="0" width="5" height="80"/><rect x="47" y="0" width="5" height="80"/><rect x="27" y="0" width="10" height="80"/></g>`,
  split: (c) => `<path d="M32-4H70V80H32Z" fill="${c}"/>`,
  bend: BEND,
  bendMirror: (c) => `<g transform="translate(64 0) scale(-1 1)">${BEND(c)}</g>`,
  fess: (c) => `<rect x="-2" y="44" width="70" height="9" fill="${c}"/>`,
  chief: (c) => `<path d="M-4-4H70V26H-4Z" fill="${c}"/>`,
  chevron: (c) => `<path d="M-4 40 32 14 68 40V54L32 28-4 54Z" fill="${c}"/>`,
};
/** Patterns that survive at 32 px; the others become `split` (vstripes) or nothing. */
const COARSE: ReadonlySet<CrestPattern> = new Set([
  'bend',
  'bendMirror',
  'chevron',
  'split',
  'fess',
  'chief',
  'none',
]);

// ------------------------------------------------------------------ symbols
// Own drawings in a -11..11 box. `h` is the colour of the medallion (the "holes" of a symbol).

const S = (c: string) => `fill="${c}"`;
const ST = (c: string, w: number) =>
  `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

const SYMBOLS: Record<CrestSymbol, (c: string, h: string) => string> = {
  calcadao: (c) =>
    `<g ${ST(c, 4.2)}><path d="M-10-4q5-6 10 0t10 0"/><path d="M-10 5q5-6 10 0t10 0"/></g>`,
  arcos: (c, h) =>
    `<path d="M-11-8H11V10H-11Z" ${S(c)}/><g fill="${h}"><path d="M-9.5 10V3a2.5 2.5 0 0 1 5 0v7Z"/><path d="M-2.5 10V3a2.5 2.5 0 0 1 5 0v7Z"/><path d="M4.5 10V3a2.5 2.5 0 0 1 5 0v7Z"/><rect x="-9" y="-5" width="18" height="2"/></g>`,
  chama: (c, h) =>
    `<path d="M0-11C2-6 8-3 8 3a8 8 0 0 1-16 0c0-3 2-5 3-7 1 2 2 3 3 3 0-4-1-6 2-10Z" ${S(c)}/><path d="M0 10a3 3 0 0 1-3-3c0-2 1.5-3 3-5 1.5 2 3 3 3 5a3 3 0 0 1-3 3Z" fill="${h}"/>`,
  predios: (c, h) =>
    `<path d="M-11 10V0h5V-9h5V-4h4V-11h5V-2h5V10Z" ${S(c)}/><g fill="${h}"><rect x="-4.5" y="-6" width="2" height="2"/><rect x="-4.5" y="-2" width="2" height="2"/><rect x="2.5" y="-8" width="2" height="2"/><rect x="2.5" y="-3" width="2" height="2"/><rect x="2.5" y="2" width="2" height="2"/></g>`,
  palmeira: (c) =>
    `<g ${ST(c, 2.6)}><path d="M1-4Q-5-11-10-4M1-4Q7-11 12-4M1-4V-11M1-4Q-4-6-9 1M1-4Q6-6 11 1"/></g><path d="M-1 10 0-4H3L3 10Z" ${S(c)}/>`,
  ponte: (c) =>
    `<path d="M-1.6 10V-11h3.2V10Z" ${S(c)}/><rect x="-11" y="4" width="22" height="3.4" ${S(c)}/><path d="M0-10-10 4M0-10-6 4M0-10 10 4M0-10 6 4" ${ST(c, 1.3)}/>`,
  gema: (c, h) =>
    `<path d="M-6-9H6L11-3 0 11-11-3Z" ${S(c)}/><path d="M-11-3H11M-3-3 0 11 3-3M-6-9-3-3 0-9 3-3 6-9" ${ST(h, 1.1)}/>`,
  contineres: (c, h) =>
    `<rect x="-11" y="1" width="10.5" height="9" ${S(c)}/><rect x="0.5" y="1" width="10.5" height="9" ${S(c)}/><rect x="-5.5" y="-9" width="11" height="9" ${S(c)}/><path d="M-8.5 3V8M-5.5 3V8M3.5 3V8M6.5 3V8M-2.5-7V-2M0-7V-2M2.5-7V-2" ${ST(h, 1)}/>`,
  bondinho: (c, h) =>
    `<path d="M-11-10 11-4" ${ST(c, 1.6)}/><path d="M1-7.4V-3" ${ST(c, 1.6)}/><rect x="-6" y="-3" width="14" height="11" rx="2" ${S(c)}/><rect x="-4" y="-1" width="4" height="4" fill="${h}"/><rect x="1.5" y="-1" width="4" height="4" fill="${h}"/>`,
  chapeu: (c, h) =>
    `<ellipse cx="0" cy="3" rx="11" ry="3.6" ${S(c)}/><path d="M-6 3V-4Q-6-9 0-9T6-4V3Z" ${S(c)}/><path d="M-6 0H6" ${ST(h, 1.4)}/><path d="M-6 3Q0 11 6 3" ${ST(c, 1.3)}/>`,
  cataVento: (c, h) =>
    `<g ${S(c)}><path d="M0 0V-10L8-6Z"/><path d="M0 0H10L6 8Z"/><path d="M0 0V10L-8 6Z"/><path d="M0 0H-10L-6-8Z"/></g><circle r="2" fill="${h}"/>`,
  pampulha: (c) =>
    `<g ${ST(c, 2.8)}><path d="M-10 10Q-10-10 0-10Q10-10 10 10"/><path d="M-4 10Q-4-3 0-3Q4-3 4 10"/><path d="M-11.5 10H11.5"/></g>`,
  chamine: (c, h) =>
    `<path d="M-3.4 10-4.6-8H4.6L3.4 10Z" ${S(c)}/><rect x="-6" y="-11" width="12" height="3.4" ${S(c)}/><rect x="-11" y="6" width="22" height="4" ${S(c)}/><rect x="-2" y="-3" width="4" height="2" fill="${h}"/>`,
  araucaria: (c) =>
    `<g ${ST(c, 2)}><path d="M0 11V-9M0 3Q-3 3-8-4M0 3Q3 3 8-4M0-3Q-2-4-5-9M0-3Q2-4 5-9"/></g><g ${S(c)}><ellipse cx="-8" cy="-5" rx="3.2" ry="1.7"/><ellipse cx="8" cy="-5" rx="3.2" ry="1.7"/><ellipse cx="-5" cy="-10" rx="3" ry="1.6"/><ellipse cx="5" cy="-10" rx="3" ry="1.6"/><ellipse cx="0" cy="-10.5" rx="2.8" ry="1.5"/></g>`,
  berimbau: (c, h) =>
    `<path d="M-5-11Q9 0-5 11" ${ST(c, 2.6)}/><path d="M-5-11V11" ${ST(c, 1)}/><circle cx="-3" cy="6" r="4.8" ${S(c)}/><circle cx="-3" cy="6" r="1.6" fill="${h}"/>`,
  farol: (c, h) =>
    `<path d="M-4.4 10-2.6-3.5H2.6L4.4 10Z" ${S(c)}/><rect x="-3" y="-8" width="6" height="4.5" ${S(c)}/><path d="M-4.6-8 0-11.5 4.6-8Z" ${S(c)}/><path d="M-6-6H-11M6-6H11M-5.5-9-9-11M5.5-9 9-11" ${ST(c, 1.4)}/><rect x="-3.4" y="1" width="6.8" height="2" fill="${h}"/>`,
  sino: (c) =>
    `<path d="M-8 6Q-7-1-6-4Q-4-8 0-8T6-4Q7-1 8 6Z" ${S(c)}/><rect x="-10" y="5" width="20" height="3" rx="1.5" ${S(c)}/><circle cx="0" cy="10" r="1.8" ${S(c)}/><circle cx="0" cy="-9.5" r="1.8" ${S(c)}/>`,
  sol: (c) =>
    `<g ${S(c)}><circle r="5"/>${[0, 45, 90, 135, 180, 225, 270, 315]
      .map((a) => `<path d="M-1.4-7.5h2.8L0-11Z" transform="rotate(${a})"/>`)
      .join('')}</g>`,
  espiga: (c) =>
    `<path d="M0 11V-6" ${ST(c, 1.8)}/><g ${S(c)}>${[-8, -4, 0, 4]
      .map(
        (y) =>
          `<ellipse cx="-3.4" cy="${y}" rx="1.8" ry="3" transform="rotate(-30 -3.4 ${y})"/><ellipse cx="3.4" cy="${y}" rx="1.8" ry="3" transform="rotate(30 3.4 ${y})"/>`,
      )
      .join('')}<ellipse cx="0" cy="-10" rx="1.7" ry="3"/></g>`,
  vitoriaregia: (c, h) =>
    `<ellipse cx="0" cy="5" rx="11" ry="5" ${S(c)}/><path d="M0 5-3-1H3Z" fill="${h}"/><path d="M0-1Q-5-3-4-9Q0-7 0-1Q0-7 4-9 5-3 0-1Z" ${S(c)}/>`,
};

/** Bounding box of each symbol (measured with getBBox on the drawings above). */
const BBOX: Record<CrestSymbol, [x: number, y: number, w: number, h: number]> = {
  calcadao: [-10, -7, 20, 15],
  arcos: [-11, -8, 22, 18],
  chama: [-8, -11, 16, 22],
  predios: [-11, -11, 24, 21],
  palmeira: [-10, -11, 22, 21],
  ponte: [-11, -11, 22, 21],
  gema: [-11, -9, 22, 20],
  contineres: [-11, -9, 22, 19],
  bondinho: [-11, -10, 22, 18],
  chapeu: [-11, -9, 22, 16],
  cataVento: [-10, -10, 20, 20],
  pampulha: [-11.5, -10, 23, 20],
  chamine: [-11, -11, 22, 21],
  araucaria: [-11.2, -12, 22.4, 23],
  berimbau: [-7.8, -11, 9.8, 22],
  farol: [-11, -11.5, 22, 21.5],
  sino: [-10, -11.3, 20, 23.1],
  sol: [-11, -11, 22, 22],
  espiga: [-6.46, -13, 12.92, 24],
  vitoriaregia: [-11, -9, 22, 19],
};

/** Scale and centre so the symbol fits the medallion of radius `r` with room to spare. */
function fitSymbol(key: CrestSymbol, r: number): { s: number; cx: number; cy: number } {
  const [x, y, bw, bh] = BBOX[key];
  const w = bw + 3;
  const h = bh + 3; // room for the stroke (getBBox ignores it)
  const half = Math.hypot(w, h) / 2;
  return {
    s: Math.min((r * 0.82) / half, (r * 1.5) / Math.max(w, h)),
    cx: x + bw / 2,
    cy: y + bh / 2,
  };
}

// ------------------------------------------------------------------ stars

/**
 * Stars for `titles` league titles: one small star per title, one big star (with a ring) per 5,
 * at most 3 big + 4 small. From 20 titles on the count is capped (3 big + 4 small).
 */
export function starGlyphs(titles: number): { big: number; small: number } {
  const t = Math.max(0, Math.trunc(Number.isFinite(titles) ? titles : 0));
  if (t >= 20) return { big: 3, small: 4 };
  return { big: Math.floor(t / 5), small: t % 5 };
}

const GOLD = ['#fff0a0', '#ffc400', '#c98a00'] as const;
const SILVER = ['#ffffff', '#d3dce4', '#8a97a3'] as const;

interface StarItem {
  w: number;
  r: number;
  silver: boolean;
  ring: boolean;
}

/** The stars in drawing order: gold before silver, big before small. */
export function starItems(titles: ShieldTitles, small: boolean): StarItem[] {
  const items: StarItem[] = [];
  for (const [n, silver] of [
    [titles.league, false],
    [titles.leagueB ?? 0, true],
  ] as const) {
    const g = starGlyphs(n);
    for (let i = 0; i < g.big; i++) items.push({ w: 12, r: 5.4, silver, ring: true });
    for (let i = 0; i < g.small; i++) items.push({ w: 8.6, r: 3.7, silver, ring: false });
  }
  return small ? items.slice(0, 3) : items;
}

function starPolygon(cx: number, cy: number, r: number, fill: string, stroke: string): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.46 : r;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${p.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width=".7" stroke-linejoin="round"/>`;
}

function starRow(k: string, titles: ShieldTitles, small: boolean): string {
  const list = starItems(titles, small);
  if (!list.length) return '';
  const tw = list.reduce((s, i) => s + i.w, 0) + 5;
  let x = 32 - tw / 2 + 2.5;
  const edge = small ? '' : ' stroke="#fff" stroke-opacity=".35" stroke-width=".6"';
  let out = `<rect x="${(32 - tw / 2).toFixed(1)}" y="0.8" width="${tw.toFixed(1)}" height="11.4" rx="5.7" fill="${INK}"${edge}/>`;
  for (const it of list) {
    const cx = x + it.w / 2;
    const pal = it.silver ? SILVER : GOLD;
    if (it.ring) {
      out += `<circle cx="${cx.toFixed(1)}" cy="6.5" r="5.6" fill="none" stroke="${pal[1]}" stroke-width=".8"/>`;
    }
    out += starPolygon(
      cx,
      6.5,
      it.ring ? it.r - 0.4 : it.r,
      small ? pal[1] : `url(#${k}-${it.silver ? 'sv' : 'gd'})`,
      pal[2],
    );
    x += it.w;
  }
  return out;
}

// ------------------------------------------------------------------ spec and rendering

const METAL: Record<ClubSize, readonly [string, string, string]> = {
  big: ['#f3dd9a', '#c59a3a', '#6e4f12'],
  medium: ['#eef2f6', '#a9b6c2', '#55626e'],
  small: ['#f3c9a0', '#b9783f', '#6b3f1c'],
};

/**
 * The shield spec of a club. Everything comes from the club data; `label` (the accessible name)
 * is opt-in, because the pages that wrap the shield already name it.
 */
export function shieldSpecFor(club: ShieldClub, options: { label?: boolean } = {}): ShieldSpec {
  const spec: ShieldSpec = {
    id: club.id,
    colors: [safeColor(club.colors[0]), safeColor(club.colors[1])],
    size: club.size,
    titles: { league: club.titles.league },
    shape: club.crestShape,
    pattern: club.crestPattern,
    base: club.crestBase,
    symbol: club.crestSymbol,
  };
  if (club.titles.leagueB !== undefined) spec.titles.leagueB = club.titles.leagueB;
  if (options.label && club.shortName !== undefined) spec.label = club.shortName;
  return spec;
}

/**
 * Renders the shield as SVG (viewBox 64x72, `size` px wide). With `size <= 32` it draws the
 * simple version. Gradient and clip ids derive from the club id (plus `instance`, for the same
 * club twice on one page), so several shields can share a page.
 */
export function shieldSvg(
  spec: ShieldSpec,
  size = 64,
  options: { instance?: string } = {},
): string {
  const small = size <= SMALL_SIZE;
  const [c1, c2] = [safeColor(spec.colors[0]), safeColor(spec.colors[1])];
  const baseC = spec.base === 1 ? c2 : c1;
  const overC = spec.base === 1 ? c1 : c2;
  const shape: CrestShape = Object.hasOwn(SHAPES, spec.shape) ? spec.shape : 'rounded';
  const symbol: CrestSymbol = Object.hasOwn(SYMBOLS, spec.symbol) ? spec.symbol : 'sol';
  let pattern: CrestPattern = Object.hasOwn(PATTERNS, spec.pattern) ? spec.pattern : 'none';
  if (small && !COARSE.has(pattern)) pattern = pattern === 'vstripes' ? 'split' : 'none';

  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const k = `sh-${slug(spec.id)}${small ? '-s' : ''}${options.instance ? `-${slug(options.instance)}` : ''}`;
  const d = SHAPES[shape];
  const metal = METAL[spec.size] ?? METAL.small;
  const r = shape === 'disc' ? 14.5 : 15.5;
  const { fill, symbol: symColor } = medallionColors([c1, c2]);
  const f = fitSymbol(symbol, r);
  const med = `<g transform="translate(32 41)"><circle r="${r}" fill="${fill}" stroke="${INK}" stroke-width="1.5"/><clipPath id="${k}-c"><circle r="${r - 1.6}"/></clipPath><g clip-path="url(#${k}-c)"><g transform="scale(${f.s.toFixed(3)}) translate(${(-f.cx).toFixed(2)} ${(-f.cy).toFixed(2)})">${SYMBOLS[symbol](symColor, fill)}</g></g></g>`;
  const a11y =
    spec.label !== undefined
      ? `role="img" aria-label="${escapeText(spec.label)}"`
      : 'aria-hidden="true" focusable="false"';
  const head = `<svg viewBox="0 0 64 72" width="${size}" height="${Math.round(size * 1.125)}" xmlns="http://www.w3.org/2000/svg" ${a11y}>`;
  const stars = starRow(k, spec.titles, small);

  if (small) {
    return `${head}<defs><clipPath id="${k}"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${baseC}"/><g clip-path="url(#${k})">${PATTERNS[pattern](overC)}</g><path d="${d}" fill="none" stroke="${INK}" stroke-width="3"/><path d="${d}" fill="none" stroke="${metal[1]}" stroke-width="1.4"/>${med}${stars}</svg>`;
  }
  const grad = (id: string, x2: number, y2: number, stops: [number, string, number?][]) =>
    `<linearGradient id="${k}-${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops
      .map(
        ([o, c, op]) =>
          `<stop offset="${o}" stop-color="${c}"${op === undefined ? '' : ` stop-opacity="${op}"`}/>`,
      )
      .join('')}</linearGradient>`;
  const defs =
    `<clipPath id="${k}"><path d="${d}"/></clipPath>` +
    grad('g', 0, 1, [
      [0, mix(baseC, 255, 0.18)],
      [0.55, baseC],
      [1, mix(baseC, 0, 0.22)],
    ]) +
    grad('m', 1, 1, [
      [0, metal[0]],
      [0.5, metal[1]],
      [1, metal[2]],
    ]) +
    grad('h', 1, 1, [
      [0, '#fff', 0.42],
      [1, '#fff', 0.04],
    ]) +
    grad('gd', 0, 1, [
      [0, GOLD[0]],
      [1, GOLD[1]],
    ]) +
    grad('sv', 0, 1, [
      [0, SILVER[0]],
      [1, SILVER[1]],
    ]);
  const rim = onColor(baseC, [overC]);
  const ring =
    shape === 'disc'
      ? `<circle cx="32" cy="41" r="22.5" fill="none" stroke="${rim}" stroke-width="1.4"/>`
      : '';
  return `${head}<defs>${defs}</defs><path d="${d}" transform="translate(1.4 2.4)" fill="#000" opacity=".3"/><g clip-path="url(#${k})"><rect width="64" height="72" fill="url(#${k}-g)"/>${PATTERNS[pattern](overC)}</g><g clip-path="url(#${k})"><path d="${d}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="5"/><path d="M-2-2H66V26L-2 46Z" fill="url(#${k}-h)"/></g><path d="${d}" fill="none" stroke="${INK}" stroke-width="4.4"/><path d="${d}" fill="none" stroke="url(#${k}-m)" stroke-width="3"/><path d="${d}" fill="none" stroke="url(#${k}-m)" stroke-width=".9" transform="translate(32 41) scale(.88) translate(-32 -41)"/>${ring}${med}${stars}</svg>`;
}
