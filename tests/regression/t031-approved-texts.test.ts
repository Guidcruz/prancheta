import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * T-031: the texts of the Tabela in `ui.json` are exactly the batch the CEO approved on
 * 2026-11-14 (docs/content/lotes/2026-11-14-tabela.md): 24 new keys, the same in the three
 * languages, with the same placeholders. The batch's `calendar.*` keys are T-084's (they are not
 * in its table).
 */

const LANGS = ['pt-BR', 'es', 'en'] as const;
const lot = readFileSync(
  new URL('../../docs/content/lotes/2026-11-14-tabela.md', import.meta.url),
  'utf8',
);

/** The rows of a table of the batch: key -> the three texts, in the order pt-BR, es, en. */
function rows(text: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const line of text.split('\n')) {
    const match = /^\| `([\w.]+)`\s*\|(.*)$/.exec(line);
    if (match === null) continue;
    const cells = match[2]!.split('|').map((cell) => cell.trim());
    found.set(match[1]!, cells.slice(0, 3));
  }
  return found;
}

const keys = rows(lot.split('## Escolhas')[0]!);

const ui = (lang: string) =>
  JSON.parse(
    readFileSync(new URL(`../../app/src/content/${lang}/ui.json`, import.meta.url), 'utf8'),
  ) as Record<string, string>;

describe('standings texts (batch of 2026-11-14)', () => {
  it('the batch has the 24 keys it announces, all of the table', () => {
    expect(keys.size).toBe(24);
    expect([...keys.keys()].filter((key) => !key.startsWith('table.'))).toEqual([]);
  });

  it("in es, the wins, draws and losses are PG, PE and PP (the CEO's choice)", () => {
    expect(['wins', 'draws', 'losses'].map((c) => keys.get(`table.col.${c}`)?.[1])).toEqual([
      'PG',
      'PE',
      'PP',
    ]);
  });

  for (const [index, lang] of LANGS.entries()) {
    it(`${lang}: every key is in ui.json with the approved text`, () => {
      const texts = ui(lang);
      for (const [key, cells] of keys) {
        expect(texts[key], `${lang} ${key}`).toBe(cells[index]);
      }
    });
  }

  it('the three languages use the same placeholders in every key', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');
    const [pt, es, en] = LANGS.map(ui) as [
      Record<string, string>,
      Record<string, string>,
      Record<string, string>,
    ];
    for (const key of keys.keys()) {
      expect(placeholders(es[key]!), key).toBe(placeholders(pt[key]!));
      expect(placeholders(en[key]!), key).toBe(placeholders(pt[key]!));
    }
  });
});
