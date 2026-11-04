import { defineConfig } from 'astro/config';
import { config } from '../config/prancheta.config.ts';

export default defineConfig({
  site: `https://${config.domain}`,
  base: config.paths.site,
  trailingSlash: 'always',
  build: { format: 'directory' },
});
