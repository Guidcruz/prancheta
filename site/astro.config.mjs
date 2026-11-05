import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { satteri } from '@astrojs/markdown-satteri';
import { tableScroll } from './src/hast-table-scroll.mjs';
import { config } from '../config/prancheta.config.ts';

export default defineConfig({
  site: `https://${config.domain}`,
  base: config.paths.site,
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: { processor: satteri({ hastPlugins: [tableScroll] }) },
  integrations: [sitemap()],
  vite: {
    resolve: {
      // The shield generator reads the engine's types through `@engine`, the public API only
      // (docs/02-architecture.md, 4.1); used at build time only.
      alias: { '@engine': fileURLToPath(new URL('../app/src/engine/index.ts', import.meta.url)) },
    },
  },
});
