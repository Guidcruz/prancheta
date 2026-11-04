import type { APIRoute } from 'astro';
import { config } from '../../../config/prancheta.config.ts';

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: https://${config.domain}/sitemap-index.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
