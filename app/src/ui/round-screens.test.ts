import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { getStandings, type GameState } from '@engine';
import type { Lang } from '@lib/config';
import { t, tPlural } from '@lib/i18n';
import GoalList from './components/GoalList.svelte';
import MatchCard from './components/MatchCard.svelte';
import Scoreboard from './components/Scoreboard.svelte';
import { roundSummary, type PlayedFixture } from './round';
import RoundSummary, { type RoundSaveState } from './screens/RoundSummary.svelte';
import { TEST_CLUB, testCareer } from './testing/game';

/*
 * The round summary of T-030 (resumo-rodada.md; US-019, US-032) and its new pieces (Scoreboard,
 * GoalList, MatchCard without `meta` and with `note`) rendered on the server, on real careers:
 * the order of the blocks, the result in words, the states of the bar, the band with the refused
 * write, the first round, 0 × 0 and the abandoned match, in the three languages with no raw key.
 * Touch, focus, the history, widths and motion are for the E2E (tests/e2e/round-summary.spec.ts).
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const shown = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const RAW_KEY = /(?:^|[>\s"'])(?:round|match|club|result|action|save)\.[A-Za-z][\w.-]*(?=[<\s"'])/;
function expectNoRawKey(body: string, label: string): void {
  const text = body
    .replace(/<svg.*?<\/svg>/gs, '')
    .replace(/<style.*?<\/style>/gs, '')
    .replace(/(?:class|href|id|style|for|name|value|data-[a-z]+)="[^"]*"/g, '');
  expect(text.match(RAW_KEY)?.[0], `${label}: raw key on screen`).toBeUndefined();
  expect(text, `${label}: unfilled {placeholder}`).not.toMatch(/\{[a-z]+\}/i);
}

const after1 = testCareer('full', 2);
const after5 = testCareer('full', 6);
const noop = () => undefined;

function summary(
  game: GameState,
  options: { lang?: Lang; save?: RoundSaveState; notices?: unknown[] } = {},
): string {
  return render(RoundSummary, {
    props: {
      lang: options.lang ?? 'pt-BR',
      game,
      clubId: TEST_CLUB,
      save: options.save ?? 'saved',
      notices: (options.notices ?? []) as never,
      oncontinue: noop,
    },
  }).body;
}

/** `game` with the result of the coach's match in round `round` changed. */
function withMine(
  game: GameState,
  round: number,
  change: (result: PlayedFixture['result']) => PlayedFixture['result'],
): GameState {
  return {
    ...game,
    fixtures: game.fixtures.map((f) =>
      f.round === round &&
      f.result !== undefined &&
      (f.homeId === TEST_CLUB || f.awayId === TEST_CLUB)
        ? { ...f, result: change(f.result) }
        : f,
    ),
  };
}

