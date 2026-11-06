/*
 * Text that is safe to show (T-019, security review M2): every text of a save that reaches the
 * screen (the coach's nickname, club and player names, the variables of news and posts) and the
 * nickname typed on the new-game screen (US-014) pass this check. It refuses what can disguise or
 * break what is shown, never a letter of a language:
 *
 * - C0 and C1 controls and DEL (tab and line breaks included), the space being the only
 *   whitespace control allowed;
 * - invisible and direction marks: U+200B–U+200F (zero-width, LRM, RLM), U+202A–U+202E
 *   (embeddings and overrides, the RLO), U+2060–U+2069 (joiners and isolates) and U+FEFF;
 * - more than 2 combining marks in a row ("zalgo");
 * - text not in NFC (the same name in two byte forms) and lone surrogates.
 */

/** Combining marks allowed after one base character (Portuguese needs at most one). */
export const MAX_COMBINING_RUN = 2;

const FORBIDDEN = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/u;
const COMBINING_RUN = new RegExp(`\\p{M}{${MAX_COMBINING_RUN + 1}}`, 'u');

/** `true` when `text` can be shown as it is (see the rules above). Never throws. */
export function isSafeDisplayText(text: string): boolean {
  return (
    typeof text === 'string' &&
    text.isWellFormed() &&
    !FORBIDDEN.test(text) &&
    !COMBINING_RUN.test(text) &&
    text.normalize('NFC') === text
  );
}
