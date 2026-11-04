/**
 * Version of the simulation algorithm (ADR-0007, rule 7).
 *
 * Bump it in the same PR whenever any golden output in `__golden__/` changes, then run
 * `npm run golden:update -w app`. The golden check fails while a stored golden was written by
 * another version, and the update refuses to overwrite a changed golden without a bump.
 */
export const ENGINE_VERSION = 1;
