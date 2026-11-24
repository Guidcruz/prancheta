import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Proves that the boundary of the chunks of the match in app/eslint.config.js catches a static
 * import of the match screen or of the 2D pitch, lets types cross and lets the loaders pass
 * (docs/02-architecture.md, 4.7). The code is linted as if it were a file of ui/, without
 * touching the disk.
 */
const appDir = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: appDir });

async function ruleIds(code: string, file: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${appDir}${file}` });
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message);
}

describe('the boundary of the chunks of the match (lint)', () => {
  it('refuses a static import of the screen or of the pitch outside their chunks', async () => {
    for (const code of [
      "import MatchScreen from './screens/MatchScreen.svelte';\nexport const x = MatchScreen;",
      "import { choreograph } from './match/pitch/scene';\nexport const x = choreograph;",
      "import MatchPitch from './components/MatchPitch.svelte';\nexport const x = MatchPitch;",
      "import T from './components/PitchTag.svelte';\nexport const x = T;",
    ]) {
      expect(await ruleIds(code, 'src/ui/__fixture__.ts'), code).toContain('no-restricted-imports');
    }
  });

  it('lets types cross and the import() of the loaders pass', async () => {
    const code = [
      "import type { FinishOutcome } from './screens/MatchScreen.svelte';",
      "import type { PitchScene } from './match/pitch/scene';",
      "import type { PitchTagView } from './components/PitchTag.svelte';",
      "export const load = () => import('./screens/MatchScreen.svelte');",
      "export const pitch = () => import('./match/pitch/pitch-chunk.ts');",
      'export type T = [FinishOutcome, PitchScene, PitchTagView];',
    ].join('\n');
    expect(await ruleIds(code, 'src/ui/__fixture__.ts')).toEqual([]);
  });

  it('lets the files of the pitch chunk import each other', async () => {
    const code = "import { PITCH_MOTION } from './motion';\nexport const m = PITCH_MOTION;";
    expect(await ruleIds(code, 'src/ui/match/pitch/__fixture__.ts')).toEqual([]);
  });
});
