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
