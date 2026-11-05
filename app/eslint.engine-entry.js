/**
 * The engine's front door (docs/02-architecture.md, 4.1, "Fronteira do `index.ts`", and 5;
 * T-049; ADR-0019): outside app/src/engine/ the engine is imported only from
 * app/src/engine/index.ts (by a relative path) or `@engine` without a subpath, never one of its
 * files. Tests outside the engine follow the same rule (the tests of app/src/data/ are the one
 * exception, in app/eslint.config.js); only the engine's own files, tests included, import its
 * internals.
 *
 * A module with no dependencies, so that app/eslint.config.js, the root eslint.config.js
 * (scripts/, site/) and, from Etapa 1b, server/eslint.config.js share the same pattern without
 * loading one another.
 */
export const engineEntryOnly = {
  group: ['**/engine/**', '!**/engine/index.ts', '@engine/**'],
  message:
    'Outside the engine, import it only from app/src/engine/index.ts or "@engine" (docs/02-architecture.md, 4.1).',
};
