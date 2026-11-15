import type { MatchMode } from '../../engine/index.ts';

/*
 * The mode the career sends to the engine for the coach's club (docs/02-architecture.md, 4.1,
 * "Partida assistida pela camada de carreira", item 3; CEO decision 2 of
 * docs/design/telas/partida.md, 2026-11-15). The player's mode says how he follows the match; the
 * engine's says who commands the club. Until T-033 the match screen has no commands, so the
 * assistant commands the coach's club in every mode (`'result'`: `controller: 'ai'`, profile
 * Traditional, rules 1 to 6 of the AI); without it, with `'full'` or `'highlights'` the club would
 * only make the injury substitution and the reserves would lose morale and minutes every round.
 * T-033 brings the commands and sends the mode untranslated again (this file goes away).
 */

const TO_ENGINE: Readonly<Record<MatchMode, MatchMode>> = {
  full: 'result',
  highlights: 'result',
  result: 'result',
};

/** The mode the engine gets for the coach's club, for the mode the player follows the match in. */
export function engineMatchMode(mode: MatchMode): MatchMode {
  return TO_ENGINE[mode];
}
