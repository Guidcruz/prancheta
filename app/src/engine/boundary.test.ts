import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Proves that the engine boundary rules of app/eslint.config.js catch each violation
 * (docs/02-architecture.md, 5; ADR-0007, "Conformidade"). The code is linted as if it were a
 * production file inside app/src/engine/, without touching the disk.
 */
const appDir = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: appDir });

async function ruleIds(code: string, file = 'src/engine/__fixture__.ts'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${appDir}${file}` });
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message);
}

const cases: [string, string, string][] = [
  ['Math.random', 'export const x = Math.random();', 'no-restricted-properties'],
  ['Date.now', 'export const x = Date.now();', 'no-restricted-globals'],
  ['new Date', 'export const x = new Date();', 'no-restricted-globals'],
  ['Intl', "export const x = new Intl.NumberFormat('pt-BR');", 'no-restricted-globals'],
  ['window', 'export const x = window.innerWidth;', 'no-restricted-globals'],
  ['process', 'export const x = process.env;', 'no-restricted-globals'],
  ['Math.exp outside math.ts', 'export const x = Math.exp(1);', 'no-restricted-properties'],
  ['Math.pow outside math.ts', 'export const x = Math.pow(2, 0.5);', 'no-restricted-properties'],
  ['** outside math.ts', 'export const f = (a: number) => a ** 0.5;', 'no-restricted-syntax'],
  ['import from ui/', "import '../ui/App.svelte';", 'no-restricted-imports'],
  ['import from lib/', "import '../lib/i18n.ts';", 'no-restricted-imports'],
  ['import from content/', "import '../content/pt-BR/ui.json';", 'no-restricted-imports'],
  ['import from params/', "import '../params/match.json';", 'no-restricted-imports'],
  ['import from data/', "import '../data/clubs.serie-a.json';", 'no-restricted-imports'],
  ['import @config', "import '@config';", 'no-restricted-imports'],
  ['import @engine alias', "import '@engine/rng.ts';", 'no-restricted-imports'],
  ['import node:*', "import 'node:fs';", 'no-restricted-imports'],
  ['import svelte', "import 'svelte';", 'no-restricted-imports'],
  [
    'import from testing/',
    "import { expectGolden } from './testing/golden.ts';\nexport const g = expectGolden;",
    'no-restricted-imports',
  ],
  ['localeCompare', "export const c = 'a'.localeCompare('b');", 'no-restricted-syntax'],
  ['toLocaleString', 'export const s = (1234.5).toLocaleString();', 'no-restricted-syntax'],
  ['relative import without .ts', "export { Rng } from './rng';", 'prancheta/relative-ts-imports'],
  [
    'relative import with .js',
    "import { Rng } from './rng.js';\nexport const r = Rng;",
    'prancheta/relative-ts-imports',
  ],
  [
    'dynamic import without .ts',
    "export const m = import('./rng');",
    'prancheta/relative-ts-imports',
  ],
];

describe('engine lint boundary', () => {
  it.each(cases)('catches %s', async (_label, code, rule) => {
    expect(await ruleIds(code)).toContain(rule);
  });

  it('accepts a clean engine file with relative .ts imports', async () => {
    const code = [
      "import { Rng } from './rng.ts';",
      "import { clamp } from './math.ts';",
      "import type { Side } from './types.ts';",
      'export const side: Side = "home";',
      'export const p = clamp(new Rng(1).next(), 0.01, 0.3);',
    ].join('\n');
    expect(await ruleIds(code)).toEqual([]);
  });

  it('lets engine tests import the golden helper', async () => {
    const code = "import { expectGolden } from './testing/golden.ts';\nexpectGolden('x', 1);";
    expect(await ruleIds(code, 'src/engine/__fixture__.test.ts')).toEqual([]);
  });

  it('keeps engine/testing/ out of production lib/ and ui/, but not out of their tests', async () => {
    const relative = "import '../engine/testing/golden.ts';";
    const alias = "import '@engine/testing/golden.ts';";
    expect(await ruleIds(relative, 'src/lib/fixture.ts')).toContain('no-restricted-imports');
    expect(await ruleIds(alias, 'src/ui/fixture.ts')).toContain('no-restricted-imports');
    expect(await ruleIds(relative, 'src/lib/fixture.test.ts')).toEqual([]);
    expect(await ruleIds(alias, 'src/ui/fixture.test.ts')).toEqual([]);
  });

  it('allows transcendental functions only in engine/math.ts', async () => {
    expect(
      await ruleIds('export const e = (x: number) => Math.exp(x) ** 2;', 'src/engine/math.ts'),
    ).toEqual([]);
    expect(await ruleIds('export const r = Math.random();', 'src/engine/math.ts')).toContain(
      'no-restricted-properties',
    );
  });

  it('keeps lib/ out of ui/ and ui/ out of lib/save/', async () => {
    expect(await ruleIds("import '../ui/App.svelte';", 'src/lib/fixture.ts')).toContain(
      'no-restricted-imports',
    );
    expect(await ruleIds("import '../lib/save/db.ts';", 'src/ui/fixture.ts')).toContain(
      'no-restricted-imports',
    );
  });
});
