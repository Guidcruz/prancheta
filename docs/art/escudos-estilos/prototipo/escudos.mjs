// Rascunho de gerador de escudos (3 estilos). Nao e codigo de producao; nao importa de app/src.
// Tudo deterministico a partir do id do clube. Sem dependencias.

export function hash(str) {
  let h = 2166136261;
  for (const ch of str) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
// pequeno PRNG para sortear varias coisas do mesmo id
export function stream(id, salt) {
  let s = hash(id + '|' + salt) || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
export const pick = (r, a) => a[Math.floor(r() * a.length)];

const lum = (hex) => {
  const v = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const NEUTRAL_DARK = '#111417',
  NEUTRAL_LIGHT = '#FFFFFF';
// cor de simbolo/texto sobre um fundo: prefere cor do clube, senao neutro (>=3:1)
export function onColor(bg, club) {
  const cands = club.filter((c) => c.toLowerCase() !== bg.toLowerCase());
  cands.sort((a, b) => contrast(b, bg) - contrast(a, bg));
  if (cands[0] && contrast(cands[0], bg) >= 3) return cands[0];
  return contrast(NEUTRAL_DARK, bg) >= contrast(NEUTRAL_LIGHT, bg) ? NEUTRAL_DARK : NEUTRAL_LIGHT;
}

export const esc = (t) =>
  t.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const INK = '#0b1118',
  RIM = '#f2f5f7';

// ---- simbolos genericos (centro 0,0, caixa ~ -10..10) ----
export const SYMBOLS = {
  tower: (c) =>
    `<path d="M-7 10V-4h-2v-6h4v3h2v-3h4v3h2v-3h4v6h-2V10Z" fill="${c}"/><path d="M-2 10v-5a2 2 0 0 1 4 0v5Z" fill="var(--hole)"/>`,
  wave: (c) =>
    `<g fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"><path d="M-10 -5q2.5-4 5 0t5 0 5 0 5 0"/><path d="M-10 2q2.5-4 5 0t5 0 5 0 5 0"/><path d="M-10 9q2.5-4 5 0t5 0 5 0 5 0"/></g>`,
  pine: (c) =>
    `<path d="M0-11 6-3H3l5 6H3l4 5H-7l4-5h-5l5-6h-3Z" fill="${c}"/><rect x="-1.5" y="8" width="3" height="4" fill="${c}"/>`,
  mountain: (c) => `<path d="M-11 9 -3-8 3 1 5-2 11 9Z" fill="${c}"/>`,
  bridge: (c) =>
    `<g fill="none" stroke="${c}" stroke-width="2.6"><path d="M-11 0H11"/><path d="M-8 9V0M8 9V0"/><path d="M-8 0q8 -12 16 0" /><path d="M-11 9H11"/></g>`,
  anchor: (c) =>
    `<g fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"><circle cx="0" cy="-8" r="2.2"/><path d="M0-6V10M-5-2H5M-9 4q1 6 9 6t9-6"/></g>`,
  gear: (c) =>
    `<g fill="${c}"><circle r="7"/>${[0, 45, 90, 135].map((a) => `<rect x="-2" y="-10.5" width="4" height="21" transform="rotate(${a})"/>`).join('')}</g><circle r="3" fill="var(--hole)"/>`,
  sun: (c) =>
    `<g fill="${c}"><circle r="5"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M-1.4-7.5h2.8L0-11Z" transform="rotate(${a})"/>`).join('')}</g>`,
  key: (c) =>
    `<g fill="none" stroke="${c}" stroke-width="2.8" stroke-linecap="round"><circle cx="0" cy="-6" r="4"/><path d="M0-2V10M0 6h4M0 10h4"/></g>`,
  shell: (c) =>
    `<path d="M0 10-10 0q0-10 10-10T10 0Z" fill="${c}"/><g stroke="var(--hole)" stroke-width="1.3"><path d="M0 9V-8M0 9-6-7M0 9 6-7"/></g>`,
  bolt: (c) => `<path d="M2-11-7 2H-1L-3 11 7-3H1Z" fill="${c}"/>`,
  crown: (c) => `<path d="M-10 8V-5l5 5 5-8 5 8 5-5V8Z" fill="${c}"/>`,
  wheel: (c) =>
    `<g fill="none" stroke="${c}" stroke-width="2.4"><circle r="8"/><circle r="2" fill="${c}"/><path d="M-8 0H8M0-8V8M-5.7-5.7 5.7 5.7M5.7-5.7-5.7 5.7"/></g>`,
};
export const SYMBOL_KEYS = Object.keys(SYMBOLS);

function star(cx, cy, r, c) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      rr = i % 2 ? r * 0.45 : r;
    p.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1));
  }
  return `<polygon points="${p.join(' ')}" fill="${c}"/>`;
}
// 1 estrela a cada ~2,5 titulos, maximo 5
export const starsFor = (t) => (t <= 0 ? 0 : Math.min(5, Math.ceil(t / 2.5)));
function starRow(n, cx, y, r, gap, c) {
  let s = '';
  for (let i = 0; i < n; i++) s += star(cx + (i - (n - 1) / 2) * gap, y, r, c);
  return s;
}

// ---- padroes de campo (base c1, desenho c2) na caixa 0..64 x 0..72 ----
export const PATTERNS = {
  bend: (c) =>
    `<path d="M-4 30 34 -8h24L-4 54Z M20 80 70 30v26L46 80Z" fill="${c}" opacity="0"/><path d="M-6 42 L42 -6 H62 L-6 62Z" fill="${c}"/>`,
  chevron: (c) => `<path d="M-4 40 32 14 68 40V54L32 28-4 54Z" fill="${c}"/>`,
  check: (c) => {
    let s = '';
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        if ((x + y) % 2) s += `<rect x="${x * 8}" y="${y * 9}" width="8" height="9"/>`;
    return `<g fill="${c}">${s}</g>`;
  },
  sunburst: (c) => {
    let s = '';
    for (let i = 0; i < 12; i += 2) {
      const a1 = (i * Math.PI) / 6,
        a2 = ((i + 1) * Math.PI) / 6;
      s += `M32 38L${(32 + 80 * Math.cos(a1)).toFixed(1)} ${(38 + 80 * Math.sin(a1)).toFixed(1)}L${(32 + 80 * Math.cos(a2)).toFixed(1)} ${(38 + 80 * Math.sin(a2)).toFixed(1)}Z`;
    }
    return `<path d="${s}" fill="${c}"/>`;
  },
  fess: (c) => `<rect x="-2" y="44" width="70" height="9" fill="${c}"/>`,
  pales: (c) =>
    `<rect x="12" y="0" width="5" height="80" fill="${c}"/><rect x="47" y="0" width="5" height="80" fill="${c}"/><rect x="27" y="0" width="10" height="80" fill="${c}"/>`,
  saltire: (c) => `<path d="M-4 -4 4-6 68 70 60 76ZM68-4 60-6-4 70 4 76Z" fill="${c}"/>`,
  split: (c) => `<path d="M32 -4H70V80H32Z" fill="${c}"/>`,
  chief: (c) => `<path d="M-4-4H70V26H-4Z" fill="${c}"/>`,
  dots: (c) => {
    let s = '';
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 6; x++)
        s += `<circle cx="${x * 12 + (y % 2 ? 6 : 0)}" cy="${y * 13}" r="2.6"/>`;
    return `<g fill="${c}">${s}</g>`;
  },
};
export const PATTERN_KEYS = Object.keys(PATTERNS);

let uid = 0;
export function medallion(cx, cy, r, club, symKey, scale = 1) {
  const [c1, c2] = club;
  const fill = lum(c1) > lum(c2) ? c1 : c2; // medalhao na cor mais clara
  const sym = onColor(fill, club);
  return `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="${fill}" stroke="${INK}" stroke-width="1.4"/><g transform="scale(${(scale * r) / 13})" style="--hole:${fill}">${SYMBOLS[symKey](sym)}</g></g>`;
}

// ============ ESTILO A: BRASAO ============
// escudo com borda dupla, campo com padrao, medalhao com simbolo, estrelas de titulos e sombra.
const SHAPES_A = {
  classic: 'M6 13h52v27c0 15-11 24-26 29C17 64 6 55 6 40Z',
  pointed: 'M6 13h52v22c0 16-10 27-26 35C16 62 6 51 6 35Z',
  arched: 'M6 24q0-11 13-11h26q13 0 13 11v17c0 14-11 23-26 28C17 64 6 55 6 41Z',
};
export function brasao(club) {
  const id = club.id,
    [c1, c2] = club.colors,
    r = stream(id, 'A');
  const shape = pick(r, Object.keys(SHAPES_A)),
    pat = pick(r, PATTERN_KEYS),
    sym = pick(r, SYMBOL_KEYS);
  const k = 'a' + uid++,
    d = SHAPES_A[shape];
  const rim = onColor(c1, [c2]);
  const n = starsFor(club.titles.league);
  const stars = n ? starRow(n, 32, 6.5, 4.2, 9.5, '#f4c20d') : '';
  return `<svg viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(club.shortName)}"><defs><clipPath id="${k}"><path d="${d}"/></clipPath></defs>
<path d="${d}" transform="translate(1.2 2)" fill="#000" opacity=".28"/>
<g clip-path="url(#${k})"><rect width="64" height="72" fill="${c1}"/>${PATTERNS[pat](c2)}</g>
<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.4"/>
<path d="${d}" fill="none" stroke="${rim}" stroke-width="1.2" transform="translate(32 41) scale(.88) translate(-32 -41)"/>
${medallion(32, 40, 13, club.colors, sym)}
${stars}</svg>`;
}

// ============ ESTILO B: EMBLEMA CIRCULAR ============
// anel com nome curto no topo e ano de fundacao ficticio embaixo, miolo com padrao e medalhao.
export function emblema(club) {
  const id = club.id,
    [c1, c2] = club.colors,
    r = stream(id, 'B');
  const pat = pick(r, PATTERN_KEYS),
    sym = pick(r, SYMBOL_KEYS);
  const year = 1895 + Math.floor(r() * 41);
  const k = 'b' + uid++;
  const name = club.shortName.toUpperCase();
  const txt = onColor(c1, [c2]);
  const fs = name.length > 9 ? 5.2 : name.length > 7 ? 6 : 7;
  return `<svg viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(club.shortName)}"><defs><clipPath id="${k}"><circle cx="32" cy="36" r="19"/></clipPath>
