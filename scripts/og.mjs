// Generates the share images (Open Graph, 1200x630 PNG), one per page, into site/public/og/.
// Spec: docs/art/og-image.md (layers, fonts, title layout). Usage: node scripts/og.mjs
//
// The rasterizer is sharp (librsvg), already used by scripts/icons.mjs. librsvg reads fonts
// from fontconfig and does not read WOFF/WOFF2, so the Barlow Condensed WOFF files from
// @fontsource are unpacked to TTF in a temp folder and a private fonts.conf points to it.
// A font proof fails the build if the weights are not found: no image with a wrong font.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200;
const H = 630;
/** Everything that matters sits in the central square (x 285 to 915); see og-image.md. */
const SAFE_WIDTH = 630;
const MAX_BYTES = 300 * 1024;
/** Beam opacity on the image (docs/art/og-image.md): stronger than on the site, text is large. */
const BEAM_OPACITY = 0.22;
const FONT_FAMILY = 'Barlow Condensed';
// The @fontsource 800 file declares itself as its own legacy family (name ID 1), so fontconfig
// does not group it with the 700 file; the 800 weight is asked for by that family name.
const FONT_FAMILY_800 = 'Barlow Condensed ExtraBold';

// ---------------------------------------------------------------- fonts

/** Converts a WOFF 1 file into the same font as an uncompressed sfnt (TTF/OTF). */
export function woffToSfnt(woff) {
  if (woff.toString('latin1', 0, 4) !== 'wOFF') throw new Error('Not a WOFF 1 file');
  const flavor = woff.readUInt32BE(4);
  const count = woff.readUInt16BE(12);
  const tables = [];
  for (let i = 0; i < count; i++) {
    const o = 44 + i * 20;
    const offset = woff.readUInt32BE(o + 4);
    const compLength = woff.readUInt32BE(o + 8);
    const origLength = woff.readUInt32BE(o + 12);
    let data = woff.subarray(offset, offset + compLength);
    if (compLength < origLength) data = inflateSync(data);
    tables.push({
      tag: woff.toString('latin1', o, o + 4),
      checksum: woff.readUInt32BE(o + 16),
      data,
    });
  }
  const pad = (n) => (n + 3) & ~3;
  let offset = 12 + 16 * count;
  const dir = Buffer.alloc(16 * count);
  tables.forEach((t, i) => {
    dir.write(t.tag, i * 16, 'latin1');
    dir.writeUInt32BE(t.checksum, i * 16 + 4);
    dir.writeUInt32BE(offset, i * 16 + 8);
    dir.writeUInt32BE(t.data.length, i * 16 + 12);
    offset += pad(t.data.length);
  });
  const head = Buffer.alloc(12);
  const log2 = Math.floor(Math.log2(count));
  head.writeUInt32BE(flavor, 0);
  head.writeUInt16BE(count, 4);
  head.writeUInt16BE(16 * 2 ** log2, 6);
  head.writeUInt16BE(log2, 8);
  head.writeUInt16BE(count * 16 - 16 * 2 ** log2, 10);
  const body = tables.map((t) =>
    Buffer.concat([t.data, Buffer.alloc(pad(t.data.length) - t.data.length)]),
  );
  return Buffer.concat([head, dir, ...body]);
}

let sharpPromise;
/** Writes the TTF files and a private fonts.conf, then loads sharp (env must come first). */
function loadSharp() {
  sharpPromise ??= (async () => {
    const dir = join(tmpdir(), 'prancheta-og-fonts');
    mkdirSync(join(dir, 'cache'), { recursive: true });
    for (const weight of [700, 800]) {
      const src = resolve(
        root,
        `node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-${weight}-normal.woff`,
      );
      writeFileSync(join(dir, `barlow-condensed-${weight}.ttf`), woffToSfnt(readFileSync(src)));
    }
    const conf = join(dir, 'fonts.conf');
    writeFileSync(
      conf,
      `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n  <dir>${dir}</dir>\n  <cachedir>${join(dir, 'cache')}</cachedir>\n  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>\n</fontconfig>\n`,
    );
    process.env['FONTCONFIG_FILE'] = conf;
    const sharp = (await import('sharp')).default;
    await proveFonts(sharp);
    return sharp;
  })();
  return sharpPromise;
}

const esc = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/** Width of one line of text, by rasterizing it alone (no metrics library needed). */
async function measureWith(sharp, text, size, weight, family = FONT_FAMILY, spacing = 0) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="300"><text x="10" y="200" font-family="${family}" font-weight="${weight}" font-size="${size}" letter-spacing="${spacing}" fill="#000">${esc(text)}</text></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const { info } = await sharp(png).trim().toBuffer({ resolveWithObject: true });
  return info.width;
}

async function proveFonts(sharp) {
  const w800 = await measureWith(sharp, 'PRANCHETA', 84, 800, FONT_FAMILY_800);
  const w700 = await measureWith(sharp, 'PRANCHETA', 84, 700);
  const wNone = await measureWith(sharp, 'PRANCHETA', 84, 800, 'Sem Fonte Prancheta');
  if (Math.abs(w800 - wNone) <= 2)
    throw new Error(
      `og: ${FONT_FAMILY_800} was not found by the rasterizer (800: ${w800}, fallback: ${wNone})`,
    );
  if (Math.abs(w800 - w700) <= 2)
    throw new Error(`og: ${FONT_FAMILY} weight 800 was not found (800: ${w800}, 700: ${w700})`);
  return { w800, w700, wNone };
}

