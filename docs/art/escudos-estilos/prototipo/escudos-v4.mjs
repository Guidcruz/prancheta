// Estilo A v4: formato, padrao e simbolo fixos por clube; simbolos medidos e centrados no medalhao.
import { esc, onColor, PATTERNS as BASE_PATTERNS, INK } from './escudos.mjs';
import { SHAPES } from './escudos-v2.mjs';
import { CITY as CITY3, starGlyphs } from './escudos-v3.mjs';
import { readFileSync, existsSync } from 'node:fs';

export { starGlyphs };

const S = (c) => `fill="${c}"`;
const ST = (c, w) =>
  `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
// simbolos novos / redesenhados (caixa -11..11)
export const CITY = {
  ...CITY3,
  gema: (c) =>
    `<path d="M-6-9H6L11-3 0 11-11-3Z" ${S(c)}/><path d="M-11-3H11M-3-3 0 11 3-3M-6-9-3-3 0-9 3-3 6-9" ${ST('var(--hole)', 1.1)}/>`,
  contineres: (c) =>
    `<rect x="-11" y="1" width="10.5" height="9" ${S(c)}/><rect x="0.5" y="1" width="10.5" height="9" ${S(c)}/><rect x="-5.5" y="-9" width="11" height="9" ${S(c)}/><path d="M-8.5 3V8M-5.5 3V8M3.5 3V8M6.5 3V8M-2.5-7V-2M0-7V-2M2.5-7V-2" ${ST('var(--hole)', 1)}/>`,
  bondinho: (c) =>
    `<path d="M-11-10 11-4" ${ST(c, 1.6)}/><path d="M1-7.4V-3" ${ST(c, 1.6)}/><rect x="-6" y="-3" width="14" height="11" rx="2" ${S(c)}/><rect x="-4" y="-1" width="4" height="4" fill="var(--hole)"/><rect x="1.5" y="-1" width="4" height="4" fill="var(--hole)"/>`,
  chapeu: (c) =>
    `<ellipse cx="0" cy="3" rx="11" ry="3.6" ${S(c)}/><path d="M-6 3V-4Q-6-9 0-9T6-4V3Z" ${S(c)}/><path d="M-6 0H6" ${ST('var(--hole)', 1.4)}/><path d="M-6 3Q0 11 6 3" ${ST(c, 1.3)}/>`,
  cataVento: (c) =>
    `<g ${S(c)}><path d="M0 0V-10L8-6Z"/><path d="M0 0H10L6 8Z"/><path d="M0 0V10L-8 6Z"/><path d="M0 0H-10L-6-8Z"/></g><circle r="2" fill="var(--hole)"/>`,
};

// padroes extras (caixa 0..64 x 0..72)
const PATTERNS = {
  ...BASE_PATTERNS,
  none: () => '',
  hoops: (c) =>
    `<g fill="${c}"><rect x="-2" y="18" width="70" height="12"/><rect x="-2" y="42" width="70" height="12"/><rect x="-2" y="66" width="70" height="12"/></g>`,
  vstripes: (c) =>
    `<g fill="${c}">${[1, 3, 5].map((i) => `<rect x="${(i * 64) / 6}" y="0" width="${64 / 6}" height="80"/>`).join('')}</g>`,
  bendMirror: (c) => `<g transform="translate(64 0) scale(-1 1)">${BASE_PATTERNS.bend(c)}</g>`,
};

// Formato, padrao e simbolo fixos por clube (propostos como crestShape / crestPattern / crestSymbol).
// base = indice da cor do fundo (0 ou 1); o padrao usa a outra cor.
export const CLUB_CREST = {
  flamingo: { shape: 'rounded', pattern: 'hoops', base: 0, symbol: 'calcadao' },
  corinto: { shape: 'swiss', pattern: 'chief', base: 0, symbol: 'predios' },
  palmeral: { shape: 'rounded', pattern: 'chief', base: 0, symbol: 'palmeira' },
  'sao-paulao': { shape: 'french', pattern: 'fess', base: 0, symbol: 'ponte' },
  'atletico-minerio': { shape: 'disc', pattern: 'vstripes', base: 0, symbol: 'gema' },
  gremeos: { shape: 'oval', pattern: 'vstripes', base: 0, symbol: 'chapeu' },
  fluminario: { shape: 'french', pattern: 'pales', base: 0, symbol: 'arcos' },
  botafogueira: { shape: 'oval', pattern: 'split', base: 0, symbol: 'chama' },
  vasconcelos: { shape: 'chamfer', pattern: 'bendMirror', base: 0, symbol: 'bondinho' },
  santoes: { shape: 'disc', pattern: 'fess', base: 0, symbol: 'contineres' },
  cruzador: { shape: 'oval', pattern: 'none', base: 0, symbol: 'pampulha' },
  'inter-regional': { shape: 'rounded', pattern: 'chevron', base: 0, symbol: 'chamine' },
  tufao: { shape: 'chamfer', pattern: 'split', base: 0, symbol: 'cataVento' },
  baiao: { shape: 'rounded', pattern: 'fess', base: 0, symbol: 'berimbau' },
  coritibom: { shape: 'swiss', pattern: 'vstripes', base: 0, symbol: 'araucaria' },
  vitorioso: { shape: 'french', pattern: 'chief', base: 0, symbol: 'farol' },
  bragantao: { shape: 'disc', pattern: 'chevron', base: 0, symbol: 'sino' },
  miragol: { shape: 'chamfer', pattern: 'bend', base: 0, symbol: 'sol' },
  chapecao: { shape: 'french', pattern: 'chevron', base: 0, symbol: 'espiga' },
  remador: { shape: 'oval', pattern: 'chief', base: 0, symbol: 'vitoriaregia' },
};

// caixa de cada simbolo (medida com getBBox no navegador; ver gerar-v4.cjs); fallback 22x22
export let BBOX = existsSync(new URL('./bbox.json', import.meta.url))
  ? JSON.parse(readFileSync(new URL('./bbox.json', import.meta.url), 'utf8'))
  : {};

// estrelas
const GOLD = ['#fff0a0', '#ffc400', '#c98a00'];
const SILVER = ['#ffffff', '#d3dce4', '#8a97a3'];
function star(cx, cy, r, fill, stroke) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      rr = i % 2 ? r * 0.46 : r;
    p.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1));
  }
  return `<polygon points="${p.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width=".7" stroke-linejoin="round"/>`;
}
function starRow(k, titles, small) {
  const items = [];
  for (const [n, pal] of [
    [titles.league ?? 0, 0],
    [titles.leagueB ?? 0, 1],
  ]) {
    const g = starGlyphs(n);
    for (let i = 0; i < g.big; i++) items.push({ w: 12, r: 5.4, pal, ring: true });
    for (let i = 0; i < g.small; i++) items.push({ w: 8.6, r: 3.7, pal });
  }
  const list = small ? items.slice(0, 3) : items;
  if (!list.length) return '';
  const tw = list.reduce((s, i) => s + i.w, 0) + 5;
  let x = 32 - tw / 2 + 2.5;
  let out = `<rect x="${(32 - tw / 2).toFixed(1)}" y="0.8" width="${tw.toFixed(1)}" height="11.4" rx="5.7" fill="${INK}"${small ? '' : ' stroke="#fff" stroke-opacity=".35" stroke-width=".6"'}/>`;
  for (const it of list) {
    const cx = x + it.w / 2,
      pal = it.pal ? SILVER : GOLD;
    if (it.ring)
      out += `<circle cx="${cx.toFixed(1)}" cy="6.5" r="5.6" fill="none" stroke="${pal[1]}" stroke-width=".8"/>`;
    out += star(
      cx,
      6.5,
      it.ring ? it.r - 0.4 : it.r,
      small ? pal[1] : `url(#${k}${it.pal ? 'sv' : 'gd'})`,
      pal[2],
    );
    x += it.w;
  }
  return out;
}

