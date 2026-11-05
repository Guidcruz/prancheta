import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Proves that the root eslint.config.js keeps scripts/, site/ and server/ on the engine's public
 * API (docs/02-architecture.md, 4.1, "Fronteira do `index.ts`", and 5; T-049): only
 * app/src/engine/index.ts or `@engine` without a subpath. The code is linted as if it were a file
 * of each folder, without touching the disk.
 */
const root = fileURLToPath(new URL('../', import.meta.url));
// Joined at run time: this file is linted by the same config, which refuses the literal path.
const ENGINE = ['app', 'src', 'engine'].join('/');
const eslint = new ESLint({ cwd: root });

async function ruleIds(code: string, file: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${root}${file}` });
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message);
}

describe('engine front door outside app/', () => {
  it.each([
    ['scripts/', 'scripts/balance/fixture.ts', `import { exp } from '../../${ENGINE}/math.ts';`],
    ['scripts/ (.mjs)', 'scripts/fixture.mjs', `import { Rng } from '../${ENGINE}/rng.ts';`],
    ['a test of scripts/', 'scripts/balance/fixture.test.ts', `import '../../${ENGINE}/round.ts';`],
    ['site/ (alias)', 'site/src/lib/fixture.ts', "import type { ClubDef } from '@engine/clubs';"],
    ['site/ (path)', 'site/src/lib/fixture.ts', `import '../../../${ENGINE}/clubs.ts';`],
    ['server/', 'server/src/fixture.ts', `import { playRound } from '../../${ENGINE}/round.ts';`],
  ])('refuses an engine file in %s', async (_label, file, code) => {
    expect(await ruleIds(code, file)).toContain('no-restricted-imports');
  });

  it('refuses a path to an engine file in a string, as for a computed dynamic import', async () => {
    const code = `const m = await import(url('${ENGINE}/rng.ts'));`;
    expect(await ruleIds(code, 'scripts/fixture.mjs')).toContain('no-restricted-syntax');
    const template = 'const f = `${root}/' + ENGINE + '/math.ts`;';
    expect(await ruleIds(template, 'scripts/fixture.mjs')).toContain('no-restricted-syntax');
  });

  it.each([
    ['scripts/', 'scripts/balance/fixture.ts', `import { exp } from '../../${ENGINE}/index.ts';`],
    [
      'scripts/ (dynamic)',
      'scripts/fixture.mjs',
      `const m = await import(url('${ENGINE}/index.ts'));`,
    ],
    ['site/', 'site/src/lib/fixture.ts', "import type { ClubDef } from '@engine';"],
    ['server/', 'server/src/fixture.ts', `import { playRound } from '../../${ENGINE}/index.ts';`],
  ])('accepts the public API in %s', async (_label, file, code) => {
    expect(await ruleIds(code, file)).toEqual([]);
  });
});
