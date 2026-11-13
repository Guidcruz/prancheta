import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { FORMATION_SLOTS, fitLevel, sheetProblems, type DraftSheet } from '@engine';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import { loadGameParams } from '@lib/params';
import { benchRows, candidateSlot, lineupIssues, outRows, pitchSlots, type Place } from './lineup';
import LineupView from './screens/LineupView.svelte';
import { misplacedCount, tacticIssues } from './tactic';
import { TEST_CLUB, testCareer, withPlayer } from './testing/game';
import { lineupFixture, secondaryFixture } from './testing/lineup';

/*
 * The secondary position on the Escalação and the Tática (T-079; escalacao.md and tatica.md,
 * "Posição secundária"; componentes.md, "Casca da T-080"), on the fixture of the E2E with the
 * cases (a) to (e) of "Medidas para o E2E (T-079)": the mark of the slot and its gravity, the
 * accessible name, out of the warnings and of "Nesta formação", and the candidate's badge while a
 * filled slot is picked or dragged, in the three languages. Touch, drag, CSS and widths are for
 * the E2E (tests/e2e/lineup.spec.ts).
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const TIRED = loadGameParams().ai.rotationCondition;
const fx = secondaryFixture(lineupFixture(testCareer('full', 1)));
const { game, sheet } = fx;
const slot = (index: number): Place => ({ part: 'starters', index });
const label = (lang: Lang) => t('lineup.fit.secondary', lang);
const lower = (lang: Lang) => label(lang).toLocaleLowerCase(lang);
const rowOf = (rows: ReturnType<typeof benchRows>, id: string) =>
  rows.find((r) => r.place.part === 'bench' && sheet.lineup.bench[r.place.index] === id)!;

describe('the fixture of the secondary position', () => {
  it('has the cases (a) to (e) where escalacao.md puts them, by the engine', () => {
    const slots = FORMATION_SLOTS['4-4-2'];
    expect(sheet.lineup.starters[1]).toBe(fx.onSecondary.id);
    expect(fitLevel(fx.onSecondary, slots[1]!)).toBe('secondary');
    expect(fx.onSecondary.position).toBe('DM');
    expect(sheet.lineup.bench).toContain(fx.benchSecondary.id);
    expect(fx.benchSecondary).toMatchObject({ position: 'FB', secondaryPosition: 'CB' });
    expect(sheet.lineup.bench).toContain(fx.benchPlain.id);
    expect(fx.benchPlain).toMatchObject({ position: 'AM', secondaryPosition: null });
    expect(fitLevel(fx.injuredOnSecondary, slots[6]!)).toBe('secondary');
    expect(fx.injuredOnSecondary.injuryRounds).toBe(2);
    expect(fitLevel(fx.misplaced, slots[9]!)).toBe('outOfPosition');
    expect(sheet.lineup.starters[2]).toBe(fx.naturalCb.id);
  });
});

describe('the mark of the slot (escalacao.md, "Marca da vaga secondary")', () => {
  for (const lang of LANGS) {
    it(`${lang}: (a) has the secondary mark, the natural code and sector, and the name ends with it`, () => {
      const a = pitchSlots(game, TEST_CLUB, sheet, {}, lang)[1]!;
      expect(a.mark).toEqual({ kind: 'secondary', label: label(lang) });
      expect(a.positionCode).toBe(t('position.DM.short', lang));
      expect(a.sector).toBe('mid');
      expect(a.a11yLabel.endsWith(`, ${lower(lang)}`)).toBe(true);
    });

    it(`${lang}: (d) injured on his secondary shows only the injury; the name says both`, () => {
      const d = pitchSlots(game, TEST_CLUB, sheet, {}, lang)[6]!;
      const injured = t('status.injured.other', lang, { count: 2 });
      expect(d.mark?.kind).toBe('injured');
      expect(d.a11yLabel).toContain(injured.toLocaleLowerCase(lang));
      expect(d.a11yLabel.endsWith(`, ${lower(lang)}`)).toBe(true);
    });
  }

  it('gravity: injured > suspended > out of position > improvised > secondary > none', () => {
    const at = (g: typeof game, index: number) =>
      pitchSlots(g, TEST_CLUB, sheet, {}, 'pt-BR')[index]!;
    expect(at(game, 1).mark?.kind).toBe('secondary');
    expect(at(withPlayer(game, fx.onSecondary.id, { suspendedGames: 1 }), 1).mark?.kind).toBe(
      'suspended',
    );
    expect(at(withPlayer(game, fx.onSecondary.id, { injuryRounds: 1 }), 1).mark?.kind).toBe(
      'injured',
    );
    // The same midfielder without his secondary is improvised there, and the mark says so.
    expect(at(withPlayer(game, fx.onSecondary.id, { secondaryPosition: null }), 1).mark).toEqual({
      kind: 'improvised',
      label: 'Improvisado',
    });
    expect(at(game, 9).mark?.kind).toBe('outOfPosition');
    expect(at(game, 2).mark).toBeUndefined();
  });
});

describe('not a warning (escalacao.md, "Não é aviso"; tatica.md, "Posição secundária")', () => {
  for (const lang of LANGS) {
    it(`${lang}: "Atenção na escalação" and "Nesta formação" never name (a); (e) is there`, () => {
      const check = sheetProblems(game, TEST_CLUB, sheet);
      const issues = lineupIssues(game, TEST_CLUB, sheet, check, TIRED, lang);
      expect(issues.some((i) => i.text.includes(fx.onSecondary.name.full))).toBe(false);
      expect(issues.some((i) => i.text.includes(fx.misplaced.name.full))).toBe(true);
      // (d) is there for his injury only.
      expect(issues.filter((i) => i.text.includes(fx.injuredOnSecondary.name.full))).toHaveLength(
        1,
      );
      expect(issues.map((i) => i.kind)).not.toContain('secondary');
      const tactic = tacticIssues(game, TEST_CLUB, sheet, check, lang);
      expect(tactic.some((i) => i.text.includes(fx.onSecondary.name.full))).toBe(false);
      expect(tactic.some((i) => i.text.includes(fx.misplaced.name.full))).toBe(true);
    });
  }

  it('misplacedCount counts the out of position and the improvised, never the secondary', () => {
    // (a) and (d) on their secondary, (e) out of position: one.
    expect(misplacedCount(game, sheet)).toBe(1);
    const plain = withPlayer(game, fx.onSecondary.id, { secondaryPosition: null });
    expect(misplacedCount(plain, sheet)).toBe(2);
  });
});

describe('the candidate to a slot (escalacao.md, "Candidato à vaga")', () => {
  for (const lang of LANGS) {
    it(`${lang}: picking a filled CB slot marks (b) last, with its text in the name; not (c)`, () => {
      const rows = benchRows(game, sheet, { selected: slot(2) }, lang);
      const b = rowOf(rows, fx.benchSecondary.id);
      expect(b.badges.at(-1)).toEqual({ kind: 'secondary', label: label(lang) });
      expect(b.a11yLabel.endsWith(`, ${lower(lang)}`)).toBe(true);
      const c = rowOf(rows, fx.benchPlain.id);
      expect(c.badges.map((x) => x.kind)).not.toContain('secondary');
    });
  }

  it('also while the slot is the origin of a drag; gone with nothing picked', () => {
    const kinds = (states: Parameters<typeof benchRows>[2]) =>
      rowOf(benchRows(game, sheet, states, 'pt-BR'), fx.benchSecondary.id).badges.map(
        (x) => x.kind,
      );
    expect(kinds({ origin: slot(2) })).toContain('secondary');
    expect(kinds({})).not.toContain('secondary');
  });

  it('the level is read from the slot, not from who is in it: the CB slot of (a) marks (b) too', () => {
    expect(candidateSlot(sheet, { selected: slot(1) })).toBe('CB');
    const b = rowOf(benchRows(game, sheet, { selected: slot(1) }, 'pt-BR'), fx.benchSecondary.id);
    expect(b.badges.at(-1)?.kind).toBe('secondary');
  });

  it('only the secondary: no improvised nor out-of-position badge on any row', () => {
    for (let index = 0; index < 11; index++) {
      const states = { selected: slot(index) };
      const rows = [
        ...benchRows(game, sheet, states, 'pt-BR'),
        ...outRows(game, TEST_CLUB, sheet, states, 'pt-BR'),
      ];
      for (const row of rows) {
        const kinds = row.badges.map((x) => x.kind);
        expect(kinds).not.toContain('improvised');
        expect(kinds).not.toContain('outOfPosition');
      }
    }
  });

  it('a player left out with the slot as secondary is marked too', () => {
    const left = outRows(game, TEST_CLUB, sheet, {}, 'pt-BR').find(
      (r) => r.place.part === 'out' && game.players[r.place.id]!.position === 'DM',
    )!;
    const id = left.place.part === 'out' ? left.place.id : '';
    const g = withPlayer(game, id, { secondaryPosition: 'CB' });
    const row = outRows(g, TEST_CLUB, sheet, { selected: slot(2) }, 'pt-BR').find(
      (r) => r.place.part === 'out' && r.place.id === id,
    )!;
    expect(row.badges.at(-1)?.kind).toBe('secondary');
  });

  it('no mark in reverse: a reserve, a player left out or a free slot picked gives none', () => {
    const freed: DraftSheet = {
      ...sheet,
      lineup: {
        ...sheet.lineup,
        starters: sheet.lineup.starters.map((id, i) => (i === 2 ? null : id)),
      },
    };
    expect(candidateSlot(sheet, { selected: { part: 'bench', index: 0 } })).toBeUndefined();
    expect(candidateSlot(sheet, { selected: { part: 'out-free' } })).toBeUndefined();
    expect(candidateSlot(freed, { selected: slot(2) })).toBeUndefined();
    const marked = benchRows(game, sheet, { selected: { part: 'bench', index: 0 } }, 'pt-BR');
    expect(marked.flatMap((r) => r.badges.map((x) => x.kind))).not.toContain('secondary');
    // The slots of the pitch keep the mark of who is in them.
    const slots = pitchSlots(
      game,
      TEST_CLUB,
      sheet,
      { selected: { part: 'bench', index: 2 } },
      'pt-BR',
    );
    expect(slots[2]!.mark).toBeUndefined();
  });
});

describe('the Escalação rendered with the secondary position (componentes.md, T-080)', () => {
  const view = (lang: Lang, states = {}) =>
    render(LineupView, {
      props: { lang, game, clubId: TEST_CLUB, sheet, tiredBelow: TIRED, states },
    }).body;
  /** The HTML of one place, from its data attribute to the end of its button. */
  const placeHtml = (body: string, attr: string) => {
    const at = body.indexOf(attr);
    return body.slice(at, body.indexOf('</button>', at));
  };

  for (const lang of LANGS) {
    it(`${lang}: the chip of (a) has the icon and the text; (b) gets the badge while a CB slot is picked`, () => {
      const body = view(lang);
      const a = placeHtml(body, 'data-slot="1"');
      expect(a).toContain('class="caption mark secondary');
      expect(a).toMatch(/<svg[^>]*>.*<\/svg>/s);
      expect(a).toContain(label(lang));
      const bIndex = sheet.lineup.bench.indexOf(fx.benchSecondary.id);
      expect(placeHtml(body, `data-place="bench-${bIndex}"`)).not.toContain('secondary');
      const picked = view(lang, { selected: slot(2) });
      const b = placeHtml(picked, `data-place="bench-${bIndex}"`);
      expect(b).toContain('badge rotulo secondary');
      expect(b).toContain(label(lang));
      const cIndex = sheet.lineup.bench.indexOf(fx.benchPlain.id);
      expect(placeHtml(picked, `data-place="bench-${cIndex}"`)).not.toContain('secondary');
      // No warning line for (a).
      const at = body.indexOf('class="issues');
      expect(at).toBeGreaterThan(0);
      const issues = body.slice(at);
      expect(issues).toContain(fx.misplaced.name.full);
      expect(issues).not.toContain(fx.onSecondary.name.full);
    });
  }
});
