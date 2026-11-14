import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * T-083: the texts of the match report in `ui.json` are exactly the batch the CEO approved on
 * 2026-11-14 (docs/content/lotes/2026-11-14-sumula.md): 31 new keys, the same in the three
 * languages, with the same placeholders, and the revision of `round.error.body` in its own
 * section (the round was played, the summary did not open, and on leaving the frame says whether
 * it was not saved).
 */

const LANGS = ['pt-BR', 'es', 'en'] as const;
const lot = readFileSync(
  new URL('../../docs/content/lotes/2026-11-14-sumula.md', import.meta.url),
  'utf8',
);
const REVISION = '## Revisão: `round.error.body`';

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

const [main, rest] = lot.split(REVISION) as [string, string | undefined];
const keys = rows(main.split('## Escolhas')[0]!);
const revision = rows((rest ?? '').split('## Escolhas')[0]!);

const ui = (lang: string) =>
  JSON.parse(
    readFileSync(new URL(`../../app/src/content/${lang}/ui.json`, import.meta.url), 'utf8'),
  ) as Record<string, string>;

describe('match report texts (batch of 2026-11-14)', () => {
  it('the batch has the 31 keys it announces and the one revision', () => {
    expect(keys.size).toBe(31);
    expect([...revision.keys()]).toEqual(['round.error.body']);
  });

  it('in es, the best on the pitch is "Mejor en la cancha" (the CEO\'s choice)', () => {
    expect(keys.get('report.motm.title')?.[1]).toBe('Mejor en la cancha');
  });

  for (const [index, lang] of LANGS.entries()) {
    it(`${lang}: every key is in ui.json with the approved text`, () => {
      const texts = ui(lang);
      for (const [key, cells] of keys) {
        expect(texts[key], `${lang} ${key}`).toBe(cells[index]);
      }
    });

    it(`${lang}: round.error.body has the revised text`, () => {
      expect(ui(lang)['round.error.body']).toBe(revision.get('round.error.body')![index]);
    });
  }

  it('the three languages use the same placeholders in every key', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');
    const [pt, es, en] = LANGS.map(ui) as [
      Record<string, string>,
      Record<string, string>,
      Record<string, string>,
    ];
    for (const key of [...keys.keys(), 'round.error.body']) {
      expect(placeholders(es[key]!), key).toBe(placeholders(pt[key]!));
      expect(placeholders(en[key]!), key).toBe(placeholders(pt[key]!));
    }
  });
});
