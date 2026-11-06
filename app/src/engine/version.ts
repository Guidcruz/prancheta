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
// 7: T-012 reviewed (docs/design/ia-clubes.md, "Pedido ao developer" 6; partida.md, 8): rule 2
//    at minutes 60, 70 and 80, rule 3 swaps an AM or ST, the AI decides in the second half's added
//    time, commands with `added`, the `skip` talk, ai.subEnergy 85; the match goldens changed.
// 8: the rounds (T-013): the state gains `lastSheets` and `seasonStats` (the new-game golden
//    changed), and the displayed strength without a lineup reads the last sheet.
// 9: T-013 reviewed: `MatchResult.conceded` (the match goldens gain the field, nothing else in
//    them changed), the tie-break draw has the season in its label, the facts follow the cadence
//    of temporada.md (milestones, run ends), and the displayed strength replaces the unavailable
//    starters of the last sheet as the kick-off does; the round goldens changed.
// 10: between rounds (T-014): the morale of the round (result, bench, drift towards the fans),
//    the form, `benchStreak`, the fans thermometer of every club (`fans`, `idolBenchStreak`,
//    `fanDecisions`) and the simplified realism; the morale moves the strength of the next
//    rounds, so the round goldens changed (the match goldens did not).
// 11: the T-016 calibration (balance-log.md, the CEO's decisions of 2026-11-05): "tudo no ataque"
//    becomes the parameters match.allOutPower 1.25 and match.allOutDef 0.78 (was 1.10 and 0.85),
//    and the test parameters follow app/src/params/ (baseChance 0.087, kChance 0.125,
//    comfortableLeadPower 0.85, cards.bookedMult 0.20, fans.reversion 0.10); the match (but the
//    derby), round and season goldens changed, and the new-game digest (it holds the version).
// 12: the end of the season (T-017): the state gains `pastSeasons` (empty in a new game), so the
//    new-game golden and the digests of the round goldens changed (nothing else in them did);
//    `endSeason` and `startNextSeason` add the golden of the season turn. Still unpublished, the
//    turn then rounds the morale to 2 decimals (BUG-A of T-017), so only the season-turn digest
//    changed and that golden was written again at 12.
// 13: the round's report leaves the state (T-049; docs/02-architecture.md, 4.1, "Relatório da
//    rodada fora do estado"): `GameState.lastRound` is gone, `playRound` still returns the whole
//    `RoundReport`, and `roundRecap` and `matchSheet` give the lean forms the application keeps.
//    The simulation is the same (the match goldens kept their data, the scores and the events of
//    the round goldens too): only the digests of the states changed, those of the round goldens
//    (no report inside) and those of new-game and season-turn (they hold the version).
// 14: only Brazilians in the generation (T-069; jogadores.md, "Nacionalidade", decision 9 of the
//    2026-11-05 audit): HOME_NATIONALITY_SHARE goes from 0.9 to 1, and the nationality draw is
//    still consumed, so the squad's Rng sequence, the strengths, the matches and the tables are
//    the same. Only the players' nationality and identity (the names and faces are asked per
//    nationality, and the BR group is bigger) changed in new-game, and the digests of the states.
// 15: the minimal renewal of the squads (T-048; decision 14 of balance-targets.md, option b,
//    revised by the CEO on 2026-11-06): in endSeason, from 33 a player may retire by a draw by
//    age (lower for goalkeepers) and at 40 he always does (out of the squad, out of `players` at
//    the turn); a youth of 17 of the same position comes up from the academy
//    (`generateAcademy`, ids `${clubId}#${100 × t + k}`), a club whose idol retired picks a new
//    one, and the campaign lists `farewells` and `academy`. Only the season-turn golden changed
//    in its data (the renewal, the strengths of season 2 and the digest). The digests of
//    new-game, round-first, season-full and season-human-simplified changed only because the
//    states hold `engineVersion`; the other goldens only carry the version.
export const ENGINE_VERSION = 15;
