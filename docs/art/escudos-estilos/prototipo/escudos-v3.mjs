// Estilo A v3: simbolos grandes ligados a cidade, estrelas por serie (ouro = A, prata = B) e agrupamento.
import { stream, pick, esc, onColor, PATTERNS, INK, SYMBOLS } from './escudos.mjs';
import { SHAPES, assignShapes } from './escudos-v2.mjs';

export { assignShapes };

const mix = (hex, to, t) => {
  const f = (i) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t) + to * t)
      .toString(16)
      .padStart(2, '0');
  return '#' + f(1) + f(3) + f(5);
};
const lighten = (h, t) => mix(h, 255, t);
const darken = (h, t) => mix(h, 0, t);

// ---- simbolos da cidade (caixa -11..11; --hole = cor do medalhao) ----
const S = (c) => `fill="${c}"`;
const ST = (c, w) =>
  `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
export const CITY = {
  calcadao: (c) =>
    `<g ${ST(c, 4.2)}><path d="M-10-4q5-6 10 0t10 0"/><path d="M-10 5q5-6 10 0t10 0"/></g>`,
  arcos: (c) =>
    `<path d="M-11-8H11V10H-11Z" ${S(c)}/><g fill="var(--hole)"><path d="M-9.5 10V3a2.5 2.5 0 0 1 5 0v7Z"/><path d="M-2.5 10V3a2.5 2.5 0 0 1 5 0v7Z"/><path d="M4.5 10V3a2.5 2.5 0 0 1 5 0v7Z"/><rect x="-9" y="-5" width="18" height="2"/></g>`,
  chama: (c) =>
    `<path d="M0-11C2-6 8-3 8 3a8 8 0 0 1-16 0c0-3 2-5 3-7 1 2 2 3 3 3 0-4-1-6 2-10Z" ${S(c)}/><path d="M0 10a3 3 0 0 1-3-3c0-2 1.5-3 3-5 1.5 2 3 3 3 5a3 3 0 0 1-3 3Z" fill="var(--hole)"/>`,
  paoacucar: (c) =>
    `<path d="M-2 10C-2-2 1-9 6-9s8 7 8 19Z" ${S(c)}/><path d="M-12 10C-12 3-10 0-7 0s5 3 5 10Z" ${S(c)} stroke="var(--hole)" stroke-width="1.2"/><path d="M-11-9 5-9" ${ST(c, 1.2)}/><rect x="-5" y="-8" width="4" height="3" rx=".8" ${S(c)}/>`,
  predios: (c) =>
    `<path d="M-11 10V0h5V-9h5V-4h4V-11h5V-2h5V10Z" ${S(c)}/><g fill="var(--hole)"><rect x="-4.5" y="-6" width="2" height="2"/><rect x="-4.5" y="-2" width="2" height="2"/><rect x="2.5" y="-8" width="2" height="2"/><rect x="2.5" y="-3" width="2" height="2"/><rect x="2.5" y="2" width="2" height="2"/></g>`,
  palmeira: (c) =>
    `<g ${ST(c, 2.6)}><path d="M1-4Q-5-11-10-4M1-4Q7-11 12-4M1-4V-11M1-4Q-4-6-9 1M1-4Q6-6 11 1"/></g><path d="M-1 10 0-4H3L3 10Z" ${S(c)}/>`,
  ponte: (c) =>
    `<path d="M-1.6 10V-11h3.2V10Z" ${S(c)}/><rect x="-11" y="4" width="22" height="3.4" ${S(c)}/><path d="M0-10-10 4M0-10-6 4M0-10 10 4M0-10 6 4" ${ST(c, 1.3)}/>`,
  guindaste: (c) =>
    `<path d="M-9 10V-8h3.2V10Z" ${S(c)}/><rect x="-9" y="-9" width="21" height="3.4" ${S(c)}/><path d="M8-6V2" ${ST(c, 1.4)}/><rect x="4.5" y="2" width="7" height="6" ${S(c)}/><rect x="-11" y="8" width="22" height="2.6" ${S(c)}/>`,
  picareta: (c) => `<path d="M0-4V11" ${ST(c, 3)}/><path d="M-11 1Q0-14 11 1" ${ST(c, 4)}/>`,
  pampulha: (c) =>
    `<g ${ST(c, 2.8)}><path d="M-10 10Q-10-10 0-10Q10-10 10 10"/><path d="M-4 10Q-4-3 0-3Q4-3 4 10"/><path d="M-11.5 10H11.5"/></g>`,
  cuia: (c) =>
    `<path d="M-7-4H7C8 5 4 10 0 10S-8 5-7-4Z" ${S(c)}/><ellipse cx="0" cy="-4" rx="7" ry="2.2" fill="var(--hole)"/><path d="M3-3 8-11" ${ST(c, 2)}/>`,
  chamine: (c) =>
    `<path d="M-3.4 10-4.6-8H4.6L3.4 10Z" ${S(c)}/><rect x="-6" y="-11" width="12" height="3.4" ${S(c)}/><rect x="-11" y="6" width="22" height="4" ${S(c)}/><rect x="-2" y="-3" width="4" height="2" fill="var(--hole)"/>`,
  araucaria: (c) =>
    `<g ${ST(c, 2)}><path d="M0 11V-9M0 3Q-3 3-8-4M0 3Q3 3 8-4M0-3Q-2-4-5-9M0-3Q2-4 5-9"/></g><g ${S(c)}><ellipse cx="-8" cy="-5" rx="3.2" ry="1.7"/><ellipse cx="8" cy="-5" rx="3.2" ry="1.7"/><ellipse cx="-5" cy="-10" rx="3" ry="1.6"/><ellipse cx="5" cy="-10" rx="3" ry="1.6"/><ellipse cx="0" cy="-10.5" rx="2.8" ry="1.5"/></g>`,
  torre: (c) =>
    `<path d="M-6 10-1.2-2h2.4L6 10Z" ${S(c)}/><ellipse cx="0" cy="-5" rx="8.5" ry="3.4" ${S(c)}/><rect x="-3" y="-10" width="6" height="5" rx="1" ${S(c)}/><path d="M0-10V-12" ${ST(c, 1.2)}/>`,
  berimbau: (c) =>
    `<path d="M-5-11Q9 0-5 11" ${ST(c, 2.6)}/><path d="M-5-11V11" ${ST(c, 1)}/><circle cx="-3" cy="6" r="4.8" ${S(c)}/><circle cx="-3" cy="6" r="1.6" fill="var(--hole)"/>`,
  farol: (c) =>
    `<path d="M-4.4 10-2.6-3.5H2.6L4.4 10Z" ${S(c)}/><rect x="-3" y="-8" width="6" height="4.5" ${S(c)}/><path d="M-4.6-8 0-11.5 4.6-8Z" ${S(c)}/><path d="M-6-6H-11M6-6H11M-5.5-9-9-11M5.5-9 9-11" ${ST(c, 1.4)}/><rect x="-3.4" y="1" width="6.8" height="2" fill="var(--hole)"/>`,
  sino: (c) =>
    `<path d="M-8 6Q-7-1-6-4Q-4-8 0-8T6-4Q7-1 8 6Z" ${S(c)}/><rect x="-10" y="5" width="20" height="3" rx="1.5" ${S(c)}/><circle cx="0" cy="10" r="1.8" ${S(c)}/><circle cx="0" cy="-9.5" r="1.8" ${S(c)}/>`,
  sol: (c) => SYMBOLS.sun(c),
  espiga: (c) =>
    `<path d="M0 11V-6" ${ST(c, 1.8)}/><g ${S(c)}>${[-8, -4, 0, 4]
      .map(
        (y) =>
          `<ellipse cx="-3.4" cy="${y}" rx="1.8" ry="3" transform="rotate(-30 -3.4 ${y})"/><ellipse cx="3.4" cy="${y}" rx="1.8" ry="3" transform="rotate(30 3.4 ${y})"/>`,
      )
      .join('')}<ellipse cx="0" cy="-10" rx="1.7" ry="3"/></g>`,
  vitoriaregia: (c) =>
    `<ellipse cx="0" cy="5" rx="11" ry="5" ${S(c)}/><path d="M0 5-3-1H3Z" fill="var(--hole)"/><path d="M0-1Q-5-3-4-9Q0-7 0-1Q0-7 4-9 5-3 0-1Z" ${S(c)}/>`,
};

// Simbolo fixo por clube (proposta de campo `crestSymbol` em clubs.serie-a.json)
export const CREST = {
  flamingo: 'calcadao',
  corinto: 'predios',
  palmeral: 'palmeira',
  'sao-paulao': 'ponte',
  'atletico-minerio': 'picareta',
  gremeos: 'cuia',
  fluminario: 'arcos',
  botafogueira: 'chama',
  vasconcelos: 'paoacucar',
  santoes: 'guindaste',
  cruzador: 'pampulha',
  'inter-regional': 'chamine',
  tufao: 'torre',
  baiao: 'berimbau',
  coritibom: 'araucaria',
  vitorioso: 'farol',
  bragantao: 'sino',
  miragol: 'sol',
  chapecao: 'espiga',
  remador: 'vitoriaregia',
};

// ---- estrelas por serie ----
// 1 estrela pequena por titulo; 5 titulos = 1 estrela grande (com aro). Maximo 3 grandes + 4 pequenas.
export function starGlyphs(titles) {
  const t = Math.max(0, titles | 0);
  return { big: Math.min(3, Math.floor(t / 5)), small: Math.min(4, (t % 5) + (t >= 20 ? 0 : 0)) };
}
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
// titles: { league (Serie A, ouro), leagueB (Serie B, prata, campo futuro) }
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
  let out = small
    ? ''
    : `<rect x="${(32 - tw / 2).toFixed(1)}" y="0.8" width="${tw.toFixed(1)}" height="11.4" rx="5.7" fill="${INK}" stroke="#fff" stroke-opacity=".35" stroke-width=".6"/>`;
  if (small)
    out = `<rect x="${(32 - tw / 2).toFixed(1)}" y="0.8" width="${tw.toFixed(1)}" height="11.4" rx="5.7" fill="${INK}"/>`;
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

const METAL = {
  big: ['#f3dd9a', '#c59a3a', '#6e4f12'],
  medium: ['#eef2f6', '#a9b6c2', '#55626e'],
  small: ['#f3c9a0', '#b9783f', '#6b3f1c'],
};
const COARSE = new Set(['bend', 'chevron', 'split', 'fess', 'chief']);

let uid = 0;
export function brasaoV3(club, shape, size = 64) {
  const small = size <= 32;
  const r = stream(club.id, 'A3');
  const [c1, c2] = club.colors;
  let pat = pick(r, Object.keys(PATTERNS));
  if (small && !COARSE.has(pat)) pat = null;
  const d = SHAPES[shape],
    k = 'w' + uid++;
  const m = METAL[club.size] ?? METAL.small;
  const rim = onColor(c1, [c2]);
  const symKey = CREST[club.id] ?? 'sol';
  const R = shape === 'disc' ? 17 : 18; // medalhao grande
  const fill = (() => {
    const L = (h) => {
      const v = [1, 3, 5]
        .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    return L(c1) > L(c2) ? c1 : c2;
  })();
  const symC = onColor(fill, club.colors);
  const sc = (R * 0.8) / 11; // simbolo ocupa ~80% do medalhao
  const med = `<g transform="translate(32 41)"><circle r="${R}" fill="${fill}" stroke="${INK}" stroke-width="1.5"/><g transform="scale(${sc.toFixed(3)})" style="--hole:${fill}">${CITY[symKey](symC)}</g></g>`;
  const head = `<svg viewBox="0 0 64 72" width="${size}" height="${Math.round(size * 1.125)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(club.shortName)}">`;
  const stars = starRow(k, club.titles, small);
  if (small) {
    return `${head}<defs><clipPath id="${k}"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${c1}"/>${pat ? `<g clip-path="url(#${k})">${PATTERNS[pat](c2)}</g>` : ''}<path d="${d}" fill="none" stroke="${INK}" stroke-width="3"/><path d="${d}" fill="none" stroke="${m[1]}" stroke-width="1.4"/>${med}${stars}</svg>`;
  }
  const defs = `<clipPath id="${k}"><path d="${d}"/></clipPath>
<linearGradient id="${k}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten(c1, 0.18)}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="${darken(c1, 0.22)}"/></linearGradient>
<linearGradient id="${k}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m[0]}"/><stop offset=".5" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[2]}"/></linearGradient>
<linearGradient id="${k}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/></linearGradient>
<linearGradient id="${k}gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD[0]}"/><stop offset="1" stop-color="${GOLD[1]}"/></linearGradient>
<linearGradient id="${k}sv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SILVER[0]}"/><stop offset="1" stop-color="${SILVER[1]}"/></linearGradient>`;
  const ring =
    shape === 'disc'
      ? `<circle cx="32" cy="41" r="22.5" fill="none" stroke="${rim}" stroke-width="1.4"/>`
      : '';
  return `${head}<defs>${defs}</defs><path d="${d}" transform="translate(1.4 2.4)" fill="#000" opacity=".3"/>
<g clip-path="url(#${k})"><rect width="64" height="72" fill="url(#${k}g)"/>${PATTERNS[pat](c2)}</g>
<g clip-path="url(#${k})"><path d="${d}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="5"/><path d="M-2-2H66V26L-2 46Z" fill="url(#${k}h)"/></g>
<path d="${d}" fill="none" stroke="${INK}" stroke-width="4.4"/><path d="${d}" fill="none" stroke="url(#${k}m)" stroke-width="3"/>
<path d="${d}" fill="none" stroke="url(#${k}m)" stroke-width=".9" transform="translate(32 41) scale(.88) translate(-32 -41)"/>${ring}${med}${stars}</svg>`;
}
