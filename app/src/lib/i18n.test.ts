import { describe, expect, it } from 'vitest';
import ptBR from '../content/pt-BR/ui.json';
import es from '../content/es/ui.json';
import en from '../content/en/ui.json';
import ptBRErrors from '../content/pt-BR/errors.json';
import esErrors from '../content/es/errors.json';
import enErrors from '../content/en/errors.json';
import ptBRFans from '../content/pt-BR/fans.json';
import esFans from '../content/es/fans.json';
import enFans from '../content/en/fans.json';
import untranslated from '../content/untranslated.json';
import { FAN_MOODS } from '@engine';
import { t, tPlural } from './i18n.ts';

/*
 * The texts of the interface in the three languages. `content/untranslated.json` lists the keys
 * that so far exist only in pt-BR (the drafts of docs/design/telas/, waiting for the
 * content-writer): each must exist in pt-BR and be missing in es and en, and every other key must
 * be in all three. When the content-writer adds a key in es and en, it leaves the list.
 */

const tables = {
  'pt-BR': { ...ptBR, ...ptBRErrors, ...ptBRFans } as Record<string, string>,
  es: { ...es, ...esErrors, ...esFans } as Record<string, string>,
  en: { ...en, ...enErrors, ...enFans } as Record<string, string>,
};
const pending = new Set<string>(untranslated.keys as readonly string[]);

describe('ui texts', () => {
  it('have the same keys in every language, except the listed drafts still to translate', () => {
    const keys = Object.keys(tables['pt-BR']).sort();
    for (const lang of ['es', 'en'] as const) {
      const own = Object.keys(tables[lang]);
      expect(
        own.filter((k) => pending.has(k)),
        lang,
      ).toEqual([]);
      expect([...own, ...pending].sort(), lang).toEqual(keys);
    }
  });

  it('list each draft to translate once, and only keys that exist in pt-BR', () => {
    expect(untranslated.keys.length).toBe(pending.size);
    for (const key of pending) expect(tables['pt-BR'], key).toHaveProperty([key]);
  });

  it('use the same placeholders in every language', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of Object.keys(tables['pt-BR'])) {
      if (pending.has(k)) continue;
      expect(ph(tables.es[k]!)).toEqual(ph(tables['pt-BR'][k]!));
      expect(ph(tables.en[k]!)).toEqual(ph(tables['pt-BR'][k]!));
    }
  });

  it('errors.json has only save.* keys, none of them in ui.json', () => {
    for (const [errors, ui] of [
      [ptBRErrors, ptBR],
      [esErrors, es],
      [enErrors, en],
    ] as const) {
      for (const key of Object.keys(errors)) {
        expect(key).toMatch(/^save\./);
        expect(ui).not.toHaveProperty([key]);
      }
    }
  });
});

describe('fans.json', () => {
  it('has exactly one mood label per engine mood, none of them in ui.json or errors.json', () => {
    for (const [fans, ui, errors] of [
      [ptBRFans, ptBR, ptBRErrors],
      [esFans, es, esErrors],
      [enFans, en, enErrors],
    ] as const) {
      expect(Object.keys(fans).sort()).toEqual(FAN_MOODS.map((m) => `fans.mood.${m}`).sort());
      for (const key of Object.keys(fans)) {
        expect(ui).not.toHaveProperty([key]);
        expect(errors).not.toHaveProperty([key]);
      }
    }
  });

  it('is read by t() in every language', () => {
    expect(t('fans.mood.party', 'pt-BR')).toBe(ptBRFans['fans.mood.party']);
    expect(t('fans.mood.revolt', 'es')).toBe(esFans['fans.mood.revolt']);
    expect(t('fans.mood.wary', 'en')).toBe(enFans['fans.mood.wary']);
  });
});

describe('t()', () => {
  it('reads ui.json and errors.json', () => {
    expect(t('home.version', 'pt-BR', { version: '1.2.3' })).toBe(
      ptBR['home.version'].replace('{version}', '1.2.3'),
    );
    expect(t('save.conflict.title', 'pt-BR')).toBe(ptBRErrors['save.conflict.title']);
  });

  it('falls back to the key when no language has it', () => {
    expect(t('no.such.key', 'es')).toBe('no.such.key');
  });

  it('picks the plural form by the language', () => {
    expect(tPlural('save.roundsLost.body', 1, 'pt-BR')).toContain('1 rodada foi perdida');
    expect(tPlural('save.roundsLost.body', 2, 'pt-BR')).toContain('2 rodadas foram perdidas');
  });
});