const mix = (hex, to, t) => {
  const f = (i) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t) + to * t)
      .toString(16)
      .padStart(2, '0');
  return '#' + f(1) + f(3) + f(5);
};
const METAL = {
  big: ['#f3dd9a', '#c59a3a', '#6e4f12'],
  medium: ['#eef2f6', '#a9b6c2', '#55626e'],
  small: ['#f3c9a0', '#b9783f', '#6b3f1c'],
};
const COARSE = new Set(['bend', 'bendMirror', 'chevron', 'split', 'fess', 'chief', 'none']);
const lumOf = (h) => {
  const v = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};

// escala e centro do simbolo: cabe com folga no medalhao, tamanho otico parecido entre simbolos
export function fitSymbol(key, R) {
  const b = BBOX[key] ?? { x: -11, y: -11, w: 22, h: 22 };
  const w = b.w + 3,
    h = b.h + 3; // folga para o traco (getBBox ignora a espessura)
  const cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  const half = Math.hypot(w, h) / 2; // raio que contem a caixa
  const s = Math.min((R * 0.82) / half, (R * 1.5) / Math.max(w, h)); // folga de 20% no raio
  return { s, cx, cy };
}

let uid = 0;
export function brasaoV4(club, size = 64) {
  const small = size <= 32;
  const spec = CLUB_CREST[club.id] ?? {
    shape: 'rounded',
    pattern: 'split',
    base: 0,
    symbol: 'sol',
  };
  const baseC = club.colors[spec.base],
    overC = club.colors[1 - spec.base];
  let pat = spec.pattern;
  if (small && !COARSE.has(pat)) pat = pat === 'vstripes' ? 'split' : 'none';
  const d = SHAPES[spec.shape],
    k = 'x' + uid++;
  const m = METAL[club.size] ?? METAL.small;
  const R = spec.shape === 'disc' ? 14.5 : 15.5; // medalhao menor: deixa o padrao do clube aparecer
  const fill = lumOf(club.colors[0]) > lumOf(club.colors[1]) ? club.colors[0] : club.colors[1];
  const symC = onColor(fill, club.colors);
  const f = fitSymbol(spec.symbol, R);
  const med = `<g transform="translate(32 41)"><circle r="${R}" fill="${fill}" stroke="${INK}" stroke-width="1.5"/><clipPath id="${k}c"><circle r="${R - 1.6}"/></clipPath><g clip-path="url(#${k}c)"><g transform="scale(${f.s.toFixed(3)}) translate(${(-f.cx).toFixed(2)} ${(-f.cy).toFixed(2)})" style="--hole:${fill}">${CITY[spec.symbol](symC)}</g></g></g>`;
  const head = `<svg viewBox="0 0 64 72" width="${size}" height="${Math.round(size * 1.125)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(club.shortName)}">`;
  const stars = starRow(k, club.titles, small);
  const rim = onColor(baseC, [overC]);
  if (small) {
    return `${head}<defs><clipPath id="${k}"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${baseC}"/><g clip-path="url(#${k})">${PATTERNS[pat](overC)}</g><path d="${d}" fill="none" stroke="${INK}" stroke-width="3"/><path d="${d}" fill="none" stroke="${m[1]}" stroke-width="1.4"/>${med}${stars}</svg>`;
  }
  const defs = `<clipPath id="${k}"><path d="${d}"/></clipPath>
<linearGradient id="${k}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(baseC, 255, 0.18)}"/><stop offset=".55" stop-color="${baseC}"/><stop offset="1" stop-color="${mix(baseC, 0, 0.22)}"/></linearGradient>
<linearGradient id="${k}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m[0]}"/><stop offset=".5" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[2]}"/></linearGradient>
<linearGradient id="${k}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/></linearGradient>
<linearGradient id="${k}gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD[0]}"/><stop offset="1" stop-color="${GOLD[1]}"/></linearGradient>
<linearGradient id="${k}sv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SILVER[0]}"/><stop offset="1" stop-color="${SILVER[1]}"/></linearGradient>`;
  const ring =
    spec.shape === 'disc'
      ? `<circle cx="32" cy="41" r="22.5" fill="none" stroke="${rim}" stroke-width="1.4"/>`
      : '';
  return `${head}<defs>${defs}</defs><path d="${d}" transform="translate(1.4 2.4)" fill="#000" opacity=".3"/>
<g clip-path="url(#${k})"><rect width="64" height="72" fill="url(#${k}g)"/>${PATTERNS[pat](overC)}</g>
<g clip-path="url(#${k})"><path d="${d}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="5"/><path d="M-2-2H66V26L-2 46Z" fill="url(#${k}h)"/></g>
<path d="${d}" fill="none" stroke="${INK}" stroke-width="4.4"/><path d="${d}" fill="none" stroke="url(#${k}m)" stroke-width="3"/>
<path d="${d}" fill="none" stroke="url(#${k}m)" stroke-width=".9" transform="translate(32 41) scale(.88) translate(-32 -41)"/>${ring}${med}${stars}</svg>`;
}