/** Font proof, exported for the tests. Throws when the fonts are not found. */
export async function fontProof() {
  return proveFonts(await loadSharp());
}

// ---------------------------------------------------------------- title layout

/**
 * Breaks a title into lines by measuring the real font (never by counting characters).
 * 1-2 lines at 84px; 3 lines at 68px; more than 3 lines ends in an ellipsis.
 * `measure(text, size)` returns the width in px of one line at weight 800.
 */
export async function layoutTitle(title, measure) {
  const words = title.trim().split(/\s+/);
  const greedy = async (size) => {
    const lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (!line || (await measure(next, size)) <= SAFE_WIDTH) line = next;
      else {
        lines.push(line);
        line = w;
      }
    }
    lines.push(line);
    return lines;
  };
  // A single word wider than the safe width shrinks the type first (84 down to 68, step 4).
  let size = 84;
  for (; size > 68; size -= 4) {
    let widest = 0;
    for (const w of words) widest = Math.max(widest, await measure(w, size));
    if (widest <= SAFE_WIDTH) break;
  }
  let lines = await greedy(size);
  if (lines.length <= 2) {
    return { size, step: 76, lines, baselines: lines.length === 1 ? [242] : [204, 280] };
  }
  size = 68;
  lines = await greedy(size);
  if (lines.length > 3) {
    const kept = lines.slice(0, 2);
    const rest = lines.slice(2).join(' ').split(' ');
    while (rest.length > 1 && (await measure(`${rest.join(' ')}…`, size)) > SAFE_WIDTH) rest.pop();
    lines = [...kept, `${rest.join(' ')}…`];
  }
  return { size, step: 62, lines, baselines: [174, 236, 298] };
}

// ---------------------------------------------------------------- inputs

