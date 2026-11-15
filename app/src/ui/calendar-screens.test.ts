import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Fixture, GameState } from '@engine';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import MatchCard from './components/MatchCard.svelte';
import CalendarRound from './screens/CalendarRound.svelte';
import CalendarView from './screens/CalendarView.svelte';
import { TEST_CLUB, testCareer, testSheets } from './testing/game';

/*
 * QA of T-084 (US-024): the Calendário list and its Rodada rendered on the server (no DOM in the
 * tests), on real careers, for each state of calendario.md (pre-season, during the season, season
 * over, Simplificado, a match ended early), in the three languages, with no raw text key; and the
 * MatchCard `highlight`. The scroll, the focus, the history, the widths and the motion are for
 * the E2E (tests/e2e/calendar.spec.ts).
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const shown = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const RAW_KEY =
  /(?:^|[>\s"'])(?:calendar|round|match|club|result|report)\.[A-Za-z][\w.-]*(?=[<\s"'])/;
function expectNoRawKey(body: string, label: string): void {
  const text = body
    .replace(/<svg.*?<\/svg>/gs, '')
    .replace(/<style.*?<\/style>/gs, '')
    .replace(/(?:class|href|id|style|for|name|value|data-[a-z]+)="[^"]*"/g, '');
  expect(text.match(RAW_KEY)?.[0], `${label}: raw key on screen`).toBeUndefined();
  expect(text, `${label}: unfilled {placeholder}`).not.toMatch(/\{[a-z]+\}/i);
}

const noop = () => undefined;
const list = (game: GameState, lang: Lang = 'pt-BR') =>
  render(CalendarView, { props: { lang, game, clubId: TEST_CLUB, onopen: noop } }).body;
const roundScreen = (game: GameState, round: number, lang: Lang = 'pt-BR') =>
  render(CalendarRound, {
    props: { lang, game, clubId: TEST_CLUB, round, titleId: 'frame-title', sheets: {} },
  }).body;

/** The `<li>` of the list (or the Rodada), in order. */
const items = (body: string) => body.split('<li').slice(1);
const mineOf = (f: Fixture) => f.homeId === TEST_CLUB || f.awayId === TEST_CLUB;

const preseason = testCareer('full', 1);
const round10 = testCareer('full', 10);
const over = testCareer('full', 39);
const simplified = testCareer('simplified', 6);

