import { afterAll, describe, expect, it } from 'vitest';
import { config } from '../../../config/prancheta.config';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Share images (scripts/og.mjs, docs/art/og-image.md). Renders into a temp folder.
const ogUrl = new URL('../../../scripts/og.mjs', import.meta.url).href;
const load = async () => (await import(/* @vite-ignore */ ogUrl)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const tempDirs: string[] = [];
afterAll(async () => {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
  (await load()).cleanupFonts();
});

describe('slogan.short', () => {
  it('is the end of the slogan in every language', () => {
    for (const lang of config.languages) {
      const full = config.slogan[lang].replace(/\.$/, '').toLocaleLowerCase();
      expect(full.endsWith(config.slogan.short[lang].toLocaleLowerCase()), lang).toBe(true);
    }
  });
});

describe('share images', () => {
  it('proves the Barlow Condensed weights are found by the rasterizer', async () => {
    const og = await load();
    const p = await og.fontProof();
    expect(Math.abs(p.w800 - p.wNone)).toBeGreaterThan(2);
    expect(Math.abs(p.w800 - p.w700)).toBeGreaterThan(2);
    expect(Math.abs(p.w700 - p.w700None)).toBeGreaterThan(2);
  }, 30000);

  it('renders all nine pages at 1200x630, under 300 KB, same bytes on every run', async () => {
    const og = await load();
    const dir = mkdtempSync(join(tmpdir(), 'og-test-'));
    tempDirs.push(dir);
    const a = await og.generate({ outDir: dir });
    const b = await og.generate({ outDir: dir });
    expect(a).toHaveLength(9);
    expect(a.map((x: { hash: string }) => x.hash)).toEqual(b.map((x: { hash: string }) => x.hash));
    const sharp = (await import('sharp')).default;
    for (const f of a as { file: string; bytes: number }[]) {
      expect(f.bytes).toBeLessThanOrEqual(300 * 1024);
      const m = await sharp(readFileSync(f.file)).metadata();
      expect([m.width, m.height, m.channels]).toEqual([1200, 630, 3]);
    }
  }, 120000);

  it('breaks a long title in at most 3 lines and ends it with an ellipsis', async () => {
    const og = await load();
    const sharp = (await import('sharp')).default;
    await og.fontProof();
    const w = (t: string, size: number) =>
      sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300"><text x="10" y="200" font-family="Barlow Condensed ExtraBold" font-weight="800" font-size="${size}">${t}</text></svg>`,
        ),
      )
        .png()
        .toBuffer()
        .then((png: Buffer) => sharp(png).trim().toBuffer({ resolveWithObject: true }))
        .then((r: { info: { width: number } }) => r.info.width);
    const l = await og.layoutTitle(
      'UM TÍTULO MUITO MAIS LONGO DO QUE QUALQUER UM APROVADO PARA ESTA IMAGEM DE TESTE QUE NÃO CABE EM TRÊS LINHAS DE JEITO NENHUM',
      w,
    );
    expect(l.lines.length).toBeLessThanOrEqual(3);
    expect(l.lines[l.lines.length - 1].endsWith('…')).toBe(true);
    const short = await og.layoutTitle('Privacidade', w);
    expect(short.lines).toEqual(['Privacidade']);
    const home = await og.layoutTitle('O Brasil inteiro na prancheta', w);
    expect(home.lines).toEqual(['O Brasil inteiro', 'na prancheta']);
  }, 30000);
});
