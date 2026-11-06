/*
 * Text that is safe to show (T-019, security review M2): every text of a save that reaches the
 * screen (the coach's nickname, club and player names, the variables of news and posts) and the
 * nickname typed on the new-game screen (US-014) pass this check. It refuses what can disguise or
 * break what is shown, never a letter of a language:
 *
 * - C0 and C1 controls and DEL (tab and line breaks included), the space being the only
 *   whitespace control allowed, and the line and paragraph separators U+2028 and U+2029;
 * - invisible, filler and direction characters: U+00AD (soft hyphen), U+034F (combining
 *   grapheme joiner), U+061C (Arabic letter mark), U+115F and U+1160 (Hangul fillers), U+180E
 *   (Mongolian vowel separator), U+200B to U+200F (zero-width, LRM, RLM), U+202A to U+202E
 *   (embeddings and overrides, the RLO), U+2060 to U+2069 (joiners and isolates), U+3164 and
 *   U+FFA0 (Hangul fillers), U+FEFF, U+FFF9 to U+FFFB (interlinear annotation) and the tags
 *   U+E0000 to U+E007F;
 * - more than 2 combining marks in a row ("zalgo");
 * - text not in NFC (the same name in two byte forms) and lone surrogates.
 *
 * This file is ASCII only on purpose (no invisible character in the source, "Trojan Source"): the
 * characters are written as code points.
 */

/** Combining marks allowed after one base character (Portuguese needs at most one). */
export const MAX_COMBINING_RUN = 2;

/** Inclusive code point ranges refused anywhere in the text. */
const FORBIDDEN: readonly (readonly [number, number])[] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x00ad, 0x00ad],
  [0x034f, 0x034f],
  [0x061c, 0x061c],
  [0x115f, 0x1160],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2060, 0x2069],
  [0x3164, 0x3164],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
  [0xfff9, 0xfffb],
  [0xe0000, 0xe007f],
];

function hasForbidden(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0)!;
    for (const [from, to] of FORBIDDEN) if (code >= from && code <= to) return true;
  }
  return false;
}

const COMBINING_RUN = new RegExp(`\\p{M}{${MAX_COMBINING_RUN + 1}}`, 'u');

/** `true` when `text` can be shown as it is (see the rules above). Never throws. */
export function isSafeDisplayText(text: string): boolean {
  return (
    typeof text === 'string' &&
    text.isWellFormed() &&
    !hasForbidden(text) &&
    !COMBINING_RUN.test(text) &&
    text.normalize('NFC') === text
  );
}
