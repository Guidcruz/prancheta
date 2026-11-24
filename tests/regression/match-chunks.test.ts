import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/*
 * The chunks of the assisted match (docs/02-architecture.md, 4.7; T-085), on the published build:
 * the match screen and the 2D pitch are chunks of their own, out of the main bundle, both in the
 * precache of the service worker (they work offline), and the pitch adds at most 20,000 bytes
 * gzip to what "Só lances principais" downloads. Reads the manifest of app/dist/.vite/ and the
 * files of dist/jogo/. Without the build it is skipped, unless REQUIRE_DIST=1 (`npm run test:all`).
 */

const appDist = fileURLToPath(new URL('../../app/dist/', import.meta.url));
const game = fileURLToPath(new URL('../../dist/jogo/', import.meta.url));
const manifestPath = join(appDist, '.vite', 'manifest.json');
const built = existsSync(manifestPath) && existsSync(join(game, 'index.html'));
const run = built || process.env['REQUIRE_DIST'] === '1' ? describe : describe.skip;

const SCREEN = 'src/ui/screens/MatchScreen.svelte';
const PITCH = 'src/ui/match/pitch/pitch-chunk.ts';
const ENTRY = 'index.html';
/** The most the pitch may add, in bytes of gzip (partida.md, "Desempenho no celular"). */
const PITCH_MAX_GZIP = 20_000;

interface Chunk {
  file: string;
  css?: string[];
  assets?: string[];
  imports?: string[];
  dynamicImports?: string[];
  isEntry?: boolean;
  isDynamicEntry?: boolean;
}
type Manifest = Record<string, Chunk>;

/** A key and everything it imports statically, recursively. */
function closure(manifest: Manifest, key: string, seen = new Set<string>()): Set<string> {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const next of manifest[key]?.imports ?? []) closure(manifest, next, seen);
  return seen;
}

/** The files of a set of keys: their JavaScript and CSS (not the font assets). */
const filesOf = (manifest: Manifest, keys: Iterable<string>) =>
  [...keys].flatMap((key) => [manifest[key]!.file, ...(manifest[key]!.css ?? [])]);

run('chunks of the assisted match (published build)', () => {
  it('the build and its manifest exist', () => {
    expect(built, 'app/dist/.vite/manifest.json or dist/jogo/ missing: run `npm run build`').toBe(
      true,
    );
  });

  const manifest: Manifest = built
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest)
    : {};
  const main = built ? closure(manifest, ENTRY) : new Set<string>();
  const screen = built ? closure(manifest, SCREEN) : new Set<string>();
  const pitch = built ? closure(manifest, PITCH) : new Set<string>();

  it('the match screen is a dynamic chunk, out of the main bundle, asked from it', () => {
    expect(manifest[SCREEN]?.isDynamicEntry).toBe(true);
    expect(main.has(SCREEN)).toBe(false);
    expect([...main].some((key) => manifest[key]!.dynamicImports?.includes(SCREEN))).toBe(true);
  });

  it('the pitch is a dynamic chunk, out of the main bundle and of the screen, asked only by the screen', () => {
    expect(manifest[PITCH]?.isDynamicEntry).toBe(true);
    expect(main.has(PITCH)).toBe(false);
    expect(screen.has(PITCH)).toBe(false);
    const askers = Object.keys(manifest).filter((key) =>
      manifest[key]!.dynamicImports?.includes(PITCH),
    );
    expect(askers.length).toBeGreaterThan(0);
    for (const key of askers) expect(screen.has(key), key).toBe(true);
  });

  it('the kit generator comes only with the pitch (a literal only kit.ts has)', () => {
    // A module bundled into a chunk is no key of the manifest: look for its text instead.
    // `sashMirror` is a kit pattern; nothing else of the game writes it.
    const marker = 'sashMirror';
    const text = (keys: Iterable<string>) =>
      [...keys]
        .map((key) => manifest[key]!.file)
        .map((file) => readFileSync(join(game, file), 'utf8'))
        .join('\n');
    const inMain = text(main).includes(marker);
    const inScreen = text([...screen].filter((key) => !main.has(key))).includes(marker);
    const inPitch = text([...pitch].filter((key) => !main.has(key) && !screen.has(key))).includes(
      marker,
    );
    expect({ inMain, inScreen, inPitch }).toEqual({
      inMain: false,
      inScreen: false,
      inPitch: true,
    });
  });

  it('every file of the main bundle, the screen and the pitch is in the precache of sw.js', () => {
    const sw = readFileSync(join(game, 'sw.js'), 'utf8');
    const urls = new Set(
      [...sw.matchAll(/"?url"?\s*:\s*"([^"]+)"/g)].map((match) => match[1]!.replace(/^\.?\//, '')),
    );
    const missing: string[] = [];
    for (const file of filesOf(manifest, new Set([...main, ...screen, ...pitch]))) {
      if (!urls.has(file)) missing.push(`${file}: not in sw.js`);
      if (!existsSync(join(game, file))) missing.push(`${file}: not in dist/jogo`);
    }
    expect(missing).toEqual([]);
    expect(filesOf(manifest, [SCREEN]).length).toBeGreaterThan(0);
  });

  it(`the pitch adds at most ${PITCH_MAX_GZIP} bytes of gzip to "Só lances principais"`, () => {
    const extra = [...pitch].filter((key) => !main.has(key) && !screen.has(key));
    const sizes = filesOf(manifest, extra).map((file) => ({
      file,
      gzip: gzipSync(readFileSync(join(game, file))).length,
    }));
    const total = sizes.reduce((sum, s) => sum + s.gzip, 0);
    console.log(
      `campo: ${total} bytes gzip (${sizes.map((s) => `${s.file} ${s.gzip}`).join(', ')})`,
    );
    expect(total, sizes.map((s) => `${s.file}: ${s.gzip}`).join('\n')).toBeLessThanOrEqual(
      PITCH_MAX_GZIP,
    );
    expect(total).toBeGreaterThan(0);
  });

  it('the pitch brings no image file: no asset of the manifest, no image path in its code (partida-campo-v2.md, 13, E2E 7)', () => {
    const extra = [...pitch].filter((key) => !main.has(key) && !screen.has(key));
    const image = /\.(png|jpe?g|gif|webp|avif|svg|ico)(\?|["')\s]|$)/i;
    const found: string[] = [];
    for (const key of extra) {
      for (const asset of manifest[key]!.assets ?? []) {
        if (image.test(asset)) found.push(`${key}: asset ${asset}`);
      }
    }
    for (const file of filesOf(manifest, extra)) {
      const text = readFileSync(join(game, file), 'utf8');
      const hit = text.match(new RegExp(`["'(][^"'()\\s]*${image.source}`, 'i'));
      if (hit !== null) found.push(`${file}: ${hit[0]}`);
    }
    expect(found).toEqual([]);
    expect(extra.length).toBeGreaterThan(0);
  });

  it('the manifest is not published (dist/jogo/.vite/ does not exist)', () => {
    expect(existsSync(join(game, '.vite'))).toBe(false);
  });
});
