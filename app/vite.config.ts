import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { config } from '../config/prancheta.config.ts';

const base = config.paths.game.endsWith('/') ? config.paths.game : `${config.paths.game}/`;

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@config': fileURLToPath(new URL('../config/prancheta.config.ts', import.meta.url)),
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
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
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
