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
// 4: the initial squad starts with clubAppearances = 1 (only the youth at 0), and the match
//    (T-009) applies the home advantage to the shot and the goalkeeper; new-game and match
//    goldens changed.
// 5: the match (T-010) draws the chance kind (penalties, direct free kicks), cards and injuries
//    every minute, and ends a match with fewer than 7 on one side; the match goldens changed.
// 6: the match (T-012) takes the coach's commands and plays the AI's in-match rules (injury and
//    fatigue substitutions, going for the result, "todo mundo no ataque", "segurar o resultado"),
//    so the match goldens changed.
export const ENGINE_VERSION = 6;
