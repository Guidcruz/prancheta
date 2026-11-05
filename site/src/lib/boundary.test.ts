import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * What the site reads from outside site/ (docs/02-architecture.md, 3 "Site", and 5, "Fronteiras
 * verificadas pelo lint"; T-049): only the fixed list below. Adding a path is the architect's
 * decision, written in 3 first. ESLint does not parse the .astro files here, so this test reads
 * every source file of the site (.astro, .ts, .mjs, .js, .css, tests included), finds each
 * module it loads (static and dynamic imports, re-exports, `new URL(..., import.meta.url)`, CSS
 * `@import`) and resolves it. The engine itself is not on the list: the site reaches it only
 * through the shield generator, which reads `@engine` (the public API); astro.config.mjs only
 * points that alias at it (ALLOWED_ONLY_FROM).
 *
 * Reads through `fs` (`readFileSync(join(...))`, `existsSync`...) are not module loads, and this
 * scanner does not see them: a file of the site that reads from outside site/ that way is caught
 * only in review.
 */

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const site = join(repo, 'site');
/** This file: its examples of forbidden imports are not reads of the site. */
const self = fileURLToPath(import.meta.url);
// Joined at run time: the root eslint.config.js refuses a literal path to an engine file.
const ENGINE = ['app', 'src', 'engine'].join('/');

/** The fixed list of 3 "Site" (paths from the repository root; `*` = any file name). */
const ALLOWED = [
  'config/prancheta.config.ts',
  'docs/roadmap.md',
  'app/src/tokens.css',
  'design/tokens.json',
  'app/src/data/*.json',
  'app/src/lib/generators/shield.ts',
];

/** Paths of 3 "Site" that only the files listed with them may read. */
const ALLOWED_ONLY_FROM: Record<string, readonly string[]> = {
  // The target of the `@engine` alias, for the shield generator to resolve; no other file of the
  // site reads the engine.
  'app/src/engine/index.ts': ['site/astro.config.mjs'],
};

/** Aliases of the repository: a bare `@engine`, `@config` or `@lib` is outside site/ too. */
const REPO_ALIASES = ['@engine', '@config', '@lib'];

const SOURCE = /\.(astro|ts|mjs|js|css)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', 'public']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) out.push(...sourceFiles(path));
    } else if (SOURCE.test(name) && path !== self) {
      out.push(path);
    }
  }
  return out;
}

/** The module specifiers a source file loads. */
function specifiers(code: string): string[] {
  const patterns = [
    /\bimport\s+(?:type\s+)?[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g, // import x from '...'
    /\bexport\s+(?:type\s+)?[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g, // export x from '...'
    /\bimport\s*['"]([^'"]+)['"]/g, // import '...'
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g, // import('...')
    /\bnew\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g, // new URL('...', import.meta.url)
    /@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g, // CSS @import
  ];
  const found = new Set<string>();
  for (const pattern of patterns) for (const m of code.matchAll(pattern)) found.add(m[1]!);
  return [...found];
}

/** The repository path a specifier of `file` reaches outside site/, or undefined if inside. */
function outsidePath(file: string, specifier: string): string | undefined {
  if (REPO_ALIASES.some((a) => specifier === a || specifier.startsWith(`${a}/`))) {
    return specifier;
  }
  if (!specifier.startsWith('.')) return undefined; // a package (astro, @fontsource/..., node:*)
  const bare = specifier.replace(/[?#].*$/, '');
  let target = resolve(dirname(file), bare);
  if (!existsSync(target) || statSync(target).isDirectory()) {
    const withExt = ['.ts', '.mjs', '.js', '.json'].map((e) => target + e).find(existsSync);
    if (withExt !== undefined) target = withExt;
  }
  const fromSite = relative(site, target);
  if (!fromSite.startsWith('..')) return undefined;
  return relative(repo, target).split(sep).join('/');
}

function allowed(path: string): boolean {
  return ALLOWED.some((entry) =>
    entry.includes('*')
      ? new RegExp(`^${entry.replace(/[.]/g, '\\.').replace('*', '[^/]+')}$`).test(path)
      : entry === path,
  );
}

/** Every path outside site/ that the site loads, with the files that load it. */
function outsideReads(): Map<string, Set<string>> {
  const reads = new Map<string, Set<string>>();
  for (const file of sourceFiles(site)) {
    const code = readFileSync(file, 'utf8');
    for (const spec of specifiers(code)) {
      const path = outsidePath(file, spec);
      if (path === undefined) continue;
      const by = reads.get(path) ?? new Set<string>();
      by.add(relative(repo, file).split(sep).join('/'));
      reads.set(path, by);
    }
  }
  return reads;
}

describe('what the site reads from outside site/ (T-049)', () => {
  const reads = outsideReads();

  it('is only the fixed list of 3 "Site"', () => {
    const extra: string[] = [];
    for (const [path, by] of reads) {
      if (allowed(path)) continue;
      const only = ALLOWED_ONLY_FROM[path];
      if (only !== undefined && [...by].every((f) => only.includes(f))) continue;
      extra.push(`${path} (read by ${[...by].join(', ')})`);
    }
    expect(extra).toEqual([]);
  });

  it('finds what the site really reads (the scanner works)', () => {
    for (const path of [
      'config/prancheta.config.ts',
      'docs/roadmap.md',
      'app/src/tokens.css',
      'design/tokens.json',
      'app/src/data/clubs.serie-a.json',
      'app/src/lib/generators/shield.ts',
    ]) {
      expect(reads.has(path), path).toBe(true);
    }
  });

  it('flags an engine file, a repository alias and any other app/ file', () => {
    const file = join(site, 'src/components/Fixture.astro');
    const code = [
      `import { Rng } from '../../../${ENGINE}/rng.ts';`,
      "import type { ClubDef } from '@engine';",
      "import { t } from '../../../app/src/lib/i18n';",
      "const m = await import('../../../app/src/params/match.json');",
      "@import '../../../app/src/app.css';",
      "import { config } from '../../../config/prancheta.config.ts';",
      "import Base from '../layouts/Base.astro';",
      "import '@fontsource/barlow/400.css';",
    ].join('\n');
    const paths = specifiers(code)
      .map((s) => outsidePath(file, s))
      .filter((p) => p !== undefined);
    expect(paths.filter((p) => !allowed(p)).sort()).toEqual(
      [
        '@engine',
        'app/src/app.css',
        `${ENGINE}/rng.ts`,
        'app/src/lib/i18n.ts',
        'app/src/params/match.json',
      ].sort(),
    );
    expect(paths.filter(allowed)).toEqual(['config/prancheta.config.ts']);
  });
});
