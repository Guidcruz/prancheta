import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { config } from './config';

// Conformance for ADR-0015: sponsorship is off and never advertised.
const root = resolve(__dirname, '../../..');
const roots = ['app/src/content', 'site/src', 'config'].map((d) => join(root, d));
const textExt = /\.(json|md|mdx|ts|js|astro|svelte|css|txt|html|yaml|yml)$/;
// Post that may quote the invitation while explaining its removal.
const excluded = ['site/src/content/devlog/2026-11-03-dia-1.md'].map((f) => join(root, f));

const terms = [
  'patrocine aqui',
  'anuncie aqui',
  'anuncie no',
  'quer anunciar',
  'patrocina aquí',
  'anuncia aquí',
  'anúnciate',
  'sponsor here',
  'advertise here',
  'advertise with us',
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : walk(path);
    return textExt.test(name) && !excluded.includes(path) ? [path] : [];
  });
}

describe('sponsorship (ADR-0015)', () => {
  it('is disabled in the config', () => {
    expect(config.sponsorship.enabled).toBe(false);
  });

  it('is not advertised in content, site or config', () => {
    const hits: string[] = [];
    for (const file of roots.flatMap(walk)) {
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const term of terms) if (text.includes(term)) hits.push(`${file}: "${term}"`);
    }
    expect(hits).toEqual([]);
  });
});
