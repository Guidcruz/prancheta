import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

export default [
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  { files: ['**/*.svelte'], languageOptions: { parserOptions: { parser: tseslint.parser } } },
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      // The engine must be deterministic and free of the DOM.
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'Date',
        'performance',
        'crypto',
        'fetch',
        'setTimeout',
        'setInterval',
        'requestAnimationFrame',
        'self',
        'globalThis',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Rng from @engine/rng.' },
        {
          object: 'Date',
          property: 'now',
          message: 'The engine has no clock; time comes from the state.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/ui/**',
            '**/lib/**',
            '@lib/*',
            '**/content/**',
            'svelte',
            'svelte/*',
            'idb',
          ],
        },
      ],
    },
  },
];
