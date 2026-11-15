import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * T-032: the texts of the narrated match in `ui.json` are exactly the batch the CEO approved on
 * 2026-11-15 (docs/content/lotes/2026-11-15-partida.md): 50 new keys, the same in the three
 * languages, with the same placeholders, and the review of 2 texts already approved
 * (`newGame.match.highlights.body` and `newGame.match.note`). The keys of T-085
 * (`match.celebration.title`) and of T-086 (`commentary.json`) are not in this task.
 */

const LANGS = ['pt-BR', 'es', 'en'] as const;
const lot = readFileSync(
  new URL('../../docs/content/lotes/2026-11-15-partida.md', import.meta.url),
  'utf8',
);
const [newPart, reviewPart] = lot.split('## Revisão de 2 textos já aprovados') as [string, string];

/** The rows of the tables of new keys: key -> the three texts, in the order pt-BR, es, en. */
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

/** The review table: key -> language -> the proposed text (the column "Proposta"). */
function review(text: string): Map<string, Map<string, string>> {
  const found = new Map<string, Map<string, string>>();
  let key: string | undefined;
  for (const line of text.split('## Largura')[0]!.split('\n')) {
    const match = /^\|\s*(?:`([\w.]+)`)?\s*\|\s*(pt-BR|es|en)\s*\|(.*)$/.exec(line);
    if (match === null) continue;
    key = match[1] ?? key;
    const cells = match[3]!.split('|').map((cell) => cell.trim());
    if (!found.has(key!)) found.set(key!, new Map());
    found.get(key!)!.set(match[2]!, cells[1]!);
  }
  return found;
}

const keys = rows(newPart);
const revised = review(reviewPart);

const ui = (lang: string) =>
  JSON.parse(
    readFileSync(new URL(`../../app/src/content/${lang}/ui.json`, import.meta.url), 'utf8'),
  ) as Record<string, string>;

describe('narrated match texts (batch of 2026-11-15)', () => {
  it('the batch has the 50 keys it announces, of the selector and of the match', () => {
    expect(keys.size).toBe(50);
    for (const key of keys.keys()) expect(key, key).toMatch(/^(play\.mode|match)\./);
    expect([...keys.keys()].filter((k) => k.startsWith('play.mode.'))).toEqual([
      'play.mode.open',
      'play.mode.title',
      'play.mode.note',
    ]);
  });

  it('the CEO chose "Rola a bola!" for the kick-off and "Retomar" for the resume', () => {
    expect(keys.get('match.live.kickoff')).toEqual([
      'Rola a bola!',
      '¡Rueda la pelota!',
      'Kick-off!',
    ]);
    expect(keys.get('match.resume')?.[0]).toBe('Retomar');
  });

  it('the start of a play holds only {player}: nothing that only a goal would have', () => {
    for (const key of [
      'match.live.build.shot',
      'match.live.build.freeKick',
      'match.live.penalty.taker',
    ]) {
      for (const text of keys.get(key)!) {
        expect(text.match(/\{\w+\}/g), `${key}: ${text}`).toEqual(['{player}']);
      }
    }
  });

  it('none of the keys of T-085 or T-086 entered ui.json', () => {
    for (const lang of LANGS) {
      const texts = ui(lang);
      expect(texts['match.celebration.title'], lang).toBeUndefined();
      expect(
        Object.keys(texts).filter((k) => k.startsWith('commentary.')),
        lang,
      ).toEqual([]);
    }
  });

  for (const [index, lang] of LANGS.entries()) {
    it(`${lang}: every key is in ui.json with the approved text`, () => {
      const texts = ui(lang);
      for (const [key, cells] of keys) {
        expect(texts[key], `${lang} ${key}`).toBe(cells[index]);
      }
    });

    it(`${lang}: the 2 texts already approved carry the revision`, () => {
      const texts = ui(lang);
      expect([...revised.keys()]).toEqual(['newGame.match.highlights.body', 'newGame.match.note']);
      for (const [key, byLang] of revised) {
        expect(texts[key], `${lang} ${key}`).toBe(byLang.get(lang));
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
    for (const key of [...keys.keys(), ...revised.keys()]) {
      expect(placeholders(es[key]!), key).toBe(placeholders(pt[key]!));
      expect(placeholders(en[key]!), key).toBe(placeholders(pt[key]!));
    }
    expect(placeholders(pt['match.live.goal.a11y']!)).toBe(
      '{awayGoals},{away},{club},{homeGoals},{home},{minute},{player}',
    );
    expect(placeholders(pt['match.live.tactic.change']!)).toBe('{club},{posture},{pressure}');
  });
});
