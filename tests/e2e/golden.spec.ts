import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures.ts';

/*
 * Golden do motor dentro do navegador (docs/03-test-plan.md, 4; ADR-0020, teste 6): as saídas do
 * motor em Chromium e em WebKit têm de bater, byte a byte, com os arquivos de
 * app/src/engine/__golden__/ (gerados no Node). São os 5 goldens de partida e a tabela da `exp`
 * (`exp-table`, os bits da `exp` do motor em 4.096 entradas). Diferença é bloqueante: não existe
 * fixme nem quarentena para este teste. Roda uma vez por navegador (projetos de celular).
 *
 * Histórico: na T-024 (2026-11-07) o `Math.exp` do Chromium 153 diferia do Node 22 no último bit
 * em cerca de 10% das entradas, e três goldens de partida divergiam (risco da regra 9 do
 * ADR-0007). Desde a T-074 (ADR-0020, ENGINE_VERSION 16) a `exp` de engine/math.ts é um port do
 * fdlibm só com aritmética, igual bit a bit em qualquer motor IEEE-754; se este teste reprovar,
 * a causa é um uso novo de função transcendente ou um erro no port, nunca o navegador.
 */
const GOLDENS = [
  'match-derby',
  'match-short-handed',
  'match-round',
  'match-ai-sheets',
  'match-commands',
  'exp-table',
] as const;
const goldenDir = fileURLToPath(new URL('../../app/src/engine/__golden__/', import.meta.url));
const pageEntry = fileURLToPath(new URL('./golden/page.ts', import.meta.url));

let script = '';
let dir = '';

test.describe('golden do motor no navegador', () => {
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

  test('os goldens da partida e da exp batem no navegador', async ({ page, browserName }) => {
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

    // A página roda exatamente os goldens listados: um caso novo não entra sem conferência.
    expect(Object.keys(actual).sort(), 'goldens da página').toEqual([...GOLDENS].sort());

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
