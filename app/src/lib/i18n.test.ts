import { describe, expect, it } from 'vitest';
import ptBR from '../content/pt-BR/ui.json';
import es from '../content/es/ui.json';
import en from '../content/en/ui.json';
import ptBRErrors from '../content/pt-BR/errors.json';
import esErrors from '../content/es/errors.json';
import enErrors from '../content/en/errors.json';
import untranslated from '../content/untranslated.json';
import { t, tPlural } from './i18n.ts';

/*
 * The texts of the interface in the three languages. `content/untranslated.json` lists the keys
 * that so far exist only in pt-BR (the drafts of docs/design/telas/, waiting for the
 * content-writer): each must exist in pt-BR and be missing in es and en, and every other key must
 * be in all three. When the content-writer adds a key in es and en, it leaves the list.
 */

const tables = {
  'pt-BR': { ...ptBR, ...ptBRErrors } as Record<string, string>,
  es: { ...es, ...esErrors } as Record<string, string>,
  en: { ...en, ...enErrors } as Record<string, string>,
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