describe('Calendário (T-084): every state in the three languages', () => {
  for (const lang of LANGS) {
    for (const [label, game, played] of [
      ['pre-season', preseason, 0],
      ['round 10', round10, 9],
      ['season over', over, 38],
      ['simplified', simplified, 5],
    ] as const) {
      it(`${lang}, ${label}: two halves, 38 cards, ${played} buttons, no raw key`, () => {
        const body = list(game, lang);
        expectNoRawKey(body, `${lang} ${label}`);
        expect(body.match(/<h2\b/g)).toHaveLength(2);
        expect(body).toContain(shown(t('calendar.half.first', lang)));
        expect(body).toContain(shown(t('calendar.half.second', lang)));
        expect(body.match(/<ol\b/g)).toHaveLength(2);
        expect(items(body)).toHaveLength(38);
        expect(body.match(/<button\b/g) ?? []).toHaveLength(played);
        expect(body).not.toMatch(/<a\b/);
        const highlights = body.match(/class="rotulo highlight/g) ?? [];
        expect(highlights).toHaveLength(label === 'season over' ? 0 : 1);
      });
    }
  }

  it('the halves: rounds 1 to 19, then 20 to 38', () => {
    const body = list(round10);
    const [first, second] = body.split('<h2').slice(1);
    const rounds = (part: string) =>
      [...part.matchAll(/data-round="(\d+)"/g)].map((m) => Number(m[1]));
    expect(rounds(first!)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
    expect(rounds(second!)).toEqual(Array.from({ length: 19 }, (_, i) => i + 20));
  });

  it('the next round: "Próximo jogo" on top of its card, only to read', () => {
    const body = list(round10);
    const next = items(body).find((li) => li.includes('data-round="10"'))!;
    expect(next).toContain(`class="rotulo highlight`);
    expect(next).toContain(t('club.next.title', 'pt-BR'));
    expect(next).not.toContain('<button');
    expect(next.indexOf(t('club.next.title', 'pt-BR'))).toBeLessThan(
      next.indexOf(shown(t('club.next.meta', 'pt-BR', { round: 10, date: '' }).trim())),
    );
  });

  it('a played card: a button named by calendar.match.open, the result word visible', () => {
    const body = list(round10);
    const third = items(body).find((li) => li.includes('data-round="3"'))!;
    expect(third).toMatch(/<button[^>]*aria-label="Ver a rodada 3: /);
    expect(third).toMatch(/(Vitória|Empate|Derrota)/);
    // Still to play: no goals, no result word.
    const later = items(body).find((li) => li.includes('data-round="20"'))!;
    expect(later).not.toContain('class="numero goals');
    expect(later).not.toMatch(/badge (win|draw|loss)/);
  });

  it('a match ended early: the note on its card', () => {
    const game: GameState = {
      ...round10,
      fixtures: round10.fixtures.map((f) =>
        f.round === 4 && mineOf(f) ? { ...f, result: { ...f.result!, abandoned: true } } : f,
      ),
    };
    const card = items(list(game)).find((li) => li.includes('data-round="4"'))!;
    expect(card).toContain(t('match.abandoned.short', 'pt-BR'));
  });
});

describe('the Rodada (T-084): the coach match first, every card a button', () => {
  for (const lang of LANGS) {
    it(`${lang}: ten cards named by round.others.open, no raw key`, () => {
      const body = roundScreen(round10, 3, lang);
      expectNoRawKey(body, lang);
      expect(items(body)).toHaveLength(10);
      // Ten in the list; the eleventh is the X of the (closed) report sheet.
      const cards = body.slice(body.indexOf('<ul'), body.indexOf('</ul>'));
      expect(cards.match(/<button\b/g) ?? []).toHaveLength(10);
      expect(body).toMatch(/<ul[^>]*aria-labelledby="frame-title"/);
      // No result badge and no venue: every card has the same form.
      expect(body).not.toMatch(/badge (win|draw|loss)/);
      expect(body).not.toContain(t('match.venue.home', lang));
    });
  }

  it('the order: the coach match, then the nine others in the order of the calendar', () => {
    const body = roundScreen(round10, 3);
    const ids = [...body.matchAll(/<li data-fixture="([^"]+)"/g)].map((m) => m[1]);
    const fixtures = round10.fixtures.filter((f) => f.round === 3);
    expect(ids).toEqual([
      ...fixtures.filter(mineOf).map((f) => f.id),
      ...fixtures.filter((f) => !mineOf(f)).map((f) => f.id),
    ]);
    // The coach's club in bold on its card only.
    const [first, ...rest] = items(body);
    expect(first).toContain('body-strong');
    for (const li of rest) expect(li).not.toContain('body-strong');
  });

  it('the report sheet is closed when the Rodada opens (no entry of it)', () => {
    const sheets = testSheets('full', 10);
    const body = render(CalendarRound, {
      props: { lang: 'pt-BR', game: round10, clubId: TEST_CLUB, round: 3, titleId: 't', sheets },
    }).body;
    expect(body).not.toMatch(/<dialog[^>]*\bopen\b/);
  });

  it('a round still to play is a bug for the boundary', () => {
    expect(() => roundScreen(round10, 10)).toThrow();
  });
});

describe('MatchCard highlight (componentes.md, T-084)', () => {
  const club = round10.clubs[TEST_CLUB]!.def;
  const card = (props: Record<string, unknown>) =>
    render(MatchCard, {
      props: {
        home: { club, name: 'Casa' },
        away: { club, name: 'Fora' },
        meta: 'Rodada 5',
        ...props,
      },
    }).body;

  it('the word on top, before the meta line, in the three forms', () => {
    for (const extra of [{}, { href: '#/calendar' }, { onclick: noop }]) {
      const body = card({ highlight: 'Próximo jogo', ...extra });
      expect(body).toMatch(/class="match[^"]*highlighted/);
      expect(body.indexOf('Próximo jogo')).toBeLessThan(body.indexOf('Rodada 5'));
    }
  });

  it('without it (or with an empty word), no word and no border', () => {
    for (const extra of [{}, { highlight: '' }]) {
      const body = card(extra);
      expect(body).not.toContain('highlighted');
      expect(body).not.toContain('rotulo');
    }
  });
});
