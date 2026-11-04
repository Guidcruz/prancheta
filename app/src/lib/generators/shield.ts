import { Rng, seedFromString } from '@engine/rng';

export type ShieldShape = 'classic' | 'round' | 'diagonal';
export interface ShieldSpec {
  shape: ShieldShape;
  color1: string;
  color2: string;
  symbol: 'star' | 'ball' | 'letter';
  letter?: string;
}

const CLASSIC = 'M4 6h56v34c0 16-12 26-28 30C16 66 4 56 4 40Z';
const HEX = /^#[0-9a-f]{6}$/i;
const FALLBACK = '#777777';

const escapeText = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
const safeColor = (c: string) => (HEX.test(c) ? c : FALLBACK);
const DIAGONAL = 'M32 2 60 16v24c0 14-12 24-28 28C16 64 4 54 4 40V16Z';

/** Deterministic shield spec from a club id. Same id, same shield, forever. */
export function shieldSpecFor(clubId: string, color1: string, color2: string): ShieldSpec {
  const rng = new Rng(seedFromString(clubId));
  return {
    shape: rng.pick(['classic', 'round', 'diagonal'] as const) ?? 'classic',
    color1: safeColor(color1),
    color2: safeColor(color2),
    symbol: rng.pick(['star', 'ball', 'letter'] as const) ?? 'star',
    letter: clubId
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 3)
      .toUpperCase(),
  };
}

/** Renders a 64x72 SVG. The outline uses the `ink` token so it reads on every surface. */
export function shieldSvg(spec: ShieldSpec, size = 64): string {
  const h = Math.round(size * 1.125);
  const outline = `fill="none" stroke="var(--ink)" stroke-width="2"`;
  const c1 = safeColor(spec.color1);
  const c2 = safeColor(spec.color2);
  let body = '';
  if (spec.shape === 'classic') {
    body = `<path d="${CLASSIC}" fill="${c1}"/><path d="M12 6h8v60l-8-4Zm16 0h8v63l-8 1Zm16 0h8v52l-8 8Z" fill="${c2}"/><path d="${CLASSIC}" ${outline}/>`;
  } else if (spec.shape === 'round') {
    body = `<circle cx="32" cy="36" r="30" fill="${c2}"/><rect x="2" y="26" width="60" height="20" fill="${c1}"/><circle cx="32" cy="36" r="30" ${outline}/>`;
  } else {
    body = `<path d="${DIAGONAL}" fill="${c1}"/><path d="M4 40 60 16v24c0 14-12 24-28 28C16 64 4 54 4 40Z" fill="${c2}"/><path d="${DIAGONAL}" ${outline}/>`;
  }
  let symbol = '';
  if (spec.symbol === 'star') {
    symbol = `<polygon points="32,22 35.5,31 45,31 37.5,36.5 40.5,46 32,40 23.5,46 26.5,36.5 19,31 28.5,31" fill="var(--ink)"/>`;
  } else if (spec.symbol === 'ball') {
    symbol = `<circle cx="32" cy="38" r="8" fill="var(--ink)"/>`;
  } else {
    symbol = `<text x="32" y="43" text-anchor="middle" font-family="var(--font-display)" font-weight="700" font-size="16" fill="var(--ink)">${escapeText(spec.letter ?? '')}</text>`;
  }
  return `<svg width="${size}" height="${h}" viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}${symbol}</svg>`;
}
