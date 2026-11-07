import { isSafeDisplayText, isWellFormedText } from '../safe-text.ts';

/*
 * The coach's nickname (US-014): the only text the player types, kept on the device and in the
 * exported file only. Before a career is created it is normalised to NFC and trimmed, and then it
 * must not be empty, must fit the screen and must pass `isSafeDisplayText` (lib/safe-text.ts; the
 * same check the save schema makes, security review M2). The same rule serves the new-game screen
 * (T-025), to explain why "Começar" is disabled, and the import (T-020, `coach-name`).
 */

/**
 * Most characters (code points) of a nickname. Provisional, for the new-game screen of T-025 to
 * confirm with the ux-designer; well under the 100 of the save schema (`SAVE_LIMITS`).
 */
export const COACH_NAME_MAX = 24;

export type CoachNameProblem = 'empty' | 'too-long' | 'unsafe';

export type CoachNameCheck =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: CoachNameProblem };

/** The nickname as it will be stored, or why it cannot be. Never throws. */
export function checkCoachName(raw: string): CoachNameCheck {
  if (typeof raw !== 'string' || !isWellFormedText(raw)) return { ok: false, error: 'unsafe' };
  const value = raw.normalize('NFC').trim();
  if (value === '') return { ok: false, error: 'empty' };
  if ([...value].length > COACH_NAME_MAX) return { ok: false, error: 'too-long' };
  if (!isSafeDisplayText(value)) return { ok: false, error: 'unsafe' };
  return { ok: true, value };
}
