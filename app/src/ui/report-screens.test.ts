import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { FixtureId, GameState, MatchSheet } from '@engine';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import MatchCard from './components/MatchCard.svelte';
import MatchStatsTable from './components/MatchStatsTable.svelte';
import MatchTimeline from './components/MatchTimeline.svelte';
import { otherCardLabel, roundSummary, type PlayedFixture } from './round';
import MatchReport from './screens/MatchReport.svelte';
import RoundSummary from './screens/RoundSummary.svelte';
import { TEST_CLUB, testCareer, testSheets } from './testing/game';

/*
 * The match report of T-083 (resumo-rodada.md, "Súmula (folha) — T-083"; US-019) and its pieces
 * (MatchTimeline, MatchStatsTable, the MatchCard as a button) rendered on the server, on real
 * careers: the sheet named by its title, the events, the best on the pitch, the stats and the
 * place; the report without its match sheet (the notice, the goals of the result and the stats);
 * the ways in from the summary; the three languages with no raw key. Touch, focus, the history,
 * widths and motion are for the E2E (tests/e2e/match-report.spec.ts).
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const shown = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const RAW_KEY = /(?:^|[>\s"'])(?:round|match|report|club|result|nav)\.[A-Za-z][\w.-]*(?=[<\s"'])/;
function expectNoRawKey(body: string, label: string): void {
  const text = body
    .replace(/<svg.*?<\/svg>/gs, '')
    .replace(/<style.*?<\/style>/gs, '')
    .replace(/(?:class|href|id|style|for|name|value|data-[a-z]+)="[^"]*"/g, '');
  expect(text.match(RAW_KEY)?.[0], `${label}: raw key on screen`).toBeUndefined();
  expect(text, `${label}: unfilled {placeholder}`).not.toMatch(/\{[a-z]+\}/i);
}

const game = testCareer('full', 6);
const sheets = testSheets('full', 6);
const read = roundSummary(game, TEST_CLUB)!;
const mine = read.mine.fixture;
const noop = () => undefined;

function report(
  fixtureId: FixtureId | undefined,
  sheet: MatchSheet | undefined,
  options: { lang?: Lang; state?: GameState } = {},
): string {
  return render(MatchReport, {
    props: {
      lang: options.lang ?? 'pt-BR',
      game: options.state ?? game,
      clubId: TEST_CLUB,
      fixtureId,
      sheet,
      onclose: noop,
    },
  }).body;
}

/** The part of the body inside the dialog. */
const dialog = (body: string) => body.slice(body.indexOf('<dialog'), body.indexOf('</dialog>'));
const lines = (body: string) => body.match(/<li class="line/g) ?? [];

describe('the match report (resumo-rodada.md, "Súmula")', () => {
  it('a dialog named by its title, with the meta line and the board read in full', () => {
    const body = dialog(report(mine.id, sheets[mine.id]));
    expect(body).toMatch(/<dialog[^>]*aria-labelledby="([^"]+)"/);
    const id = /aria-labelledby="([^"]+)"/.exec(body)![1]!;
    expect(body).toContain(`id="${id}">${t('report.title', 'pt-BR')}</h2>`);
    expect(body).toMatch(/class="scoreboard md[^"]*" role="group" aria-label="Placar: /);
    expect(body).toMatch(/<p class="caption muted meta[^"]*">Rodada 5 · /);
    // My club played: the result badge, with the whole word.
    expect(body).toContain(t(`result.${read.mine.result}`, 'pt-BR'));
    // The body is a named region that takes the focus, so the keyboard can scroll it.
    expect(body).toMatch(/class="body[^"]*" role="region" aria-labelledby="[^"]+" tabindex="0"/);
  });

  it('the events of the sheet, one line each, and the three blocks as h3', () => {
    const body = dialog(report(mine.id, sheets[mine.id]));
    expect(lines(body)).toHaveLength(sheets[mine.id]!.events.length);
    for (const key of ['report.events.title', 'report.stats.title']) {
      expect(body).toMatch(new RegExp(`<h3[^>]*>${shown(t(key, 'pt-BR'))}(<!---->)?</h3>`));
    }
    if (mine.result.motm !== undefined) {
      expect(body).toMatch(new RegExp(`<h3[^>]*>${t('report.motm.title', 'pt-BR')}</h3>`));
      expect(body).toContain(shown(game.players[mine.result.motm]!.name.display));
    }
    expect(body).not.toContain(t('report.missing.title', 'pt-BR'));
    // The statistics: a table with the hidden caption and the names of the rows as headers.
    expect(body).toMatch(/<caption class="visually-hidden[^"]*">Estatísticas do jogo: /);
    expect(body.match(/<th scope="row"/g)).toHaveLength(5);
    expect(body.match(/<th scope="col"/g)).toHaveLength(2);
  });

  it('without its match sheet: the notice, the goals of the result and the stats (Vitest of T-083)', () => {
    const body = dialog(report(mine.id, undefined));
    expect(body).toContain(t('report.missing.title', 'pt-BR'));
    expect(body).toContain(shown(t('report.missing.body', 'pt-BR')));
    // The notice is a heading under "Lances" (h3).
    expect(body).toMatch(
      new RegExp(`<h4[^>]*>${t('report.missing.title', 'pt-BR')}(<!---->)?</h4>`),
    );
    expect(lines(body)).toHaveLength(mine.result.goals.length);
    for (const goal of mine.result.goals) {
      expect(body).toContain(shown(game.players[goal.scorer]!.name.display));
    }
    if (mine.result.goals.length === 0) expect(body).toContain(t('round.goals.none', 'pt-BR'));
    expect(body.match(/<th scope="row"/g)).toHaveLength(5);
    const { home } = mine.result.stats;
    expect(body).toContain(`>${home.possession}%</td>`);
    expect(body).toContain(t('report.attendance', 'pt-BR', { count: '' }).trim());
    // No rating without the sheet.
    expect(body).not.toMatch(/class="body rating/);
  });

  it('without the sheet and without goals: "Sem gols", never "Nenhum lance"', () => {
    const goalless = {
      ...game,
      fixtures: game.fixtures.map((f) =>
        f.id === mine.id
          ? { ...f, result: { ...f.result!, goals: [], score: [0, 0] as const } }
          : f,
      ),
    } as GameState;
    const body = dialog(report(mine.id, undefined, { state: goalless }));
    expect(body).toContain(t('round.goals.none', 'pt-BR'));
    expect(body).not.toContain(t('report.events.none', 'pt-BR'));
  });

  it('closed: an empty dialog; a fixture not played: the error of a block, inside the sheet', () => {
    expect(dialog(report(undefined, undefined))).not.toContain('class="report');
    const next = game.fixtures.find((f) => f.round === 6)!;
    const body = dialog(report(next.id, undefined));
    expect(body).toContain(t('club.error.block.title', 'pt-BR'));
    expect(body).toContain(`aria-label="${t('nav.close', 'pt-BR')}"`);
  });

  it.each(LANGS)('%s: every text from the content, no raw key', (lang) => {
    expectNoRawKey(report(mine.id, sheets[mine.id], { lang }), `${lang} report`);
    expectNoRawKey(report(mine.id, undefined, { lang }), `${lang} missing`);
    const other = read.others[0]!;
    expectNoRawKey(report(other.id, sheets[other.id], { lang }), `${lang} other`);
  });

  it('the simplified realism: no yellow that suspends', () => {
    const simplified = testCareer('simplified', 6);
    const simplifiedSheets = testSheets('simplified', 6);
    for (const fixture of simplified.fixtures.filter((f) => f.result !== undefined)) {
      const body = report(fixture.id, simplifiedSheets[fixture.id], { state: simplified });
      expect(body, fixture.id).not.toContain(t('report.event.yellowSuspended', 'pt-BR'));
    }
  });
});

