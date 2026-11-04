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
      'no-restricted-syntax': ['error', exponentOperator],
      'no-restricted-imports': ['error', { patterns: engineImportPatterns }],
      'prancheta/relative-ts-imports': 'error',
    },
  },
  {
    // The single home of transcendental functions.
    files: ['src/engine/math.ts'],
    rules: {
      'no-restricted-properties': ['error', ...randomAndClock],
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Engine tests and test helpers run only in Vitest (Node): they may read files, spawn Node
    // and use any math, but stay free of the clock and Math.random.
    files: ['src/engine/**/*.test.ts', 'src/engine/testing/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...engineGlobals.filter((g) => g !== 'process')],
      'no-restricted-properties': ['error', ...randomAndClock],
      'no-restricted-syntax': 'off',
      'no-restricted-imports': [
        'error',
        { patterns: engineImportPatterns.filter((p) => !p.group.includes('node:*')) },
      ],
    },
  },
  {
    files: ['src/lib/**/*.{ts,svelte}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/ui/**'], message: 'lib/ does not import ui/.' }] },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,svelte}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/save/**', '@lib/save/*'],
              message: 'ui/ reaches saves only through lib/career.',
            },
          ],
        },
      ],
    },
  },
];
