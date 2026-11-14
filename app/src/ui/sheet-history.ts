/*
 * A sheet with its own entry in the history, so the phone's back gesture closes it (inicio.md,
 * "Apagar com confirmação dupla"; novo-jogo.md). One entry per sheet `key`: the steps of a flow
 * share it, so back from any step ends the flow. The address does not change.
 */

/**
 * Adds the sheet's entry (call when the sheet opens), keeping the state below it; `data` says
 * what the sheet shows (the match of a match report), so forward to the entry can show it again.
 */
export function pushSheet(key: string, data: Readonly<Record<string, string>> = {}): void {
  history.pushState({ ...(history.state ?? {}), ...data, sheet: key }, '');
}

/** The sheet's entry is the current one. */
export function sheetOnTop(key: string): boolean {
  return typeof history !== 'undefined' && history.state?.sheet === key;
}

/** A field of the `data` of the sheet's entry, when that entry is the current one. */
export function sheetField(key: string, field: string): string | undefined {
  if (!sheetOnTop(key)) return undefined;
  const value: unknown = history.state?.[field];
  return typeof value === 'string' ? value : undefined;
}

/** Removes the sheet's entry when it is still on top (call when the sheet closes by a button). */
export function popSheet(key: string): void {
  if (sheetOnTop(key)) history.back();
}
