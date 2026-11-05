import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

/*
 * Boundaries (docs/02-architecture.md, 5; ADR-0007). app/src/engine/boundary.test.ts proves
 * that each engine rule below catches its violation.
 */

/** Local rules of the project. */
const prancheta = {
  rules: {
    // The engine runs in Node without a build step (ADR-0007, rule 6): relative imports must
    // name the real `.ts` file, because Node does not resolve extensionless or `.js` specifiers.
    'relative-ts-imports': {
      meta: {
        type: 'problem',
        docs: { description: 'Relative imports inside the engine must end in ".ts".' },
        messages: {
          extension:
            'Engine imports must be relative with the ".ts" extension ("{{source}}"), so Node runs it without a build.',
        },
        schema: [],
      },
      create(context) {
        const check = (node) => {
          const source = node.source;
          if (!source || source.type !== 'Literal' || typeof source.value !== 'string') return;
          const value = source.value;
          if (value.startsWith('.') && !value.endsWith('.ts')) {
            context.report({ node: source, messageId: 'extension', data: { source: value } });
          }
        };
        return {
          ImportDeclaration: check,
          ExportNamedDeclaration: check,
          ExportAllDeclaration: check,
          ImportExpression: check,
        };
      },
    },
  },
};

// Globals the engine must not touch: DOM, clock, locale, host environment.
const engineGlobals = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'Date',
  'Intl',
  'performance',
  'crypto',
  'fetch',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'self',
  'globalThis',
  'process',
];

const randomAndClock = [
  { object: 'Math', property: 'random', message: 'Use the seeded Rng from ./rng.ts.' },
  {
    object: 'Date',
    property: 'now',
    message: 'The engine has no clock; time comes from the state.',
  },
];

// Transcendental functions may differ in the last bit between JavaScript engines (ADR-0007,
// rule 9), so they are only called from engine/math.ts.
const transcendental = [
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
].map((property) => ({
  object: 'Math',
  property,
  message: 'Transcendental functions only through engine/math.ts (ADR-0007).',
}));

const exponentOperator = {
  selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
  message: 'Use engine/math.ts instead of ** (ADR-0007).',
};

// Locale-dependent string methods give different output per device, like Intl.
const localeCall = {
  selector:
    'CallExpression[callee.property.name=/^(localeCompare|toLocaleString|toLocaleDateString|toLocaleTimeString|toLocaleUpperCase|toLocaleLowerCase)$/]',
  message:
    'Locale-dependent methods are not deterministic across devices; compare/format outside the engine.',
};

const testingImports = {
  group: ['**/testing/**', '**/testing'],
  message:
    'engine/testing/ is test-only (node:fs, vitest); production engine code cannot import it.',
};

const engineImportPatterns = [
  {
    group: ['**/ui/**', '**/lib/**', '@lib/*', '**/content/**'],
    message: 'The engine does not import ui/, lib/ or content/.',
  },
  {
    group: ['**/params/**', '**/data/**', '@config'],
    message: 'Params, data and config enter the engine as arguments.',
  },
  {
    group: ['@engine', '@engine/*'],
    message: 'Inside the engine use relative imports with ".ts".',
  },
  {
    group: ['node:*'],
    message: 'The engine runs in the browser and in Workers: no node:* modules.',
  },
  { group: ['svelte', 'svelte/*', 'idb'], message: 'The engine has no UI or storage dependency.' },
];

/**
 * The engine's front door (docs/02-architecture.md, 4.1, "Fronteira do `index.ts`", and 5;
 * T-049): outside app/src/engine/ the engine is imported only from app/src/engine/index.ts (by a
 * relative path) or `@engine` without a subpath, never one of its files. Tests outside the engine
 * follow the same rule; only the engine's own files, tests included, import its internals. The
 * root eslint.config.js applies the same pattern to scripts/, site/ and server/.
 */
