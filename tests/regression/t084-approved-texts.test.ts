import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * T-084: the texts of the Calendário in `ui.json` are exactly the batch the CEO approved on
 * 2026-11-15 (docs/content/lotes/2026-11-15-calendario.md): 3 new keys, the same in the three
 * languages, with the same placeholders, and in English the longer turn titles the CEO chose.
 */

const LANGS = ['pt-BR', 'es', 'en'] as const;
const lot = readFileSync(
  new URL('../../docs/content/lotes/2026-11-15-calendario.md', import.meta.url),
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

describe('calendar texts (batch of 2026-11-15)', () => {
  it('the batch has the 3 keys it announces, all of the calendar', () => {
    expect([...keys.keys()]).toEqual([
      'calendar.half.first',
      'calendar.half.second',
      'calendar.match.open',
    ]);
  });

  it("in en, the turns are the halves of the season (the CEO's choice)", () => {
    expect(keys.get('calendar.half.first')?.[2]).toBe('First half of the season');
    expect(keys.get('calendar.half.second')?.[2]).toBe('Second half of the season');
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
    expect(placeholders(pt['calendar.match.open']!)).toBe(
      '{awayGoals},{away},{homeGoals},{home},{result},{round}',
    );
  });
});
