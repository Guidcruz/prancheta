import tseslint from 'typescript-eslint';
import { engineEntryOnly } from './app/eslint.engine-entry.js';

/*
 * Import boundaries of the code outside app/ (docs/02-architecture.md, 5, "Fronteiras verificadas
 * pelo lint"; T-049). app/ has its own config (app/eslint.config.js), and so will server/ from
 * Etapa 1b (all three share `engineEntryOnly`, app/eslint.engine-entry.js); this one covers
 * scripts/ and site/, and server/ until it has its own. It checks only the boundary: scripts/ and site/ import the engine only from
 * app/src/engine/index.ts or `@engine`. The .astro files and the list of what the site reads from
 * outside site/ are checked by site/src/lib/boundary.test.ts, which reads every file of the site.
 * scripts/boundary.test.ts proves that this config catches the violation.
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      // app/ has its own config; docs/ holds prototypes of the art (not project code).
      'app/**',
      'docs/**',
      'site/.astro/**',
      'site/public/**',
      'server/.wrangler/**',
    ],
  },
  {
    files: ['scripts/**/*.{ts,mjs,js}', 'site/**/*.{ts,mjs,js}', 'server/**/*.{ts,mjs,js}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    // Only the boundary is checked here: directives for other rules are not this config's job.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-restricted-imports': ['error', { patterns: [engineEntryOnly] }],
      // Scripts also load modules by a computed path (`import(url('app/src/engine/...'))`, as
      // scripts/og.mjs did), which no-restricted-imports cannot see: a string with a path to an
      // engine file other than index.ts, or to the engine folder itself (to be joined with a file
      // name, `resolve(root, 'app/src/engine', 'rng.ts')`), is refused too.
      'no-restricted-syntax': [
        'error',
        {
          selector: String.raw`Literal[value=/app\/src\/engine(?!\/index\.ts$)(\/|$)/]`,
          message: engineEntryOnly.message,
        },
        {
          selector: String.raw`TemplateElement[value.raw=/app\/src\/engine(?!\/index\.ts$)(\/|$)/]`,
          message: engineEntryOnly.message,
        },
      ],
    },
  },
];