describe('the ways in from the round summary (T-083)', () => {
  const body = render(RoundSummary, {
    props: { lang: 'pt-BR', game, clubId: TEST_CLUB, save: 'saved', sheets, oncontinue: noop },
  }).body;

  it('"Súmula do jogo" in my match, after the goals, secondary and full width', () => {
    const section = body.slice(body.indexOf('<section class="mine'), body.indexOf('</section>'));
    expect(section).toMatch(
      new RegExp(
        `<div class="sheet-open[^"]*">(<!--[^>]*-->)*<button class="btn botao secondary[^"]* full"[^>]*>.*${t('round.sheet.open', 'pt-BR')}`,
        's',
      ),
    );
    expect(section.indexOf('sheet-open')).toBeGreaterThan(section.indexOf('class="goals'));
    // Still one primary on the screen: "Continuar".
    expect((body.match(/class="btn botao primary/g) ?? []).length).toBe(1);
  });

  it('each other card is named by the names and goals shown, in the same order', () => {
    for (const other of read.others) {
      const label = otherCardLabel(game, other, 'pt-BR');
      expect(body).toContain(`aria-label="${shown(label)}"`);
      const [home, away] = [other.homeId, other.awayId].map((id) => game.clubs[id]!.def.shortName);
      expect(label).toContain(`${home} ${other.result.score[0]} ${away} ${other.result.score[1]}`);
    }
  });

  it('the label adds the "Clássico" badge and the note of a match ended early, as on the card', () => {
    const other: PlayedFixture = read.others[0]!;
    const rivals = { ...game.clubs[other.homeId]!.def, rivals: [other.awayId] };
    const derby = {
      ...game,
      clubs: { ...game.clubs, [other.homeId]: { ...game.clubs[other.homeId]!, def: rivals } },
    } as GameState;
    const ended = { ...other, result: { ...other.result, abandoned: true } };
    const label = otherCardLabel(derby, ended, 'pt-BR');
    expect(label).toMatch(/^Ver súmula: .+, Clássico, Acabou antes do fim$/);
    expect(
      otherCardLabel(game, { ...other, result: { ...other.result, abandoned: false } }, 'pt-BR'),
    ).not.toContain('Acabou');
  });
});

describe('MatchTimeline, MatchStatsTable and the MatchCard as a button (componentes.md, T-083)', () => {
  it('the timeline: an ordered list, the minute and the kind read in full, one sentence a line', () => {
    const body = render(MatchTimeline, {
      props: {
        title: 'Lances',
        items: [
          {
            minute: "23'",
            minuteA11y: 'minuto 23',
            kind: 'Gol',
            text: 'Fulano',
            note: 'pênalti',
            noteA11y: 'de pênalti',
            club: 'Leões',
          },
          {
            minute: "40'",
            minuteA11y: 'minuto 40',
            icon: 'card',
            tone: 'yellow',
            kind: 'Amarelo',
            text: 'Beltrano',
            club: 'Tubarões',
          },
        ],
        emptyText: 'Nenhum lance neste jogo.',
      },
    }).body;
    expect(body).toMatch(/<h3[^>]*>Lances(<!---->)?<\/h3>/);
    expect(body).toContain('<ol class="lines');
    expect(body).toMatch(/class="numero minute[^"]*" aria-hidden="true">23'<\/span>/);
    expect(body).toContain('minuto 23, Gol, Fulano, de pênalti, Leões');
    expect(body).toContain('minuto 40, Amarelo, Beltrano, Tubarões');
    // The card's colour only reinforces the written word.
    expect(body).toMatch(/class="icon yellow[^"]*" aria-hidden="true"/);
    expect(body).toMatch(/class="body-strong kind[^"]*">Amarelo<\/span>/);
    expect(body).not.toContain('Nenhum lance');
  });

  it('an empty timeline shows its text', () => {
    const body = render(MatchTimeline, {
      props: { title: 'Lances', items: [], emptyText: 'Nenhum lance neste jogo.', level: 2 },
    }).body;
    expect(body).toMatch(/<h2[^>]*>Lances(<!---->)?<\/h2>/);
    expect(body).toContain('Nenhum lance neste jogo.');
    expect(body).not.toContain('<ol');
  });

  it('the stats table: the clubs as column headers, the stats as row headers', () => {
    const body = render(MatchStatsTable, {
      props: {
        caption: 'Estatísticas do jogo: Leões contra Tubarões',
        home: 'Leões',
        away: 'Tubarões',
        rows: [{ label: 'Posse de bola', home: '54%', away: '46%' }],
      },
    }).body;
    expect(body).toMatch(/<th scope="col"[^>]*>Leões<\/th>/);
    expect(body).toMatch(/<th scope="row"[^>]*>Posse de bola<\/th>/);
    expect(body).toMatch(/<td class="numero number[^"]*">54%<\/td>/);
  });

  it('with `onclick` and no `href`, the whole card is a button named by `a11yLabel`, with the arrow', () => {
    const club = game.clubs[mine.homeId]!.def;
    const other = game.clubs[mine.awayId]!.def;
    const body = render(MatchCard, {
      props: {
        home: { club, name: club.shortName, goals: 1 },
        away: { club: other, name: other.shortName, goals: 0 },
        onclick: noop,
        a11yLabel: 'Ver súmula',
      },
    }).body;
    expect(body).toMatch(
      /^(<!--[^>]*-->)*<button type="button" class="match link button[^"]*" aria-label="Ver súmula">/,
    );
    expect(body).toContain('class="go');
  });
});
