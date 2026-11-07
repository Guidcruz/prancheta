import type { DraftUnsaved, FatalCode, WriteError } from '@lib/career';

/*
 * Which way out each code of the save offers (docs/design/telas/erros-e-avisos.md, "Erros do
 * save" and "Ações e onde levam"). The text is `save.<code>.title` / `.body` (errors.json) and
 * `action.<action>` (ui.json); the shell components only receive the translated texts. The first
 * action is the primary of the notice.
 *
 * Actions whose screen does not exist yet are left out until their task lands: `export` and
 * `import` (T-020) and `report` (Sobre, T-041). A notice left with no action offers "Voltar ao
 * início". `free` opens Carreiras e backup (T-025), so it shows only where the caller passes it.
 */

export type AlertAction =
  'retry' | 'reload' | 'update' | 'home' | 'help' | 'free' | 'export' | 'import' | 'report';

/** Actions that work in this build. */
export const AVAILABLE_ACTIONS: ReadonlySet<AlertAction> = new Set<AlertAction>([
  'retry',
  'reload',
  'update',
  'home',
  'help',
  'free',
]);

/** Full-screen errors (ErrorState `screen`, no tabs). */
const FATAL: Readonly<Record<FatalCode, readonly AlertAction[]>> = {
  conflict: ['reload', 'home'],
  'app-outdated': ['reload'],
  'save-too-new': ['update', 'home'],
  'unsupported-browser': ['help', 'home'],
  'all-corrupt': ['import', 'home'],
  'read-failed': ['retry', 'home'],
};

/** A round not saved: Banner `danger`, not dismissible, "Jogar rodada" blocked. */
const UNSAVED: Partial<Readonly<Record<WriteError, readonly AlertAction[]>>> = {
  'quota-exceeded': ['retry', 'free', 'export'],
  'verify-failed': ['retry', 'export'],
  'too-large': ['export', 'report'],
  'write-failed': ['retry', 'export'],
};

/** The available actions of a list, or "Voltar ao início" when none is left. */
function available(actions: readonly AlertAction[]): AlertAction[] {
  const kept = actions.filter((a) => AVAILABLE_ACTIONS.has(a));
  return kept.length > 0 ? kept : ['home'];
}

export function fatalActions(code: FatalCode): AlertAction[] {
  return available(FATAL[code]);
}

/** Codes without their own row (read-failed, storage-unavailable...) retry, like write-failed. */
export function unsavedActions(code: WriteError): AlertAction[] {
  return available(UNSAVED[code] ?? ['retry', 'export']);
}

/**
 * A write of the coach's sheet that failed (`CareerState.draftUnsaved`; T-029): Banner `danger`
 * with the code's text, "Tentar de novo" writes the sheet again; no room also offers "Liberar
 * espaço". The sheet is in memory and goes with the next round, so "Jogar rodada" is not blocked.
 */
export function draftActions(code: DraftUnsaved): AlertAction[] {
  return available(code === 'quota-exceeded' ? ['retry', 'free'] : ['retry']);
}

/** The key of the code's text in errors.json (`save.<code>.title` and `.body`). */
export function alertKey(code: string, part: 'title' | 'body' | 'bodyUnsaved'): string {
  return `save.${code}.${part}`;
}

/** The codes with their own text in errors.json; any other one is shown as an unexpected error. */
const WITH_TEXT: ReadonlySet<string> = new Set([
  'quota-exceeded',
  'unsupported-browser',
  'app-outdated',
  'conflict',
  'save-too-new',
  'all-corrupt',
  'verify-failed',
  'too-large',
  'storage-unavailable',
  'read-failed',
  'write-failed',
  'career-limit',
  'not-found',
]);

export function hasAlertText(code: string): boolean {
  return WITH_TEXT.has(code);
}
