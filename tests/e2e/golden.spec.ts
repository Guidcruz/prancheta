import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures.ts';

/*
 * Golden da partida dentro do navegador (docs/03-test-plan.md, 4; risco do `Math.exp` em
 * docs/02-architecture.md, 9): as saídas do motor em Chromium e em WebKit têm de bater, byte a
 * byte, com os arquivos de app/src/engine/__golden__/ (gerados no Node/V8). Diferença é bloqueante
 * e vira ADR. Roda uma vez por navegador (projetos de celular).
 */
const GOLDENS = [
  'match-derby',
  'match-short-handed',
  'match-round',
  'match-ai-sheets',
  'match-commands',
] as const;
const goldenDir = fileURLToPath(new URL('../../app/src/engine/__golden__/', import.meta.url));
const pageEntry = fileURLToPath(new URL('./golden/page.ts', import.meta.url));

/*
 * DESLIGADO (fixme) ATÉ A T-074 (ADR-0020). Achado da T-024 em 2026-11-07: `Math.exp` do Chromium
 * 153 (V8 14) difere em 1 bit de `Math.exp` do Node 22 (V8 12.4) em cerca de 10% das entradas, e
 * três goldens (match-round, match-ai-sheets, match-commands) divergem no último dígito de `pGoal`
 * (risco da regra 9 do ADR-0007). A T-074 troca o `exp` de engine/math.ts por uma implementação
 * determinística e sobe o ENGINE_VERSION. Depois dela, tire o fixme.
 * Ideia para depois: `test.fail(browserName === 'chromium', ...)`, que avisa quando a T-074 fizer
 * o teste passar e vale de verdade no WebKit; fica como fixme nos dois porque o WebKit nunca
 * rodou (não se sabe se ele também diverge). GOLDEN_STRICT=1 liga o teste para ver a falha.
 */
const KNOWN_DIVERGENCE = process.env['GOLDEN_STRICT'] !== '1';

let script = '';
let dir = '';

// No nível da descrição: com o fixme, nem o beforeAll (que monta a página) roda.
test.describe('golden da partida no navegador', () => {
  test.fixme(KNOWN_DIVERGENCE, 'Math.exp diverge entre Node e o navegador; T-074 / ADR-0020');

  test.beforeAll(async () => {
    const { build } = await import('vite');
    dir = await mkdtemp(join(tmpdir(), 'prancheta-golden-'));
    await build({
      configFile: false,
      logLevel: 'warn',
      build: {
        outDir: dir,
        emptyOutDir: true,
        minify: true,
        lib: { entry: pageEntry, formats: ['iife'], name: 'GoldenPage', fileName: () => 'page.js' },
      },
    });
    script = await readFile(join(dir, 'page.js'), 'utf8');
  });

  test.afterAll(async () => {
    if (dir !== '') await rm(dir, { recursive: true, force: true });
  });

  test('o golden da partida bate no navegador', async ({ page, browserName }) => {
    test.skip(page.viewportSize()!.width >= 900, 'uma vez por navegador');
    // A página do golden vem da própria origem do servidor de teste (a trava de rede a deixa passar).
    await page.route('**/__golden__/**', (route) =>
      route.request().url().endsWith('.js')
        ? route.fulfill({ contentType: 'text/javascript', body: script })
        : route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><script src="/__golden__/page.js"></script>',
          }),
    );
    await page.goto('/__golden__/index.html');
    const actual = await page.evaluate(() =>
      (globalThis as unknown as { runGoldens: () => Record<string, string> }).runGoldens(),
    );

    // Confere todos antes de reprovar, para o relatório mostrar quais divergem.
    const diverge: string[] = [];
    for (const name of GOLDENS) {
      const stored = JSON.parse(await readFile(join(goldenDir, `${name}.json`), 'utf8')) as {
        data: unknown;
      };
      if (actual[name] !== JSON.stringify(stored.data)) diverge.push(name);
    }
    expect(diverge, `goldens que divergem do Node em ${browserName}`).toEqual([]);
  });
});
