import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { config } from '../config/prancheta.config.ts';

const base = config.paths.game.endsWith('/') ? config.paths.game : `${config.paths.game}/`;

export default defineConfig({
  base,
  // Only PRANCHETA_ENV reaches the bundle (app/src/env.d.ts): `test` picks the separate save
  // database `prancheta-test` (docs/03-test-plan.md, 3). In any other build the comparison folds
  // to a constant and the test name is not in the output.
  define: { __PRANCHETA_ENV__: JSON.stringify(process.env.PRANCHETA_ENV ?? '') },
  resolve: {
    alias: {
      '@config': fileURLToPath(new URL('../config/prancheta.config.ts', import.meta.url)),
      // The engine's public API only (docs/02-architecture.md, 4.1): `@engine/<file>` does not resolve.
      '@engine': fileURLToPath(new URL('./src/engine/index.ts', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  plugins: [
    {
      name: 'prancheta-html',
      transformIndexHtml: (html) =>
        html
          .replace('%NAME%', config.name)
          .replace('%LANG%', config.languages[0])
          .replace('%THEME%', config.colors.background),
    },
    svelte(),
    VitePWA({
      registerType: 'autoUpdate', // até a tela de 'nova versão' existir (Etapa 1a)
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: config.name,
        short_name: config.shortName,
        description: config.slogan['pt-BR'],
        lang: config.languages[0],
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: config.colors.background,
        theme_color: config.colors.background,
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', '../site/src/**/*.test.ts', '../scripts/**/*.test.ts'],
    environment: 'node',
  },
});
