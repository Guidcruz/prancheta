import { config, type Lang } from '@config';
import ptBR from '../content/pt-BR/ui.json';
import es from '../content/es/ui.json';
import en from '../content/en/ui.json';

const tables: Record<Lang, Record<string, string>> = { 'pt-BR': ptBR, es, en };

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
