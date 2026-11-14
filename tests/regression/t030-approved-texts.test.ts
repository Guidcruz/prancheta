import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * T-030: the texts of the round summary in `ui.json` are exactly the batch the CEO approved on
 * 2026-11-14 (docs/content/lotes/2026-11-14-resumo-rodada.md): 30 keys, the same in the three
 * languages, with the same placeholders.
 */

const LANGS = ['pt-BR', 'es', 'en'] as const;
const lot = readFileSync(
  new URL('../../docs/content/lotes/2026-11-14-resumo-rodada.md', import.meta.url),
  'utf8',
);

/** The rows of the batch table: key -> the three texts, in the order pt-BR, es, en. */
function approved(): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const line of lot.split('\n')) {
    const match = /^\| `([\w.]+)`\s*\|(.*)$/.exec(line);
    if (match === null) continue;
    const cells = match[2]!.split('|').map((cell) => cell.trim());
    rows.set(match[1]!, cells.slice(0, 3));
  }
  return rows;
}

const ui = (lang: string) =>
  JSON.parse(
    readFileSync(new URL(`../../app/src/content/${lang}/ui.json`, import.meta.url), 'utf8'),
  ) as Record<string, string>;

describe('round summary texts (batch of 2026-11-14)', () => {
  const rows = approved();

  it('the batch has the 30 keys it announces', () => {
    expect(rows.size).toBe(30);
  });

  for (const [index, lang] of LANGS.entries()) {
    it(`${lang}: every key is in ui.json with the approved text`, () => {
      const texts = ui(lang);
      for (const [key, cells] of rows) {
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
    for (const key of rows.keys()) {
      expect(placeholders(es[key]!), key).toBe(placeholders(pt[key]!));
      expect(placeholders(en[key]!), key).toBe(placeholders(pt[key]!));
    }
  });
});