export const engineEntryOnly = {
  group: ['**/engine/**', '!**/engine/index.ts', '@engine/**'],
  message:
    'Outside the engine, import it only from app/src/engine/index.ts or "@engine" (docs/02-architecture.md, 4.1).',
};

const libPatterns = {
  noUi: { group: ['**/ui/**'], message: 'lib/ does not import ui/.' },
};

const uiPatterns = {
  noSave: {
    group: ['**/lib/save', '**/lib/save/**', '@lib/save', '@lib/save/*'],
    message: 'ui/ reaches saves only through lib/career.',
  },
};

// engine/testing/ pulls node:fs and vitest: production code of lib/ and ui/ never imports it.
const appTestingImports = {
  group: ['**/engine/testing', '**/engine/testing/**', '@engine/testing', '@engine/testing/*'],
  message: 'engine/testing/ is test-only; production code cannot import it.',
};

// Hashes, the blocklist and Node modules are build/CI tools: they never reach the browser bundle
// (names are screened by app/src/content/names/br.exclusions.json, indices only).
const appBuildOnlyImports = {
  group: ['**/data/name-exclusions*', '**/data/blocklist*', '**/*.sha256.json', 'node:*'],
  message:
    'Blocklist hashes and node:* are CI/build tools; production lib/ and ui/ must not import them.',
};

export default [
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  { files: ['**/*.svelte'], languageOptions: { parserOptions: { parser: tseslint.parser } } },
  {
    files: ['src/engine/**/*.ts'],
    plugins: { prancheta },
    rules: {
      // The engine must be deterministic, free of the DOM and runnable without a build.
      'no-restricted-globals': ['error', ...engineGlobals],
      'no-restricted-properties': ['error', ...randomAndClock, ...transcendental],
      'no-restricted-syntax': ['error', exponentOperator, localeCall],
      'no-restricted-imports': ['error', { patterns: [...engineImportPatterns, testingImports] }],
      'prancheta/relative-ts-imports': 'error',
    },
  },
  {
    // The single home of transcendental functions.
    files: ['src/engine/math.ts'],
    rules: {
      'no-restricted-properties': ['error', ...randomAndClock],
      'no-restricted-syntax': ['error', localeCall],
    },
  },
  {
    // Engine tests, benches and test helpers run only in Vitest (Node): they may read files,
    // spawn Node and use any math, but never Math.random, Date nor performance. The one clock
    // they reach is `process.hrtime`, which only the benches (*.bench.ts) use, to time the
    // engine; a test never depends on it.
    files: ['src/engine/**/*.test.ts', 'src/engine/**/*.bench.ts', 'src/engine/testing/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...engineGlobals.filter((g) => g !== 'process')],
      'no-restricted-properties': ['error', ...randomAndClock],
      'no-restricted-syntax': ['error', localeCall],
      'no-restricted-imports': [
        'error',
        { patterns: engineImportPatterns.filter((p) => !p.group.includes('node:*')) },
      ],
    },
  },
  {
    // Everything of app/src/ outside the engine (main.ts, the production code of data/) reaches
    // the engine only through its public API. The tests of data/ are the engine's acceptance
    // tests on the real clubs, which the engine cannot import (rule above): like the engine's own
    // tests, they use its internals and its test helpers.
    files: ['src/**/*.{ts,svelte}'],
    ignores: ['src/engine/**', 'src/data/**/*.test.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [engineEntryOnly] }] },
  },
  {
    files: ['src/lib/**/*.{ts,svelte}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [libPatterns.noUi, appTestingImports, appBuildOnlyImports, engineEntryOnly] },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,svelte}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [uiPatterns.noSave, appTestingImports, appBuildOnlyImports, engineEntryOnly],
        },
      ],
    },
  },
  {
    // Tests of lib/ and ui/ may use node:* and the build-only data; the engine only through its
    // public API, as in production (T-049).
    files: ['src/lib/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [libPatterns.noUi, engineEntryOnly] }],
    },
  },
  {
    files: ['src/ui/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [uiPatterns.noSave, engineEntryOnly] }],
    },
  },
];
