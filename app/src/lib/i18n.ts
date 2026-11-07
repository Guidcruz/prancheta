import { config, type Lang } from '@config';
import ptBR from '../content/pt-BR/ui.json';
import es from '../content/es/ui.json';
import en from '../content/en/ui.json';
import ptBRErrors from '../content/pt-BR/errors.json';
import esErrors from '../content/es/errors.json';
import enErrors from '../content/en/errors.json';
import ptBRFans from '../content/pt-BR/fans.json';
import esFans from '../content/es/fans.json';
import enFans from '../content/en/fans.json';

/*
 * Interface texts (docs/02-architecture.md, 3, "Conteúdo e i18n"): `ui.json`, `errors.json` and
 * `fans.json` of each language, one table per language (the `save.*` keys of `errors.json` and the
 * `fans.mood.*` keys of `fans.json` never collide with the ones of `ui.json`; i18n.test.ts checks
 * it). The full i18n is T-022.
 */

const tables: Record<Lang, Record<string, string>> = {
  'pt-BR': { ...ptBR, ...ptBRErrors, ...ptBRFans },
  es: { ...es, ...esErrors, ...esFans },
  en: { ...en, ...enErrors, ...enFans },
};

export function detectLang(): Lang {
  const wanted = (typeof navigator !== 'undefined' ? navigator.language : 'pt-BR').toLowerCase();
  const found = config.languages.find((l) => wanted.startsWith(l.toLowerCase().slice(0, 2)));
  return found ?? config.languages[0];
}

/** Translate a UI key; falls back to the default language, then to the key itself. */
export function t(
  key: string,
  lang: Lang = detectLang(),
  vars: Record<string, string | number> = {},
): string {
  const raw = tables[lang][key] ?? tables[config.languages[0]][key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/**
 * A key with plural forms (`<key>.one`, `<key>.other`), chosen by `Intl.PluralRules` of the
 * language, with `{count}` filled in. Until T-022 brings the full mechanism.
 */
export function tPlural(
  key: string,
  count: number,
  lang: Lang = detectLang(),
  vars: Record<string, string | number> = {},
): string {
  const form = new Intl.PluralRules(lang).select(count) === 'one' ? 'one' : 'other';
  return t(`${key}.${form}`, lang, { ...vars, count });
}
