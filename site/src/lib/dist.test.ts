import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../../config/prancheta.config';

// Walks the built site (site/dist). Skipped when the site was not built yet,
// unless REQUIRE_SITE_DIST=1 (then a missing build is a failure).
const dist = fileURLToPath(new URL('../../dist', import.meta.url));
const built = existsSync(join(dist, 'index.html'));
const run = built || process.env['REQUIRE_SITE_DIST'] === '1' ? describe : describe.skip;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const own = `https://${config.domain}`;
const allowedPrefixes = [
  own,
  'http://www.w3.org/', // SVG/XHTML namespaces, not requests
  'http://www.sitemaps.org/',
  'http://www.google.com/schemas/', // sitemap namespaces, not requests
  config.contacts.repository,
  config.contacts.discussionsUrl,
].filter((x): x is string => typeof x === 'string' && x !== '');

run('built site (site/dist)', () => {
  const files = built ? walk(dist) : [];
  const pages = files.filter((f) => f.endsWith('.html'));
  const text = files.filter((f) => /\.(html|css|xml|txt)$/.test(f));

  it('has every expected page', () => {
    for (const p of [
      '',
      'o-jogo',
      'modos',
      'clubes',
      'perguntas',
      'roadmap',
      'devlog',
      'apoiar',
      'privacidade',
    ]) {
      expect(existsSync(join(dist, p, 'index.html')), p).toBe(true);
    }
  });

  it('keeps a space before and after inline elements', () => {
    const tags = 'a|strong|em|b|i|span|code|abbr|mark|small|time|cite|q|kbd';
    const glued = new RegExp(`[\\p{L}\\p{N}]<(?:${tags})[\\s>]|</(?:${tags})>[\\p{L}\\p{N}]`, 'u');
    const bad = pages.filter((f) => glued.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('ships no <script> in any page', () => {
    const bad = pages.filter((f) => /<script\b/i.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('does not touch cookies or web storage', () => {
    const bad = text.filter((f) =>
      /document\.cookie|localStorage|sessionStorage|indexedDB|set-cookie/i.test(
        readFileSync(f, 'utf8'),
      ),
    );
    expect(bad).toEqual([]);
  });

  it('has no analytics or third-party font hosts', () => {
    const bad = text.filter((f) =>
      /google-analytics|googletagmanager|gtag\(|plausible|fonts\.googleapis|fonts\.gstatic|cloudflareinsights|hotjar|facebook\.net/i.test(
        readFileSync(f, 'utf8'),
      ),
    );
    expect(bad).toEqual([]);
  });

  it('only references allowed external URLs', () => {
    const offenders: string[] = [];
    for (const f of text) {
      for (const m of readFileSync(f, 'utf8').matchAll(/https?:\/\/[^\s"'<>)]+/g)) {
        const url = m[0];
        if (!allowedPrefixes.some((a) => url.startsWith(a))) offenders.push(`${f}: ${url}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('loads no remote resources (src/link href/@import/url())', () => {
    const offenders: string[] = [];
    for (const f of pages) {
      const h = readFileSync(f, 'utf8');
      for (const m of h.matchAll(
        /<(?:img|iframe|link|source|video|audio)\b[^>]*(?:src|href)="(https?:[^"]+)"/g,
      )) {
        const url = m[1] ?? '';
        if (
          !(m[0].startsWith('<link') && m[0].includes('rel="canonical"') && url.startsWith(own)) &&
          !(m[0].includes('rel="alternate"') && url.startsWith(own))
        ) {
          offenders.push(`${f}: ${url}`);
        }
      }
    }
    for (const f of files.filter((x) => x.endsWith('.css'))) {
      if (/@import\s+(url\()?["']?https?:|url\(\s*["']?https?:/i.test(readFileSync(f, 'utf8')))
        offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it('never says "Brasileirão" (CEO decision: "Série A"; BUG-SITE-001)', () => {
    const bad = pages.filter((f) => /brasileir(ão|ao)/i.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('keeps internal ADR numbers and infra jargon out of the public pages', () => {
    const bad = pages.filter((f) =>
      /\bADR-\d+|Durable Objects|\bWorkers\b|\bD1\b/.test(readFileSync(f, 'utf8')),
    );
    expect(bad).toEqual([]);
  });

  it('has one h1, a skip link, a main, lang and canonical per page', () => {
    for (const f of pages) {
      const h = readFileSync(f, 'utf8');
      expect(h.match(/<h1\b/g)?.length, `${f} h1`).toBe(1);
      expect(h, `${f} skip`).toMatch(/class="skip/);
      expect(h.match(/<main\b/g)?.length, `${f} main`).toBe(1);
      expect(h, `${f} lang`).toMatch(/<html lang="pt-BR"/);
      expect(h, `${f} canonical`).toMatch(new RegExp(`<link rel="canonical" href="${own}/`));
    }
  });

  it('wraps every table in a focusable scroll region', () => {
    for (const f of pages) {
      const h = readFileSync(f, 'utf8');
      const tables = h.match(/<table\b/g)?.length ?? 0;
      const regions =
        h.match(/role="region"[^>]*aria-label="[^"]*tabela com rolagem/g)?.length ?? 0;
      expect(regions, f).toBeGreaterThanOrEqual(tables);
    }
  });

  it('has an og:image on every page, pointing to an existing file in dist/og', () => {
    for (const f of pages) {
      const h = readFileSync(f, 'utf8');
      const m = h.match(/<meta property="og:image" content="([^"]+)"/);
      expect(m, `${f} og:image`).not.toBeNull();
      const url = m?.[1] ?? '';
      expect(url.startsWith(`${own}/og/`), `${f} ${url}`).toBe(true);
      expect(existsSync(join(dist, url.slice(own.length))), `${f} ${url}`).toBe(true);
      expect(h, `${f} twitter:image`).toContain(`<meta name="twitter:image" content="${url}"`);
    }
  });

  it('has a sitemap listing every page and a robots.txt pointing to it', () => {
    const sm = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
    for (const f of pages) {
      const rel = f.slice(dist.length).replace(/index\.html$/, '');
      expect(sm, rel).toContain(`<loc>${own}${rel}</loc>`);
    }
    expect(readFileSync(join(dist, 'robots.txt'), 'utf8')).toContain(
      `Sitemap: ${own}/sitemap-index.xml`,
    );
  });

  it('has no dead internal links', () => {
    const dead: string[] = [];
    for (const f of pages) {
      for (const m of readFileSync(f, 'utf8').matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
        const u = m[1] ?? '';
        if (u.startsWith('/jogo')) continue; // the game is built separately
        const t = join(dist, u);
        if (!(existsSync(t) && (statSync(t).isFile() || existsSync(join(t, 'index.html')))))
          dead.push(`${f}: ${u}`);
      }
    }
    expect(dead).toEqual([]);
  });
});