describe('the round summary (resumo-rodada.md, "Conteúdo")', () => {
  const read = roundSummary(after5, TEST_CLUB)!;
  const fixture = read.mine.fixture;
  const name = (id: string) => after5.clubs[id]!.def.shortName;

  it('the heading is the round, named with the result in words and the score', () => {
    const body = summary(after5);
    const word = t(`result.${read.mine.result}`, 'pt-BR');
    const sentence = t('round.result.a11y', 'pt-BR', {
      result: word,
      home: name(fixture.homeId),
      homeGoals: fixture.result.score[0],
      away: name(fixture.awayId),
      awayGoals: fixture.result.score[1],
    });
    expect(body).toMatch(
      new RegExp(`<h1[^>]*aria-label="${shown(`Rodada 5. ${sentence}`).replace(/[.]/g, '\\.')}"`),
    );
    expect(body).toMatch(/<h1[^>]*tabindex="-1"[^>]*>\s*Rodada 5\s*<\/h1>/);
    // The badge with the whole word, never only a letter.
    expect(body).toMatch(new RegExp(`class="badge rotulo (win|draw|loss)[^"]*"`));
    expect(body).toMatch(new RegExp(`<span class="text[^"]*">${shown(word)}</span>`));
  });

  it('my match, then the standings, then the other results; the board is not read again', () => {
    const body = summary(after5);
    const mine = body.indexOf(t('round.mine.title', 'pt-BR'));
    const table = body.indexOf(t('club.table.title', 'pt-BR'));
    const others = body.indexOf(t('round.others.title', 'pt-BR'));
    expect(mine).toBeGreaterThan(0);
    expect(table).toBeGreaterThan(mine);
    expect(others).toBeGreaterThan(table);
    // The row is hidden; the line of venue and stadium is still read, after "Meu jogo".
    expect(body).toMatch(/class="row[^"]*" aria-hidden="true"/);
    expect(body).not.toMatch(/class="scoreboard lg[^"]*"[^>]*aria-hidden/);
    expect(body).toMatch(/<p class="caption meta[^"]*">/);
    expect(body).toContain(
      shown(
        t('round.mine.meta', 'pt-BR', {
          venue: t(`match.venue.${read.mine.venue}`, 'pt-BR'),
          stadium: after5.clubs[fixture.homeId]!.def.stadium.name,
        }),
      ),
    );
  });

  it('nine other results in the order of the calendar, each a button that opens its report (T-083)', () => {
    const body = summary(after5);
    const list = body.slice(body.indexOf('class="others '));
    const ids = [...list.matchAll(/<li[^>]*data-fixture="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(read.others.map((f) => f.id));
    const cards = list.slice(0, list.indexOf('</ul>'));
    expect(cards).not.toMatch(/<a\s/);
    expect(cards.match(/<button type="button" class="match link button/g)).toHaveLength(9);
    // No top line in the cards of the other results.
    expect(cards).not.toContain('class="caption meta');
  });

  it('the position from getStandings and its change in text, the arrow only reinforcing it', () => {
    const body = summary(after5);
    const row = getStandings(after5, 5).find((r) => r.clubId === TEST_CLUB)!;
    expect(body).toContain(`data-position="${row.position}"`);
    expect(body).toContain(t('club.table.position', 'pt-BR', { position: row.position }));
    expect(body).toContain(
      `${tPlural('club.table.points', row.points, 'pt-BR')} ${tPlural('club.table.played', row.played, 'pt-BR')}`,
    );
    expect(body).toContain(`data-change="${read.change}"`);
  });

  it('round 1: only the position, no change and no arrow', () => {
    const body = summary(after1);
    expect(body).toContain('Rodada 1');
    expect(body).not.toContain('data-change');
    for (const key of ['round.table.same']) expect(body).not.toContain(t(key, 'pt-BR'));
    expect(body).not.toMatch(/Subiu|Caiu/);
  });

  it('the bar: saved, not saved, saving; the only primary is "Continuar"', () => {
    const saved = summary(after5, { save: 'saved' });
    expect(saved).toContain(t('round.saved', 'pt-BR'));
    expect((saved.match(/class="btn botao primary/g) ?? []).length).toBe(1);
    expect(saved).toContain(t('round.continue', 'pt-BR'));
    expect(summary(after5, { save: 'unsaved' })).toContain(t('round.unsaved', 'pt-BR'));
    const saving = summary(after5, { save: 'saving' });
    expect(saving).toContain(t('round.saving', 'pt-BR'));
    expect(saving).not.toContain(t('round.saved', 'pt-BR'));
  });

  it('the refused write: its banner in the band, never a second live region', () => {
    const body = summary(after5, {
      save: 'unsaved',
      notices: [
        {
          key: 'unsaved-quota-exceeded',
          tone: 'danger',
          title: t('save.quota-exceeded.title', 'pt-BR'),
          message: t('save.quota-exceeded.body', 'pt-BR'),
          actions: [{ label: t('action.retry', 'pt-BR'), onclick: noop }],
        },
      ],
    });
    expect(body).toMatch(/<section class="banner danger[^"]*">/);
    expect(body).toContain(shown(t('save.quota-exceeded.title', 'pt-BR')));
    expect(body).not.toContain('role="alert"');
  });

  it('0 × 0: "Sem gols" in place of the goals', () => {
    const body = summary(
      withMine(after5, 5, (r) => ({ ...r, score: [0, 0], goals: [], abandoned: false })),
    );
    expect(body).toContain(t('round.goals.none', 'pt-BR'));
    expect(body).not.toContain('class="column"');
    expect(body).toContain(t('result.D', 'pt-BR'));
  });

  it('an abandoned match: the note with the club short of players, and the real goals', () => {
    const lost = read.mine.venue === 'home' ? ([0, 3] as const) : ([3, 0] as const);
    const body = summary(withMine(after5, 5, (r) => ({ ...r, score: lost, abandoned: true })));
    expect(body).toContain(
      shown(t('match.abandoned', 'pt-BR', { club: after5.clubs[TEST_CLUB]!.def.shortName })),
    );
    expect(body).toContain(t('result.L', 'pt-BR'));
  });

  it('another abandoned match: the short note at the foot of its card', () => {
    const other = read.others[0]!;
    const game = {
      ...after5,
      fixtures: after5.fixtures.map((f) =>
        f.id === other.id ? { ...f, result: { ...f.result!, abandoned: true } } : f,
      ),
    };
    const body = summary(game);
    expect(body).toMatch(
      new RegExp(`<span class="caption note[^"]*">${t('match.abandoned.short', 'pt-BR')}</span>`),
    );
  });

  it.each(LANGS)('%s: every text from the content, no raw key', (lang) => {
    for (const save of ['saved', 'unsaved', 'saving'] as const) {
      expectNoRawKey(summary(after5, { lang, save }), `${lang} ${save}`);
    }
    expectNoRawKey(summary(after1, { lang }), `${lang} round 1`);
  });
});

describe('Scoreboard, GoalList and MatchCard (componentes.md, "Casca da T-030")', () => {
  const club = after1.clubs[TEST_CLUB]!.def;
  const other = Object.values(after1.clubs).find((c) => c.def.id !== TEST_CLUB)!.def;
  const board = (props: Record<string, unknown>) =>
    render(Scoreboard, {
      props: {
        home: { club, name: club.shortName, goals: 2 },
        away: { club: other, name: other.shortName, goals: 1 },
        versus: '×',
        ...props,
      },
    }).body;

  it('the board: goals in tabular numbers, the separator never read, my club in bold', () => {
    const body = board({ mine: 'home' });
    expect(body).toContain('class="score placar-xl');
    expect(body).toMatch(/<span class="versus[^"]*" aria-hidden="true">×<\/span>/);
    expect(body).toContain(`class="name body-strong`);
    expect(body).toContain(`class="name body`);
    expect(board({ size: 'md' })).toContain('class="score display-lg');
  });

  it('with a name it is a group and its parts are hidden; `hidden` hides the row only', () => {
    const named = board({ a11yLabel: 'Leões 2, Tubarões 1', meta: 'Em casa · Estádio' });
    expect(named).toMatch(/role="group" aria-label="Leões 2, Tubarões 1"/);
    expect(named).toMatch(/class="row[^"]*" aria-hidden="true"/);
    expect(named).toMatch(/<p class="caption meta[^"]*" aria-hidden="true">/);
    const hidden = board({ hidden: true, a11yLabel: 'x', meta: 'Em casa · Estádio' });
    expect(hidden).toMatch(/class="row[^"]*" aria-hidden="true"/);
    expect(hidden).toMatch(/<p class="caption meta[^"]*">Em casa · Estádio<\/p>/);
    expect(hidden).not.toMatch(/class="scoreboard lg[^"]*"[^>]*aria-hidden/);
    expect(hidden).not.toContain('role="group"');
    expect(hidden).not.toContain('aria-label="x"');
  });

  it('the goal list: two named lists; the minute and the kind are read in full', () => {
    const body = render(GoalList, {
      props: {
        columns: [
          {
            label: 'Gols de Leões',
            goals: [
              {
                minute: "23'",
                minuteA11y: 'minuto 23',
                name: 'Fulano',
                kind: 'pênalti',
                kindA11y: 'de pênalti',
              },
            ],
          },
          { label: 'Gols de Tubarões', goals: [] },
        ],
        emptyText: 'Sem gols neste jogo.',
      },
    }).body;
    expect(body).toContain('aria-label="Gols de Leões"');
    expect(body).toContain('aria-label="Gols de Tubarões"');
    expect(body).toMatch(/class="numero minute[^"]*" aria-hidden="true">23'<\/span>/);
    // One sentence per goal for screen readers; every visible part is hidden from them.
    expect(body).toMatch(
      /<span class="visually-hidden[^"]*">minuto 23, Fulano, de pênalti<\/span>/,
    );
    expect(body).toMatch(/class="body who[^"]*" aria-hidden="true">Fulano/);
    expect(body).not.toContain('Sem gols');
  });

  it('the match card without `meta` has no top line, and `note` sits at the foot', () => {
    const body = render(MatchCard, {
      props: {
        home: { club, name: club.shortName, goals: 0 },
        away: { club: other, name: other.shortName, goals: 3 },
        note: 'Acabou antes do fim',
      },
    }).body;
    expect(body).not.toContain('class="caption meta');
    expect(body).toMatch(/<span class="caption note[^"]*">Acabou antes do fim<\/span>/);
    expect(body).toMatch(/^(<!--[^>]*-->)*<div class="match/);
  });
});
