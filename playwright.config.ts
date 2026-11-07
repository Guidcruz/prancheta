import { defineConfig, devices } from '@playwright/test';

/*
 * E2E do Prancheta (T-024; docs/03-test-plan.md, 3). Só roda com PRANCHETA_ENV=test: o servidor
 * serve o build de teste (app/dist-e2e/, banco `prancheta-test`), nunca o dist/ publicado.
 *   PRANCHETA_ENV=test npm run test:e2e
 * Localmente, só Chromium e com um navegador já instalado (PRANCHETA_CHROMIUM=<caminho>):
 *   --project=chromium-mobile --project=chromium-desktop
 */
if (process.env.PRANCHETA_ENV !== 'test') {
  throw new Error(
    'E2E só roda com PRANCHETA_ENV=test (build de teste, banco prancheta-test). Use: PRANCHETA_ENV=test npm run test:e2e',
  );
}

const PORT = 4173;
const ci = process.env.CI !== undefined && process.env.CI !== '';
// Um Chromium já instalado (o Playwright 1.65 espera a revisão própria dele); só vale para o Chromium.
const chromiumPath = process.env.PRANCHETA_CHROMIUM;
const chromiumLaunch = chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {};

const mobile = { viewport: { width: 390, height: 844 }, hasTouch: true };
const desktop = { viewport: { width: 1280, height: 800 } };

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',
  // Cada teste tem um BrowserContext novo (IndexedDB vazio): sem ordem entre testes.
  fullyParallel: true,
  workers: ci ? 2 : 1,
  forbidOnly: ci,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Service worker só no spec de PWA offline (T-039).
    serviceWorkers: 'block',
    locale: 'pt-BR',
    // Sem trace, captura nem vídeo por padrão (quem investiga liga com --trace on).
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['Desktop Chrome'], ...mobile, ...chromiumLaunch },
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], ...desktop, ...chromiumLaunch },
    },
    { name: 'webkit-mobile', use: { ...devices['Desktop Safari'], ...mobile } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], ...desktop } },
  ],
  webServer: {
    // Build de teste (sai em app/dist-e2e/) e servidor só dele, em 127.0.0.1.
    command: `node scripts/icons.mjs && npm run build -w app && npm run preview -w app -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/jogo/`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PRANCHETA_ENV: 'test' },
  },
});