registerHooks({
  // The shield generator imports the engine's Rng through the "@engine" alias (Vite/TS paths).
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@engine/')) {
      const file = resolve(root, 'app/src/engine', `${specifier.slice(8)}.ts`);
      return nextResolve(pathToFileURL(file).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const tokens = JSON.parse(readFileSync(resolve(root, 'design/tokens.json'), 'utf8'));
const night = (name) => {
  const t = tokens.color.tokens.find((x) => x.name === name);
  if (!t) throw new Error(`Unknown token: ${name}`);
  return typeof t.value === 'string' ? t.value : t.value.noite;
};
const beamRgb = night('beam')
  .match(/rgba\((\d+),\s*(\d+),\s*(\d+)/)
  ?.slice(1, 4)
  .join(',');

// ---------------------------------------------------------------- composition

function pickClubs(clubs, slug, Rng, seedFromString) {
  const sorted = [...clubs].sort((a, b) => (a.id < b.id ? -1 : 1));
  new Rng(seedFromString(`og:${slug}`)).shuffle(sorted);
  const chosen = [];
  const pairs = new Set();
  for (const c of sorted) {
    const key = `${c.colors[0]}|${c.colors[1]}`.toLowerCase();
    if (pairs.has(key)) continue;
    pairs.add(key);
    chosen.push(c);
    if (chosen.length === 4) break;
  }
  return chosen;
}

function towerSvg(tower, x, y) {
  const lamps = tower.lampYs
    .flatMap((ly) =>
      tower.lampXs.map(
        (lx) =>
          `<circle cx="${lx}" cy="${ly}" r="${tower.lampRadius}" fill="${night('floodlight')}"/>`,
      ),
    )
    .join('');
  const p = tower.plate;
  const post = tower.post;
  return `<g transform="translate(${x} ${y})"><rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" rx="${p.rx}" fill="${night('surface-2')}" stroke="${night('line')}" stroke-width="2"/>${lamps}<rect x="${post.x}" y="${post.y}" width="${post.width}" height="${post.height}" fill="${night('line')}"/></g>`;
}

const GRASS_STRIPES = [
  '168,400 254,400 120,630 0,630',
  '341,400 427,400 360,630 240,630',
  '514,400 600,400 600,630 480,630',
  '686,400 773,400 840,630 720,630',
  '859,400 946,400 1080,630 960,630',
];

/** Builds the 1200x630 SVG of one page. */
function buildSvg({ name, title, layout, shields, tower }) {
  const beam = (o) =>
    `<stop offset="${o[0]}" stop-color="rgb(${beamRgb})" stop-opacity="${o[1]}"/>`;
  const clear = (o) => `<stop offset="${o}" stop-color="rgb(${beamRgb})" stop-opacity="0"/>`;
  const focus = (id, x) =>
    `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${x} 0) scale(540 378)">${beam([0, BEAM_OPACITY])}${clear(0.7)}</radialGradient>`;
  const band = (id, x1, y1, x2, y2) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${clear(0.32)}${beam([0.45, BEAM_OPACITY])}${clear(0.56)}</linearGradient>`;
  const ink = night('ink');
  const lines = layout.lines
    .map(
      (l, i) =>
        `<text x="600" y="${layout.baselines[i]}" text-anchor="middle" font-family="${FONT_FAMILY_800}" font-weight="800" font-size="${layout.size}" fill="${ink}">${esc(l.toLocaleUpperCase('pt-BR'))}</text>`,
    )
    .join('');
  const xs = [366, 490, 614, 738];
  const ys = [478, 456, 456, 478];
  const shieldSvgs = shields
    .map((s, i) => `<g transform="translate(${xs[i]} ${ys[i]})" filter="url(#shadow)">${s}</g>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>${esc(title)}</title>
<defs>
${focus('fl', 96)}${focus('fr', 1104)}
${band('b1', 14, -23, 1186, 653)}${band('b2', 1186, -23, 14, 653)}
<linearGradient id="grass" x1="0" y1="400" x2="0" y2="480" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${night('pitch')}" stop-opacity="0"/><stop offset="1" stop-color="${night('pitch')}"/></linearGradient>
<filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b"/><feOffset in="b" dy="10" result="o"/><feComponentTransfer in="o" result="s"><feFuncA type="linear" slope="0.5"/></feComponentTransfer><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="${W}" height="${H}" fill="${night('surface-0')}"/>
<rect width="${W}" height="${H}" fill="url(#fl)"/>
<rect width="${W}" height="${H}" fill="url(#fr)"/>
<rect width="${W}" height="${H}" fill="url(#b1)"/>
<rect width="${W}" height="${H}" fill="url(#b2)"/>
<rect width="${W}" height="12" fill="${night('floodlight')}"/>
${towerSvg(tower, 40, 30)}${towerSvg(tower, 1040, 30)}
<polygon points="168,400 1032,400 1200,630 0,630" fill="url(#grass)"/>
${GRASS_STRIPES.map((p) => `<polygon points="${p}" fill="${night('pitch-line')}" opacity="0.06"/>`).join('')}
<g fill="none" stroke="${night('pitch-line')}" stroke-width="3" opacity="0.75"><path d="M144 435H1056"/><path d="M600 435V630"/><ellipse cx="600" cy="533" rx="180" ry="55"/><circle cx="600" cy="533" r="5" fill="${night('pitch-line')}"/></g>
<text x="604" y="102" text-anchor="middle" font-family="${FONT_FAMILY}" font-weight="700" font-size="40" letter-spacing="8" fill="${night('floodlight')}">${esc(name.toLocaleUpperCase('pt-BR'))}</text>
${lines}
${shieldSvgs}
</svg>`;
}

/** Loads the build-time modules (shield generator, shared tower geometry, share texts). */
async function loadModules() {
  const url = (p) => pathToFileURL(resolve(root, p)).href;
  const [{ config }, { share }, { tower }, shield, rng] = await Promise.all([
    import(url('config/prancheta.config.ts')),
    import(url('site/src/data/share.ts')),
    import(url('site/src/lib/stadium-geometry.ts')),
    import(url('app/src/lib/generators/shield.ts')),
    import(url('app/src/engine/rng.ts')),
  ]);
  const clubs = JSON.parse(readFileSync(resolve(root, 'app/src/data/clubs.serie-a.json'), 'utf8'));
  return { config, share, tower, shield, rng, clubs };
}

/**
 * Renders the share images to `outDir`. Returns the written files with their sizes and hashes.
 * @param {{ outDir?: string, slugs?: string[] }} [options]
 */
export async function generate({ outDir = resolve(root, 'site/public/og'), slugs } = {}) {
  const sharp = await loadSharp();
  const { config, share, tower, shield, rng, clubs } = await loadModules();
  mkdirSync(outDir, { recursive: true });
  const measure = (text, size) => measureWith(sharp, text, size, 800, FONT_FAMILY_800);
  const out = [];
  for (const entry of share.filter((e) => !slugs || slugs.includes(e.slug))) {
    const layout = await layoutTitle(entry.ogTitle, measure);
    const shields = pickClubs(clubs, entry.slug, rng.Rng, rng.seedFromString).map((c) =>
      shield.shieldSvg(shield.shieldSpecFor(c), 96),
    );
    const svg = buildSvg({ name: config.name, title: entry.ogTitle, layout, shields, tower });
    const png = await sharp(Buffer.from(svg))
      .removeAlpha()
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    if (png.length > MAX_BYTES)
      throw new Error(`og: ${entry.file} has ${png.length} bytes (limit ${MAX_BYTES})`);
    const file = join(outDir, entry.file);
    writeFileSync(file, png);
    out.push({
      slug: entry.slug,
      file,
      bytes: png.length,
      hash: createHash('sha256').update(png).digest('hex'),
    });
  }
  return out;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const written = await generate();
  for (const w of written) if (!existsSync(w.file) || statSync(w.file).size === 0) process.exit(1);
  console.log(
    `og: ${written.length} images written (${Math.max(...written.map((w) => w.bytes))} bytes max)`,
  );
}
