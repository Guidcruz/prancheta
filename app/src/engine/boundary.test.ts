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
  ['Math.exp', 'export const x = Math.exp(1);', 'no-restricted-properties'],
  ['Math.pow', 'export const x = Math.pow(2, 0.5);', 'no-restricted-properties'],
  ['Math.log', 'export const x = Math.log(2);', 'no-restricted-properties'],
  ['Math.sin', 'export const x = Math.sin(2);', 'no-restricted-properties'],
  ['**', 'export const f = (a: number) => a ** 0.5;', 'no-restricted-syntax'],
  ['an alias of Math', 'const M = Math;\nexport const x = M.exp(1);', 'no-restricted-syntax'],
  ['Math[name]', "const name = 'exp';\nexport const x = Math[name](1);", 'no-restricted-syntax'],
  [
    'Math passed around',
    'export const f = (g: (m: Math) => number) => g(Math);',
    'no-restricted-syntax',
  ],
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

  it('keeps engine/testing/ out of lib/ and ui/, their tests included (T-049)', async () => {
    const relative = "import '../engine/testing/golden.ts';";
    const alias = "import '@engine/testing/golden.ts';";
    expect(await ruleIds(relative, 'src/lib/fixture.ts')).toContain('no-restricted-imports');
    expect(await ruleIds(alias, 'src/ui/fixture.ts')).toContain('no-restricted-imports');
    expect(await ruleIds(relative, 'src/lib/fixture.test.ts')).toContain('no-restricted-imports');
    expect(await ruleIds(alias, 'src/ui/fixture.test.ts')).toContain('no-restricted-imports');
  });

  it('keeps blocklist hashes and node:* out of production lib/ and ui/, but not out of tests', async () => {
    const imports = [
      "import '../data/name-exclusions.ts';",
      "import '../data/blocklist.ts';",
      "import '../data/athletes-blocklist.sha256.json';",
      "import 'node:crypto';",
    ];
    for (const code of imports) {
      expect(await ruleIds(code, 'src/lib/fixture.ts')).toContain('no-restricted-imports');
      expect(await ruleIds(code, 'src/ui/fixture.ts')).toContain('no-restricted-imports');
      expect(await ruleIds(code, 'src/lib/fixture.test.ts')).toEqual([]);
    }
  });

  // ADR-0020, test 7: math.ts lost its exception; the engine's exp is arithmetic only.
  it.each([
    ['Math.exp', 'export const e = (x: number) => Math.exp(x);', 'no-restricted-properties'],
    ['Math.pow', 'export const e = (x: number) => Math.pow(x, 2);', 'no-restricted-properties'],
    ['Math.expm1', 'export const e = (x: number) => Math.expm1(x);', 'no-restricted-properties'],
    ['Math.log1p', 'export const e = (x: number) => Math.log1p(x);', 'no-restricted-properties'],
    ['Math.random', 'export const r = Math.random();', 'no-restricted-properties'],
    ['**', 'export const e = (x: number) => x ** 2;', 'no-restricted-syntax'],
  ])('refuses %s in engine/math.ts too', async (_label, code, rule) => {
    expect(await ruleIds(code, 'src/engine/math.ts')).toContain(rule);
  });

  it('refuses Math.exp in another engine file, and allows the exact Math functions', async () => {
    expect(
      await ruleIds('export const e = (x: number) => Math.exp(x);', 'src/engine/match/rules.ts'),
    ).toContain('no-restricted-properties');
    const exact = [
      'export const f = (x: number) =>',
      '  Math.sqrt(x) + Math.floor(x) + Math.ceil(x) + Math.round(x) + Math.trunc(x) +',
      '  Math.abs(x) + Math.sign(x) + Math.min(x, 1) + Math.max(x, 0) + Math.imul(x, 3) +',
      '  Math.clz32(x) + Math.fround(x) + Math.E + Math.SQRT2 + Math.LN2 + Math.PI;',
    ].join('\n');
    expect(await ruleIds(exact, 'src/engine/math.ts')).toEqual([]);
    expect(await ruleIds(exact, 'src/engine/__fixture__.ts')).toEqual([]);
  });

  it('keeps transcendental functions free in engine tests and benches (they compare with them)', async () => {
    const code = 'export const e = (x: number) => Math.exp(x) - Math.log(x) + x ** 2;';
    expect(await ruleIds(code, 'src/engine/math.property.test.ts')).toEqual([]);
    expect(await ruleIds(code, 'src/engine/round.bench.ts')).toEqual([]);
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

/*
 * The engine's front door (docs/02-architecture.md, 4.1, "Fronteira do `index.ts`", and 5; T-049):
 * outside app/src/engine/ the engine comes only from index.ts or `@engine` without a subpath, in
 * production code and in tests alike. The same pattern covers scripts/, site/ and server/ through
 * the root eslint.config.js (scripts/boundary.test.ts).
 */
describe('engine front door: index.ts only, outside the engine', () => {
  it('refuses @engine/rng in a file of lib/', async () => {
    const code = "import { Rng } from '@engine/rng';\nexport const r = new Rng(1);";
    expect(await ruleIds(code, 'src/lib/generators/fixture.ts')).toContain('no-restricted-imports');
  });

  it.each([
    ['lib/', 'src/lib/fixture.ts', "import '../engine/rng.ts';"],
    [
      'lib/ (type only)',
      'src/lib/generators/fixture.ts',
      "import type { Side } from '../../engine/types.ts';",
    ],
    ['a test of lib/', 'src/lib/fixture.test.ts', "import '../engine/clubs.ts';"],
    ['a test of lib/ (alias)', 'src/lib/fixture.test.ts', "import '@engine/clubs';"],
    ['ui/', 'src/ui/fixture.ts', "import '../engine/match/simulate.ts';"],
    [
      'a .svelte of ui/',
      'src/ui/Fixture.svelte',
      '<script lang="ts">import \'@engine/round\';</script>',
    ],
    ['a test of ui/', 'src/ui/fixture.test.ts', "import '../engine/round.ts';"],
    ['production data/', 'src/data/fixture.ts', "import '../engine/clubs.ts';"],
    ['main.ts', 'src/main.ts', "import '@engine/rng';"],
  ])('refuses an engine file in %s', async (_label, file, code) => {
    expect(await ruleIds(code, file)).toContain('no-restricted-imports');
  });

  it.each([
    [
      'lib/',
      'src/lib/generators/fixture.ts',
      "import { Rng } from '@engine';\nexport const r = new Rng(1);",
    ],
    [
      'lib/ (path)',
      'src/lib/fixture.ts',
      "import { Rng } from '../engine/index.ts';\nexport const r = new Rng(1);",
    ],
    [
      'a test of ui/',
      'src/ui/fixture.test.ts',
      "import type { Side } from '../engine/index.ts';\nexport const s: Side = 'home';",
    ],
  ])('accepts the public API in %s', async (_label, file, code) => {
    expect(await ruleIds(code, file)).toEqual([]);
  });

  it("lets the engine's own tests and the data tests (real clubs) import its files", async () => {
    const code = "import { exp } from './math.ts';\nexport const e = exp(1);";
    expect(await ruleIds(code, 'src/engine/__fixture__.test.ts')).toEqual([]);
    const data = "import { BENCH_LINES } from '../engine/ai.ts';\nexport const b = BENCH_LINES;";
    expect(await ruleIds(data, 'src/data/fixture.test.ts')).toEqual([]);
  });
});
