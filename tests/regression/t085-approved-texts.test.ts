import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * T-085: the texts of the 2D pitch in `ui.json` are exactly the batch the CEO approved on
 * 2026-11-15 (docs/content/lotes/2026-11-15-campo.md): 1 new key (`match.celebration.title`) and
 * the review of 3 texts already approved (`newGame.match.full.body`, `newGame.match.full` only in
 * es, `newGame.match.highlights.body`), with the CEO's choices ("Gol!", "Animación completa" and
 * the descriptions with "mais rápido").
 */

const LANGS = ['pt-BR', 'es', 'en'] as const;
const lot = readFileSync(
  new URL('../../docs/content/lotes/2026-11-15-campo.md', import.meta.url),
  'utf8',
);

/** The table of the batch: key -> language -> the proposed text (the column "Proposta"). */
function proposals(text: string): Map<string, Map<string, string>> {
  const found = new Map<string, Map<string, string>>();
  const table = text.split('## Textos')[1]!.split('Notas por chave')[0]!;
  let key: string | undefined;
  for (const line of table.split('\n')) {
    const match = /^\|\s*(?:`([\w.]+)`(?: \(só es\))?)?\s*\|\s*(pt-BR|es|en)\s*\|(.*)$/.exec(line);
    if (match === null) continue;
    key = match[1] ?? key;
    const cells = match[3]!.split('|').map((cell) => cell.trim());
    if (!found.has(key!)) found.set(key!, new Map());
    found.get(key!)!.set(match[2]!, cells[1]!);
  }
  return found;
}

const approved = proposals(lot);
const ui = (lang: string) =>
  JSON.parse(
    readFileSync(new URL(`../../app/src/content/${lang}/ui.json`, import.meta.url), 'utf8'),
  ) as Record<string, string>;

describe('2D pitch texts (batch of 2026-11-15)', () => {
  it('the batch is approved and has the 1 new key and the 3 revisions it announces', () => {
    expect(lot).toMatch(/^Status: aprovado pelo CEO em 2026-11-15/m);
    expect([...approved.keys()]).toEqual([
      'match.celebration.title',
      'newGame.match.full.body',
      'newGame.match.full',
      'newGame.match.highlights.body',
    ]);
    expect([...approved.get('newGame.match.full')!.keys()]).toEqual(['es']);
    for (const key of ['match.celebration.title', 'newGame.match.full.body']) {
      expect([...approved.get(key)!.keys()], key).toEqual([...LANGS]);
    }
  });

  it('the CEO chose "Gol!", "Animación completa" and the descriptions with "mais rápido"', () => {
    expect(LANGS.map((lang) => ui(lang)['match.celebration.title'])).toEqual([
      'Gol!',
      '¡Gol!',
      'Goal!',
    ]);
    expect(ui('es')['newGame.match.full']).toBe('Animación completa');
    expect(ui('pt-BR')['newGame.match.full']).toBe('Animada completa');
    expect(ui('en')['newGame.match.full']).toBe('Full animation');
    expect(ui('pt-BR')['newGame.match.highlights.body']).toContain('mais rápido');
  });

  for (const lang of LANGS) {
    it(`${lang}: every text of the batch is in ui.json as approved`, () => {
      const texts = ui(lang);
      for (const [key, byLang] of approved) {
        const text = byLang.get(lang);
        if (text === undefined) continue;
        expect(texts[key], `${lang} ${key}`).toBe(text);
      }
    });
  }

  it('no placeholder in any of the four keys, in the three languages', () => {
    for (const lang of LANGS) {
      for (const key of approved.keys()) expect(ui(lang)[key], `${lang} ${key}`).not.toMatch(/\{/);
    }
  });
});
