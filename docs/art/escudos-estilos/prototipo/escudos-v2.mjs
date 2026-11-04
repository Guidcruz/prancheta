// Estilo A v2: Brasao com variedade de formato, brilho e versao pequena simplificada.
import { stream, pick, esc, onColor, medallion, PATTERNS, SYMBOL_KEYS, INK } from './escudos.mjs';

const mix = (hex, to, t) => {
  const f = (i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t) + to * t).toString(16).padStart(2, '0');
  return '#' + f(1) + f(3) + f(5);
};
const lighten = (h, t) => mix(h, 255, t), darken = (h, t) => mix(h, 0, t);

// 6 formatos (viewBox 64x72, campo a partir de y=12; estrelas ficam em y~6)
export const SHAPES = {
  rounded: 'M6 16q0-3 3-3h46q3 0 3 3v24c0 15-11 24-26 29C17 64 6 55 6 40Z', // classico arredondado
  french: 'M6 13h52v22c0 16-10 27-26 35C16 62 6 51 6 35Z', // frances com ponta
  swiss: 'M6 13h14q12 7 24 0h14v27c0 15-11 24-26 29C17 64 6 55 6 40Z', // suico, recorte no topo
  oval: 'M6 41a26 29 0 0 1 52 0a26 29 0 0 1-52 0Z', // oval
  chamfer: 'M15 13h34l9 9v20l-9 14-17 14-17-14-9-14V22Z', // cantos chanfrados
  disc: 'M4 41a28 28 0 0 1 56 0a28 28 0 0 1-56 0Z', // bolacha (com anel interno)
};
export const SHAPE_KEYS = Object.keys(SHAPES);

// Formato por clube: parte do hash do id; clubes da mesma cidade ou rivais diretos nao repetem formato.
// Determinístico: percorre os clubes em ordem de id. Depende da lista; sem lista, usa so o hash.
export function assignShapes(clubs) {
  const out = {};
  const hashPick = (id) => Math.floor(stream(id, 'shape')() * SHAPE_KEYS.length);
  for (const c of [...clubs].sort((a, b) => a.id.localeCompare(b.id))) {
    const near = clubs.filter((o) => o.id !== c.id && out[o.id] !== undefined &&
      (o.city === c.city || c.rivals.includes(o.id) || o.rivals.includes(c.id)));
    const used = new Set(near.map((o) => out[o.id]));
    let i = hashPick(c.id);
    for (let k = 0; k < SHAPE_KEYS.length && used.has(SHAPE_KEYS[i]); k++) i = (i + 1) % SHAPE_KEYS.length;
    out[c.id] = SHAPE_KEYS[i];
  }
  return out;
}

// Regra explicita das estrelas de titulos de liga (proposta)
export function starsFor(t) { return t <= 0 ? 0 : t <= 2 ? 1 : t <= 4 ? 2 : t <= 6 ? 3 : t <= 9 ? 4 : 5; }

const METAL = { big: ['#fff2b0', '#e0b030', '#8a6410'], medium: ['#ffffff', '#c3ccd4', '#6c7882'], small: ['#f3c9a0', '#b9783f', '#6b3f1c'] };
const COARSE = new Set(['bend', 'chevron', 'split', 'fess', 'chief']);

function star(cx, cy, r, fill) {
  const p = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; p.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1)); }
  return `<polygon points="${p.join(' ')}" fill="${fill}"/>`;
}

let uid = 0;
export function brasaoV2(club, shape, size = 64) {
  const small = size <= 32;
  const r = stream(club.id, 'A2');
  const [c1, c2] = club.colors;
  let pat = pick(r, Object.keys(PATTERNS)), sym = pick(r, SYMBOL_KEYS);
  if (small && !COARSE.has(pat)) pat = null; // pequeno: sem padrao fino
  const d = SHAPES[shape], k = 'v' + uid++;
  const m = METAL[club.size] ?? METAL.small;
  const n = starsFor(club.titles.league);
  const rim = onColor(c1, [c2]);
  let defs, body;
  if (small) {
    // so formato + cor + simbolo (+ padrao grosso), contorno simples, estrelas planas
    body = `<path d="${d}" fill="${c1}"/>${pat ? `<g clip-path="url(#${k})">${PATTERNS[pat](c2)}</g>` : ''}<path d="${d}" fill="none" stroke="${INK}" stroke-width="3"/><path d="${d}" fill="none" stroke="${m[1]}" stroke-width="1.4"/>`;
    defs = `<clipPath id="${k}"><path d="${d}"/></clipPath>`;
    const st = n ? Array.from({ length: Math.min(n, 3) }, (_, i) => star(32 + (i - (Math.min(n, 3) - 1) / 2) * 11, 6.5, 5.4, m[1])).join('') : '';
    return `<svg viewBox="0 0 64 72" width="${size}" height="${Math.round(size * 1.125)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(club.shortName)}"><defs>${defs}</defs>${body}${medallion(32, 41, shape === 'disc' ? 15 : 14, club.colors, sym, 1.05)}${st}</svg>`;
  }
  defs = `<clipPath id="${k}"><path d="${d}"/></clipPath>
<linearGradient id="${k}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten(c1, 0.18)}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="${darken(c1, 0.22)}"/></linearGradient>
<linearGradient id="${k}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m[0]}"/><stop offset=".5" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[2]}"/></linearGradient>
<linearGradient id="${k}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/></linearGradient>
<linearGradient id="${k}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m[0]}"/><stop offset="1" stop-color="${m[1]}"/></linearGradient>`;
  const shine = `<g clip-path="url(#${k})"><path d="M-2 -2H66V26L-2 46Z" fill="url(#${k}h)"/></g>`;
  const inner = `<g clip-path="url(#${k})"><path d="${d}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="5"/></g>`;
  const ring = shape === 'disc' ? `<circle cx="32" cy="41" r="21.5" fill="none" stroke="${rim}" stroke-width="1.6"/><circle cx="32" cy="41" r="23.5" fill="none" stroke="${INK}" stroke-opacity=".5" stroke-width=".8"/>` : '';
  const st = n ? Array.from({ length: n }, (_, i) => { const x = 32 + (i - (n - 1) / 2) * 9.6; return `<circle cx="${x.toFixed(1)}" cy="6.5" r="4.6" fill="${m[0]}" opacity=".3"/>` + star(x, 6.5, 4.4, `url(#${k}s)`); }).join('') : '';
  body = `<path d="${d}" transform="translate(1.4 2.4)" fill="#000" opacity=".3"/>
<g clip-path="url(#${k})"><rect width="64" height="72" fill="url(#${k}g)"/>${PATTERNS[pat](c2)}</g>
<g clip-path="url(#${k})" opacity=".0"></g>${inner}${shine}
<path d="${d}" fill="none" stroke="${INK}" stroke-width="4.4"/>
<path d="${d}" fill="none" stroke="url(#${k}m)" stroke-width="3"/>
<path d="${d}" fill="none" stroke="${m[2]}" stroke-width=".5" stroke-opacity=".7" transform="translate(32 41) scale(.9) translate(-32 -41)"/>
<path d="${d}" fill="none" stroke="url(#${k}m)" stroke-width=".9" transform="translate(32 41) scale(.86) translate(-32 -41)"/>${ring}`;
  return `<svg viewBox="0 0 64 72" width="${size}" height="${Math.round(size * 1.125)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(club.shortName)}"><defs>${defs}</defs>${body}${medallion(32, 41, shape === 'disc' ? 13 : 13.5, club.colors, sym)}${st}</svg>`;
}
