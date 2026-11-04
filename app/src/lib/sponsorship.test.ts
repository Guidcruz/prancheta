import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { config } from './config';

// Conformance for ADR-0015: sponsorship is off and never advertised.
const root = resolve(__dirname, '../../..');
const roots = [
  'app/src/content',
  'app/public',
  'app/index.html',
  'site/src',
  'site/public',
  'config',
].map((d) => join(root, d));
// Text files only, so binaries (png etc.) are never read.
const textExt =
  /\.(json|md|mdx|ts|tsx|js|mjs|astro|svelte|css|txt|html|svg|yaml|yml|webmanifest)$/i;

const terms: RegExp[] = [
  /patrocine aqui/,
  /anuncie aqui/,
  /\banuncie no\b/,
  /quer anunciar/,
  /patrocina aquí/,
  /anuncia aquí/,
  /anúnciate/,
  /sponsor here/,
  /advertise here/,
  /advertise with us/,
];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return textExt.test(dir) ? [dir] : [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : walk(path);
    return textExt.test(name) ? [path] : [];
  });
}

describe('sponsorship (ADR-0015)', () => {
  it('is disabled in the config', () => {
    expect(config.sponsorship.enabled).toBe(false);
  });

  it('is not advertised in content, site or config', () => {
    const hits: string[] = [];
    for (const file of roots.flatMap(walk)) {
      const text = readFileSync(file, 'utf8').normalize('NFC').toLowerCase();
      for (const term of terms) if (term.test(text)) hits.push(`${file}: ${term}`);
    }
    expect(hits).toEqual([]);
  });
});
