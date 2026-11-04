import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { config } from '../config/prancheta.config.ts';

export default defineConfig({
  site: `https://${config.domain}`,
  base: config.paths.site,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
  vite: {
    resolve: {
      // The shield generator imports the engine's Rng; used at build time only.
      alias: { '@engine': fileURLToPath(new URL('../app/src/engine', import.meta.url)) },
    },
  },
});
