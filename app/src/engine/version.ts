/**
 * Version of the simulation algorithm (ADR-0007, rule 7).
 *
 * Bump it in the same PR whenever any golden output in `__golden__/` changes, then run
 * `npm run golden:update -w app`. The golden check fails while a stored golden was written by
 * another version, and the update refuses to overwrite a changed golden without a bump.
 */
// 2: newGame also generates the season calendar (T-007), so the new-game golden changed.
// 3: ClubDef gains the crest fields (crestShape, crestPattern, crestBase, crestSymbol), which are
//    part of the club definitions in the state digest; the simulation itself did not change.
export const ENGINE_VERSION = 3;
