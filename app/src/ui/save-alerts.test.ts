import { describe, expect, it } from 'vitest';
import type { FatalCode, WriteError } from '@lib/career';
import ptBR from '../content/pt-BR/ui.json';
import ptBRErrors from '../content/pt-BR/errors.json';
import {
  AVAILABLE_ACTIONS,
  alertKey,
  fatalActions,
  hasAlertText,
  unsavedActions,
  type AlertAction,
} from './save-alerts';

/* Every code the CareerService can raise has a text and a way out (erros-e-avisos.md). */

const FATAL: readonly FatalCode[] = [
  'conflict',
  'app-outdated',
  'save-too-new',
  'unsupported-browser',
  'all-corrupt',
  'read-failed',
];
const UNSAVED: readonly WriteError[] = [
  'quota-exceeded',
  'verify-failed',
  'too-large',
  'write-failed',
  'read-failed',
  'storage-unavailable',
];
const errors = ptBRErrors as Record<string, string>;
const ui = ptBR as Record<string, string>;

describe('save alerts', () => {
  it.each([...FATAL, ...UNSAVED, 'career-limit', 'not-found'])(
    '%s has a title and a body',
    (code) => {
      expect(hasAlertText(code)).toBe(true);
      expect(errors[alertKey(code, 'title')]).toBeTruthy();
      expect(errors[alertKey(code, 'body')]).toBeTruthy();
    },
  );

  it('app-outdated says when the round of this tab was not saved', () => {
    expect(errors[alertKey('app-outdated', 'bodyUnsaved')]).toBeTruthy();
  });

  it('every action has its text', () => {
    const all: AlertAction[] = [
      'retry',
      'reload',
      'update',
      'home',
      'help',
      'free',
      'export',
      'import',
      'report',
    ];
    for (const action of all) expect(ui[`action.${action}`], action).toBeTruthy();
  });

  it('the two-tab errors reload first (CEO decision 3)', () => {
    expect(fatalActions('conflict')).toEqual(['reload', 'home']);
    expect(fatalActions('app-outdated')).toEqual(['reload']);
  });

  it('offers only actions that work in this build, never none', () => {
    for (const code of FATAL) {
      const actions = fatalActions(code);
      expect(actions.length, code).toBeGreaterThan(0);
      for (const a of actions) expect(AVAILABLE_ACTIONS.has(a), `${code}: ${a}`).toBe(true);
    }
    for (const code of UNSAVED) {
      const actions = unsavedActions(code);
      expect(actions.length, code).toBeGreaterThan(0);
      for (const a of actions) expect(AVAILABLE_ACTIONS.has(a), `${code}: ${a}`).toBe(true);
    }
    expect(unsavedActions('quota-exceeded')[0]).toBe('retry');
    // Export and the error report come with T-020 and T-041: until then, back home.
    expect(unsavedActions('too-large')).toEqual(['home']);
  });

  it('a code without its own text (a bug) is shown as the unexpected error', () => {
    expect(hasAlertText('invalid-save')).toBe(false);
    expect(hasAlertText('no-club-set')).toBe(false);
  });
});