<path id="${k}t" d="M10.2 36a21.8 21.8 0 0 1 43.6 0"/><path id="${k}b" d="M9.4 36a22.6 22.6 0 0 0 45.2 0"/></defs>
<circle cx="33" cy="38" r="31" fill="#000" opacity=".28"/>
<circle cx="32" cy="36" r="31" fill="${c1}" stroke="${INK}" stroke-width="2.4"/>
<circle cx="32" cy="36" r="20.2" fill="${c2}" stroke="${INK}" stroke-width="1.6"/>
<g clip-path="url(#${k})">${PATTERNS[pat](c1)}</g>
<circle cx="32" cy="36" r="19" fill="none" stroke="${INK}" stroke-width="1"/>
<text font-family="Arial Black,DejaVu Sans,Arial,sans-serif" font-weight="900" font-size="${fs}" fill="${txt}" text-anchor="middle" letter-spacing=".3"><textPath href="#${k}t" startOffset="50%">${esc(name)}</textPath></text>
<text font-family="Arial Black,DejaVu Sans,Arial,sans-serif" font-weight="900" font-size="5.2" fill="${txt}" text-anchor="middle"><textPath href="#${k}b" startOffset="50%" dominant-baseline="hanging">${year}</textPath></text>
${medallion(32, 36, 12.5, club.colors, sym, 1)}</svg>`;
}

// ============ ESTILO C: LOSANGO COM FAIXA ============
// losango, faixa transversal com a sigla, simbolo no triangulo de cima, estrelas de titulos embaixo.
export function losango(club) {
  const id = club.id,
    [c1, c2] = club.colors,
    r = stream(id, 'C');
  const pat = pick(r, [
      'bend',
      'chevron',
      'sunburst',
      'check',
      'dots',
      'saltire',
      'split',
      'pales',
    ]),
    sym = pick(r, SYMBOL_KEYS);
  const k = 'c' + uid++;
  const d = 'M32 3 61 36 32 69 3 36Z';
  const top = c1,
    band = c2;
  const symC = onColor(top, club.colors);
  const txt = onColor(band, club.colors);
  const n = starsFor(club.titles.league);
  const stars = n ? starRow(n, 32, 57, 3.6, 9.2, '#f4c20d') : '';
  const lowPat = pat === 'dots' || pat === 'check' || pat === 'sunburst' ? 'split' : pat;
  return `<svg viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(club.shortName)}"><defs><clipPath id="${k}"><path d="${d}"/></clipPath><clipPath id="${k}l"><rect x="0" y="44" width="64" height="28"/></clipPath></defs>
<path d="${d}" transform="translate(1.2 2)" fill="#000" opacity=".28"/>
<g clip-path="url(#${k})"><rect width="64" height="72" fill="${top}"/><g clip-path="url(#${k}l)">${PATTERNS[lowPat](c2)}</g>
<rect x="0" y="29" width="64" height="15" fill="${band}" stroke="${INK}" stroke-width="1.6"/></g>
<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
<g transform="translate(32 17.5) scale(.62)" style="--hole:${top}">${SYMBOLS[sym](symC)}</g>
<text x="32" y="40.6" text-anchor="middle" font-family="Arial Black,DejaVu Sans,Arial,sans-serif" font-weight="900" font-size="11" letter-spacing=".4" fill="${txt}">${esc(club.abbreviation)}</text>
${n ? `<rect x="${32 - n * 4.6}" y="52.5" width="${n * 9.2}" height="9" rx="4.5" fill="${INK}" opacity=".85"/>` : ''}${stars}</svg>`;
}
export const STYLES = { brasao, emblema, losango };
