import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import {
  closeSummary,
  continueCareer,
  playUntil,
  reopenIn,
  roundHeading,
  startCareer,
} from './career.ts';
import { setTheme, tokenColor } from './css.ts';
import { expect, playButton, test } from './fixtures.ts';
import {
  patchSave,
  playInEngine,
  readMatchSheets,
  readSave,
  type SaveJson,
  type SheetEventJson,
} from './save.ts';

/*
 * O Calendário (T-084; US-024; docs/design/telas/calendario.md, "Medidas para o E2E"). Cada teste
 * diz as medidas que cobre. As rodadas adiante são jogadas no motor, no Node, e gravadas no save
 * (`playInEngine` + `patchSave`), sem súmulas no banco; onde a medida lê os lances (7, 8 e 16), as
 * rodadas são jogadas pelo "Jogar rodada". O que depende de largura roda no projeto de celular
 * com a janela que a medida pede; o desktop (1280×800) roda no projeto de desktop. Os textos e
 * cada estado da tela nos três idiomas estão também no Vitest (app/src/ui/calendar-screens.test.ts).
 */

type Lang = 'pt-BR' | 'es' | 'en';
const UI: Record<Lang, Record<string, string | undefined>> = Object.fromEntries(
  (['pt-BR', 'es', 'en'] as const).map((lang) => [
    lang,
    JSON.parse(
      readFileSync(new URL(`../../app/src/content/${lang}/ui.json`, import.meta.url), 'utf8'),
    ) as Record<string, string>,
  ]),
) as Record<Lang, Record<string, string | undefined>>;

/** Um texto de `ui.json` em `lang`, com as variáveis (o teste falha se a chave não existe). */
function ui(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const text = UI[lang][key];
  if (text === undefined) throw new Error(`no ${key} in ${lang}`);
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name]));
}

interface Played {
  id: string;
  round: number;
  date: string;
  homeId: string;
  awayId: string;
  result?: {
    score: [number, number];
    abandoned: boolean;
    motm?: string;
    goals: { minute: number; added?: number; scorer: string; side: 'home' | 'away' }[];
    stats: Record<
      'home' | 'away',
      { shots: number; onTarget: number; possession: number; yellows: number; reds: number }
    >;
  };
}

const onPhone = (page: Page) => page.viewportSize()!.width < 900;
const fixtures = (save: SaveJson) => save.game.fixtures as unknown as Played[];
const roundOf = (save: SaveJson, round: number) => fixtures(save).filter((f) => f.round === round);
const isMine = (save: SaveJson, f: Played) =>
  f.homeId === save.career.clubId || f.awayId === save.career.clubId;
const mineIn = (save: SaveJson, round: number) =>
  roundOf(save, round).find((f) => isMine(save, f))!;
const nameOf = (save: SaveJson, id: string) => save.game.clubs[id]!.def.shortName;
const displayName = (save: SaveJson, id: string) =>
  (save.game.players[id] as { name: { display: string } }).name.display;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RESULT_WORD = { W: 'result.W', D: 'result.D', L: 'result.L' } as const;

/** O resultado do meu lado (W, D ou L), pelo placar dado. */
function resultLetter(save: SaveJson, f: Played): 'W' | 'D' | 'L' {
  const [h, a] = f.result!.score;
  const [mine, theirs] = f.homeId === save.career.clubId ? [h, a] : [a, h];
  return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
}

const list = (page: Page) => page.locator('main .calendar');
const cards = (page: Page) => list(page).locator('li[data-round]');
const cardOf = (page: Page, round: number) => list(page).locator(`li[data-round="${round}"]`);
const roundScreen = (page: Page) => page.locator('main .calendar-round');
const roundCards = (page: Page) => roundScreen(page).locator('li[data-fixture]');
const roundCard = (page: Page, id: string) =>
  roundScreen(page).locator(`li[data-fixture="${id}"]`).getByRole('button');
const reportDialog = (page: Page, lang: Lang = 'pt-BR') =>
  page.getByRole('dialog', { name: ui(lang, 'report.title') });
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });

/** Abre a aba Calendário pela navegação visível (abas embaixo no celular, barra lateral no desktop). */
async function openCalendar(page: Page, lang: Lang = 'pt-BR'): Promise<void> {
  await page
    .getByRole('navigation', { name: ui(lang, 'nav.label') })
    .getByRole('link', { name: ui(lang, 'nav.tab.calendar'), exact: true })
    .click();
  await expect(heading(page, ui(lang, 'nav.tab.calendar'))).toBeVisible();
  await expect(cards(page)).toHaveCount(38);
}

/** Abre a Rodada `round` tocando no card dela na lista. */
async function openRound(page: Page, round: number, lang: Lang = 'pt-BR'): Promise<void> {
  await cardOf(page, round).getByRole('button').click();
  await expect(heading(page, ui(lang, 'round.title', { round }))).toBeVisible();
  await expect(roundCards(page)).toHaveCount(10);
}

/**
 * Leva a carreira à rodada `round` jogando no motor e a reabre; `change` ajusta o save antes de
 * gravar (por exemplo, o clube do técnico). Devolve o save gravado.
 */
async function advance(
  page: Page,
  round: number,
  change?: (save: SaveJson) => void,
): Promise<SaveJson> {
  return patchSave(page, (save) => {
    save.game = playInEngine(save, round);
    change?.(save);
  });
}

/** O id do clube de nome curto `name`. */
const clubNamed = (save: SaveJson, name: string) =>
  Object.keys(save.game.clubs).find((id) => nameOf(save, id) === name)!;

/** As datas formatadas como o jogo (`matchDate`), no navegador, no idioma. */
async function formatDates(page: Page, dates: string[], lang: Lang): Promise<string[]> {
  return page.evaluate(
    ({ list: items, language }) =>
      items.map((date) => {
        const [y, m, d] = date.split('-').map(Number);
        return new Intl.DateTimeFormat(language, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        }).format(new Date(Date.UTC(y!, m! - 1, d!)));
      }),
    { list: dates, language: lang },
  );
}

/** Onde o card de `round` está na janela, com o fim do cabeçalho e o topo do "Jogar rodada". */
async function cardWindow(page: Page, round: number) {
  return page.evaluate((r) => {
    const card = document.querySelector(`main li[data-round="${r}"]`)!.getBoundingClientRect();
    const header = document.querySelector('header.header')!.getBoundingClientRect();
    const play = Array.from(document.querySelectorAll<HTMLElement>('button.play.float')).find(
      (b) => b.getClientRects().length > 0,
    );
    return {
      top: card.top,
      bottom: card.bottom,
      headerBottom: header.bottom,
      viewBottom: play === undefined ? window.innerHeight : play.getBoundingClientRect().top,
      scrollY: window.scrollY,
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    };
  }, round);
}

/**
 * O card está inteiro entre o fim do cabeçalho e o topo do "Jogar rodada"; com `centred`, no meio
 * dessa área (quando a página pôde rolar até lá).
 */
async function expectCardInView(
  page: Page,
  round: number,
  label: string,
  centred = false,
): Promise<void> {
  const at = await cardWindow(page, round);
  const areaTop = Math.max(at.headerBottom, 0);
  expect(at.top, `${label}: topo do card`).toBeGreaterThanOrEqual(areaTop - 0.5);
  expect(at.bottom, `${label}: fim do card`).toBeLessThanOrEqual(at.viewBottom + 0.5);
  if (centred && at.scrollY > 0 && at.scrollY < at.maxScroll) {
    const middle = (at.top + at.bottom) / 2;
    expect(
      Math.abs(middle - (areaTop + at.viewBottom) / 2),
      `${label}: no meio`,
    ).toBeLessThanOrEqual(2);
  }
}

/** Sem rolagem lateral da página (nem da folha aberta). */
async function noSideScroll(page: Page, label: string): Promise<void> {
  const scroll = await page.evaluate(() => {
    const sheet = document.querySelector('dialog[open]');
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sheet: sheet === null ? 0 : sheet.scrollWidth - sheet.clientWidth,
    };
  });
  expect(scroll.page, `${label}: rolagem lateral da página`).toBeLessThanOrEqual(0);
  expect(scroll.sheet, `${label}: rolagem lateral da folha`).toBeLessThanOrEqual(0);
}

/** Os valores de `x` distintos dos cards de `locator`. */
async function columns(locator: Locator): Promise<number> {
  const xs = await locator.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().x)),
  );
  return new Set(xs).size;
}

/** O texto visível dos dois lados de um card, na ordem: mandante, gols, visitante, gols. */
async function visibleTeams(card: Locator): Promise<string> {
  return (await card.locator('.team').allInnerTexts())
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .join(' ');
}

/** A palavra do tipo de um lance, em pt-BR (resumo-rodada.md, tabela do item 5). */
function kindWord(event: SheetEventJson, realism: 'full' | 'simplified'): string {
  switch (event.type) {
    case 'goal':
      return ui('pt-BR', 'report.event.goal');
    case 'penaltyMissed':
      return ui('pt-BR', 'report.event.penaltyMissed');
    case 'yellow':
      return ui(
        'pt-BR',
        event.triggersSuspension && realism === 'full'
          ? 'report.event.yellowSuspended'
          : 'report.event.yellow',
      );
    case 'red':
      return ui(
        'pt-BR',
        event.reason === 'secondYellow' ? 'report.event.redSecondYellow' : 'report.event.red',
      );
    case 'injury':
      return ui('pt-BR', 'report.event.injury');
    case 'substitution':
      return ui('pt-BR', 'report.event.sub');
  }
}

/** A tabela de estatísticas da súmula aberta confere com `result.stats`. */
async function expectStats(dialog: Locator, fixture: Played): Promise<void> {
  const { home, away } = fixture.result!.stats;
  const rows = dialog.locator('table.stats tbody tr');
  await expect(rows).toHaveCount(5);
  const expected = [
    [home.shots, away.shots],
    [home.onTarget, away.onTarget],
    [`${home.possession}%`, `${away.possession}%`],
    [home.yellows, away.yellows],
    [home.reds, away.reds],
  ];
  for (const [i, [h, a]] of expected.entries()) {
    await expect(rows.nth(i).locator('td').first()).toHaveText(String(h));
    await expect(rows.nth(i).locator('td').last()).toHaveText(String(a));
  }
}

/** Apaga a linha de `matchSheets` da rodada `round` da carreira mais recente. */
async function dropSheetRow(page: Page, round: number): Promise<void> {
  await page.evaluate(async (wanted) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('prancheta-test');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    const ask = <T>(request: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const careers = (await ask(db.transaction('careers').objectStore('careers').getAll())) as {
      id: string;
      updatedAt: string;
    }[];
    const newest = careers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
    const keys = (await ask(
      db.transaction('matchSheets').objectStore('matchSheets').getAllKeys(),
    )) as [string, number, number][];
    const key = keys.find(([careerId, , r]) => careerId === newest.id && r === wanted);
    if (key === undefined) throw new Error(`no matchSheets row for round ${wanted}`);
    const tx = db.transaction('matchSheets', 'readwrite');
    await ask(tx.objectStore('matchSheets').delete(key));
    db.close();
  }, round);
}

test.describe('Calendário (T-084)', () => {
  test('as 38 rodadas do meu clube, os turnos, os clássicos e os alvos (medidas 1, 3, 4 e 5)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await startCareer(page);
    const save = await advance(page, 10);
    await openCalendar(page);

    const mine = fixtures(save)
      .filter((f) => isMine(save, f))
      .sort((a, b) => a.round - b.round);
    expect(mine).toHaveLength(38);
    const dates = await formatDates(
      page,
      mine.map((f) => f.date),
      'pt-BR',
    );
    const rivals = save.game.clubs[save.career.clubId]!.def.rivals;
    let derbies = 0;
    for (const [i, f] of mine.entries()) {
      const card = cards(page).nth(i);
      await expect(card, `rodada ${f.round}`).toHaveAttribute('data-round', String(f.round));
      // (1) A linha de cima com a rodada e a data do save; o mando pelo homeId.
      await expect(card.locator('.meta')).toHaveText(
        ui('pt-BR', 'club.next.meta', { round: f.round, date: dates[i]! }),
      );
      const venue = f.homeId === save.career.clubId ? 'home' : 'away';
      await expect(card.locator('.venue')).toHaveText(ui('pt-BR', `match.venue.${venue}`));
      // (4) "Clássico" só contra os rivais.
      const opponent = venue === 'home' ? f.awayId : f.homeId;
      const derby = rivals.includes(opponent);
      if (derby) derbies++;
      await expect(card.getByText(ui('pt-BR', 'match.derby'), { exact: true })).toHaveCount(
        derby ? 1 : 0,
      );
      if (f.round < 10) {
        // (1) Placar do save e o selo com a palavra do resultado do meu lado.
        const [hg, ag] = f.result!.score;
        await expect(card.locator('.goals')).toHaveText([String(hg), String(ag)]);
        const word = ui('pt-BR', RESULT_WORD[resultLetter(save, f)]);
        await expect(card.locator('.badge').last()).toHaveText(word);
        // (5) Botão de pelo menos 44 × 44, com o texto visível no nome, na mesma ordem.
        const button = card.getByRole('button');
        await expect(button).toHaveCount(1);
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        const visible = await visibleTeams(button);
        expect(visible).toBe(`${nameOf(save, f.homeId)} ${hg} ${nameOf(save, f.awayId)} ${ag}`);
        await expect(button).toHaveAccessibleName(
          new RegExp(`^Ver a rodada ${f.round}: ${escape(visible)}, ${escape(word)}, `),
        );
      } else {
        await expect(card.locator('.goals')).toHaveCount(0);
        await expect(card.locator('.badge.win, .badge.draw, .badge.loss')).toHaveCount(0);
        // (5) Não jogadas: nem link nem botão.
        await expect(card.locator('a, button')).toHaveCount(0);
      }
    }
    test.info().annotations.push({ type: 'clássicos', description: String(derbies) });

    // (3) Dois turnos, cada um com um h2 e as suas 19 rodadas.
    const halves = list(page).locator('section');
    await expect(halves).toHaveCount(2);
    await expect(halves.nth(0).getByRole('heading', { level: 2 })).toHaveText(
      ui('pt-BR', 'calendar.half.first'),
    );
    await expect(halves.nth(1).getByRole('heading', { level: 2 })).toHaveText(
      ui('pt-BR', 'calendar.half.second'),
    );
    const roundsIn = (i: number) =>
      halves
        .nth(i)
        .locator('li[data-round]')
        .evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-round'))));
    expect(await roundsIn(0)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
    expect(await roundsIn(1)).toEqual(Array.from({ length: 19 }, (_, i) => i + 20));
    // Números em tabular-nums.
    const numeric = await cardOf(page, 1)
      .locator('.goals')
      .first()
      .evaluate((el) => getComputedStyle(el).fontVariantNumeric);
    expect(numeric).toContain('tabular-nums');
  });

  test('próxima rodada: "Próximo jogo", a borda grass e a abertura nela, pela aba e pelo Clube (medida 2)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'medida a 360 × 740 e 390 × 844');
    await startCareer(page);
    await advance(page, 10);
    for (const [width, height] of [
      [360, 740],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      // Pela aba, vindo de um Clube rolado.
      await page
        .getByRole('navigation', { name: ui('pt-BR', 'nav.label') })
        .getByRole('link', { name: ui('pt-BR', 'nav.tab.club'), exact: true })
        .click();
      await page.evaluate(() => window.scrollTo(0, 200));
      await openCalendar(page);
      await expectCardInView(page, 10, `${width}, pela aba`, true);
      // Pelo card do próximo jogo do Clube.
      await page
        .getByRole('navigation', { name: ui('pt-BR', 'nav.label') })
        .getByRole('link', { name: ui('pt-BR', 'nav.tab.club'), exact: true })
        .click();
      await page.locator('main a[href="#/calendar"]').first().click();
      await expect(heading(page, 'Calendário')).toBeVisible();
      await expectCardInView(page, 10, `${width}, pelo Clube`, true);
    }
    const next = ui('pt-BR', 'club.next.title');
    await expect(list(page).getByText(next, { exact: true })).toHaveCount(1);
    await expect(cardOf(page, 10).getByText(next, { exact: true })).toBeVisible();
    for (const theme of ['noite', 'dia'] as const) {
      await setTheme(page, theme);
      const border = await cardOf(page, 10)
        .locator('.match')
        .evaluate((el) => ({
          color: getComputedStyle(el).borderTopColor,
          width: getComputedStyle(el).borderTopWidth,
        }));
      expect(border.width, theme).toBe('2px');
      expect(border.color, theme).toBe(await tokenColor(page, 'grass'));
      const other = await cardOf(page, 11)
        .locator('.match')
        .evaluate((el) => getComputedStyle(el).borderTopColor);
      expect(other, theme).not.toBe(border.color);
    }
  });

  test('rodada inteira: o meu jogo primeiro, os placares do save, o foco e as duas voltas (medida 6)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await startCareer(page);
    const save = await advance(page, 10);
    await openCalendar(page);
    await openRound(page, 3);
    await expect(page).toHaveURL(/#\/calendar\/round\/3$/);
    await expect(heading(page, 'Rodada 3')).toBeFocused();

    const games = roundOf(save, 3);
    const order = [
      ...games.filter((f) => isMine(save, f)),
      ...games.filter((f) => !isMine(save, f)),
    ];
    for (const [i, f] of order.entries()) {
      const card = roundCards(page).nth(i);
      await expect(card).toHaveAttribute('data-fixture', f.id);
      const [hg, ag] = f.result!.score;
      expect(await visibleTeams(card)).toBe(
        `${nameOf(save, f.homeId)} ${hg} ${nameOf(save, f.awayId)} ${ag}`,
      );
      // Mesma forma em todos: sem selo de resultado e sem mando.
      await expect(card.locator('.venue, .meta')).toHaveCount(0);
      await expect(card.locator('.badge.win, .badge.draw, .badge.loss')).toHaveCount(0);
      const box = (await card.getByRole('button').boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    // O meu clube em negrito no primeiro card.
    const weight = await roundCards(page)
      .first()
      .locator('.team.mine .name')
      .evaluate((el) => Number(getComputedStyle(el).fontWeight));
    expect(weight).toBeGreaterThanOrEqual(600);
    await expect(roundScreen(page).locator('.date')).toHaveText(
      (await formatDates(page, [games[0]!.date], 'pt-BR'))[0]!,
    );
    // A barra lateral e as abas continuam com o Calendário marcado.
    await expect(
      page
        .getByRole('navigation', { name: ui('pt-BR', 'nav.label') })
        .getByRole('link', { name: 'Calendário', exact: true }),
    ).toHaveAttribute('aria-current', 'page');

    // O voltar do cabeçalho: a lista, com o card da rodada 3 à vista e focado.
    const before = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: ui('pt-BR', 'nav.back') }).click();
    await expect(page).toHaveURL(/#\/calendar$/);
    await expect(cardOf(page, 3).getByRole('button')).toBeFocused();
    await expectCardInView(page, 3, 'voltar do cabeçalho');

    // O voltar do celular: o mesmo.
    await openRound(page, 3);
    await page.goBack();
    await expect(page).toHaveURL(/#\/calendar$/);
    await expect(cardOf(page, 3).getByRole('button')).toBeFocused();
    await expectCardInView(page, 3, 'voltar do celular');
    expect(await page.evaluate(() => history.length)).toBe(before);

    // O avançar volta à Rodada 3, e o voltar do cabeçalho volta à lista pelo histórico: a lista
    // está logo abaixo, então nenhuma entrada nova.
    await page.goForward();
    await expect(heading(page, 'Rodada 3')).toBeVisible();
    const forward = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: ui('pt-BR', 'nav.back') }).click();
    await expect(page).toHaveURL(/#\/calendar$/);
    await expect(cardOf(page, 3).getByRole('button')).toBeFocused();
    await expectCardInView(page, 3, 'voltar do cabeçalho depois do avançar');
    expect(await page.evaluate(() => history.length)).toBe(forward);

    // Pela aba, a lista abre de novo na próxima rodada.
    await page.goForward();
    await expect(heading(page, 'Rodada 3')).toBeVisible();
    await openCalendar(page);
    await expectCardInView(page, 10, 'pela aba');
    await expect(cardOf(page, 3).getByRole('button')).not.toBeFocused();
  });

  test('súmula de jogo já jogado, de outro clube e do meu, e o voltar do celular (medida 7)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    test.setTimeout(60_000);
    await startCareer(page);
    await playUntil(page, 4);
    const save = await readSave(page);
    const sheets = await readMatchSheets(page, 3);
    await openCalendar(page);
    await openRound(page, 3);

    const games = roundOf(save, 3);
    const other = games.find((f) => !isMine(save, f))!;
    for (const fixture of [other, mineIn(save, 3)]) {
      await roundCard(page, fixture.id).click();
      const dialog = reportDialog(page);
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.report')).toHaveAttribute('data-fixture', fixture.id);
      const events = sheets[fixture.id]!.events;
      const lines = dialog.locator('li.line');
      await expect(lines).toHaveCount(events.length);
      for (const [i, event] of events.entries()) {
        await expect(lines.nth(i).locator('.kind')).toHaveText(
          kindWord(event, save.game.rules.realism),
        );
        const minute = event.added ? `${event.minute}+${event.added}'` : `${event.minute}'`;
        await expect(lines.nth(i).locator('.minute')).toHaveText(minute);
      }
      await expectStats(dialog, fixture);
      // A folha tem a entrada dela no histórico, no mesmo endereço.
      expect(await page.evaluate(() => history.state?.sheet)).toBe('report');
      await expect(page).toHaveURL(/#\/calendar\/round\/3$/);
      // O voltar do celular fecha a folha e fica na Rodada, com o foco no card que a abriu.
      await page.goBack();
      await expect(dialog).toBeHidden();
      await expect(page).toHaveURL(/#\/calendar\/round\/3$/);
      await expect(heading(page, 'Rodada 3')).toBeVisible();
      await expect(roundCard(page, fixture.id)).toBeFocused();
    }
    // O avançar reabre a súmula do último jogo; o X fecha e o foco volta ao card.
    await page.goForward();
    await expect(reportDialog(page).locator('.report')).toHaveAttribute(
      'data-fixture',
      mineIn(save, 3).id,
    );
    await reportDialog(page)
      .getByRole('button', { name: ui('pt-BR', 'nav.close') })
      .click();
    await expect(reportDialog(page)).toBeHidden();
    await expect(roundCard(page, mineIn(save, 3).id)).toBeFocused();
  });

  test('súmula de uma rodada antiga sem lances: os gols do resultado, sem aviso na moldura (medida 8)', async ({
    page,
    context,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    test.setTimeout(60_000);
    await startCareer(page);
    await playUntil(page, 4);
    const save = await readSave(page);
    const kept = await readMatchSheets(page, 2);
    await dropSheetRow(page, 1);
    expect(await readMatchSheets(page, 1)).toEqual({});

    // Reaberta numa página nova do mesmo contexto (o mesmo banco).
    const fresh = await context.newPage();
    await page.close();
    await continueCareer(fresh);
    await openCalendar(fresh);
    await openRound(fresh, 1);
    const mine = mineIn(save, 1);
    await roundCard(fresh, mine.id).click();
    const dialog = reportDialog(fresh);
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(ui('pt-BR', 'report.missing.title'), { exact: true }),
    ).toBeVisible();
    await expect(dialog).not.toContainText(ui('pt-BR', 'report.events.none'));
    const goals = [...mine.result!.goals].sort(
      (a, b) => a.minute - b.minute || (a.added ?? 0) - (b.added ?? 0),
    );
    const lines = dialog.locator('li.line');
    await expect(lines).toHaveCount(goals.length);
    for (const [i, goal] of goals.entries()) {
      const minute = goal.added ? `${goal.minute}+${goal.added}'` : `${goal.minute}'`;
      await expect(lines.nth(i).locator('.minute')).toHaveText(minute);
      await expect(lines.nth(i)).toContainText(displayName(save, goal.scorer));
    }
    if (goals.length === 0) await expect(dialog).toContainText(ui('pt-BR', 'round.goals.none'));
    const motm = mine.result!.motm;
    if (motm !== undefined) {
      await expect(dialog.locator('.motm .name')).toHaveText(displayName(save, motm));
      await expect(dialog.locator('.motm .rating')).toHaveCount(0);
    }
    await expectStats(dialog, mine);
    // Nenhum aviso da moldura sobre isso.
    await fresh.goBack();
    await expect(dialog).toBeHidden();
    await expect(fresh.locator('.band[role="status"]')).toHaveText('');

    // Na rodada 2, a súmula do mesmo clube tem os lances.
    await fresh.goBack();
    await expect(heading(fresh, 'Calendário')).toBeVisible();
    await openRound(fresh, 2);
    const second = mineIn(save, 2);
    await roundCard(fresh, second.id).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(ui('pt-BR', 'report.missing.title'))).toHaveCount(0);
    await expect(dialog.locator('li.line')).toHaveCount(kept[second.id]!.events.length);
  });

  test('endereço que não vale vira #/calendar sem entrada nova; um endereço digitado volta pelo cabeçalho (medida 9)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await startCareer(page);
    await advance(page, 4);
    await openCalendar(page);
    for (const typed of ['30', 'abc', '4', '0', '39']) {
      const before = await page.evaluate(() => history.length);
      // Digitar o endereço cria a entrada dele; a troca para #/calendar não cria outra.
      await page.evaluate((n) => (location.hash = `#/calendar/round/${n}`), typed);
      await expect(page).toHaveURL(/#\/calendar$/);
      await expect(heading(page, 'Calendário')).toBeVisible();
      expect(await page.evaluate(() => history.length), typed).toBe(before + 1);
    }
    // Uma rodada jogada digitada abre; o voltar do cabeçalho troca o endereço pela lista.
    await page.evaluate(() => (location.hash = '#/calendar/round/3'));
    await expect(heading(page, 'Rodada 3')).toBeVisible();
    const before = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: ui('pt-BR', 'nav.back') }).click();
    await expect(page).toHaveURL(/#\/calendar$/);
    await expect(cardOf(page, 3).getByRole('button')).toBeFocused();
    expect(await page.evaluate(() => history.length)).toBe(before);
  });

  test('"Jogar rodada" na Rodada e na lista: "Continuar" volta ao mesmo endereço (medida 10)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await startCareer(page);
    await advance(page, 3);
    await openCalendar(page);
    await openRound(page, 2);
    await playButton(page).click();
    await expect(roundHeading(page)).toHaveAccessibleName(/^Rodada 3\. /);
    await closeSummary(page);
    await expect(page).toHaveURL(/#\/calendar\/round\/2$/);
    await expect(heading(page, 'Rodada 2')).toBeVisible();
    await expect(roundScreen(page)).toHaveAttribute('data-round', '2');

    // Na lista, a volta abre na próxima rodada nova.
    await page.goBack();
    await expect(cards(page)).toHaveCount(38);
    await playButton(page).click();
    await expect(roundHeading(page)).toHaveAccessibleName(/^Rodada 4\. /);
    await closeSummary(page);
    await expect(page).toHaveURL(/#\/calendar$/);
    await expect(cardOf(page, 5).getByText(ui('pt-BR', 'club.next.title'))).toBeVisible();
    await expectCardInView(page, 5, 'depois do resumo');
    await expect(cardOf(page, 4).getByRole('button')).toHaveCount(1);
    // A entrada da lista esqueceu a rodada 2: voltando a ela depois de outra aba, a lista abre na
    // próxima rodada, e não no card antigo.
    expect(await page.evaluate(() => history.state?.calendarFrom)).toBeUndefined();
    await page
      .getByRole('navigation', { name: ui('pt-BR', 'nav.label') })
      .getByRole('link', { name: ui('pt-BR', 'nav.tab.club'), exact: true })
      .click();
    await expect(heading(page, 'Clube')).toBeVisible();
    await page.goBack();
    await expect(heading(page, 'Calendário')).toBeVisible();
    await expect(cards(page)).toHaveCount(38);
    await expectCardInView(page, 5, 'de volta depois de outra aba');
    await expect(cardOf(page, 2).getByRole('button')).not.toBeFocused();
  });

  test('temporada encerrada: sem destaque, 38 botões e a rodada 38 à vista (medida 11)', async ({
    page,
  }) => {
    await startCareer(page);
    await advance(page, 39);
    await openCalendar(page);
    await expect(list(page).getByText(ui('pt-BR', 'club.next.title'))).toHaveCount(0);
    await expect(list(page).getByRole('button')).toHaveCount(38);
    await expect(cardOf(page, 38)).toBeInViewport();
    await expectCardInView(page, 38, 'temporada encerrada');
    await expect(playButton(page)).toContainText(ui('pt-BR', 'play.blocked.seasonOver'));
  });

  test('nomes inteiros e turnos em 1 linha a 360 × 740 com Inter-Regional, em pt-BR, es e en (medida 12)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'medida a 360 × 740');
    await page.setViewportSize({ width: 360, height: 740 });
    await startCareer(page);
    await advance(page, 6, (s) => {
      s.career.clubId = clubNamed(s, 'Inter-Regional');
    });
    for (const lang of ['pt-BR', 'es', 'en'] as const) {
      if (lang !== 'pt-BR') await reopenIn(page, lang);
      await openCalendar(page, lang);
      await expect(list(page)).toContainText('Inter-Regional');
      const cut = await list(page).evaluate((el) =>
        Array.from(el.querySelectorAll<HTMLElement>('.name'))
          .filter((name) => name.scrollWidth > name.clientWidth)
          .map((name) => name.textContent),
      );
      expect(cut, `${lang}: nomes cortados`).toEqual([]);
      const titles = await list(page).evaluate((el) =>
        Array.from(el.querySelectorAll<HTMLElement>('h2')).map((h) => ({
          text: h.textContent,
          height: h.getBoundingClientRect().height,
          line: parseFloat(getComputedStyle(h).lineHeight),
        })),
      );
      expect(titles).toHaveLength(2);
      for (const title of titles) {
        expect(title.height, `${lang}: ${title.text} em 1 linha`).toBeLessThanOrEqual(
          title.line + 0.5,
        );
      }
      // O pé quebra em linhas, nunca corta.
      const foot = await list(page).evaluate(
        (el) =>
          Array.from(el.querySelectorAll<HTMLElement>('.foot')).filter(
            (f) => f.scrollWidth > f.clientWidth,
          ).length,
      );
      expect(foot, `${lang}: pé cortado`).toBe(0);
    }
  });

  test('sem rolagem lateral em 360, 390, 844 e 1280, na lista, na Rodada e com a súmula, nos três idiomas (medida 13)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await startCareer(page);
    const save = await advance(page, 6);
    const sizes = onPhone(page)
      ? ([
          [360, 740],
          [390, 844],
          [844, 390],
        ] as const)
      : ([[1280, 800]] as const);
    for (const lang of ['pt-BR', 'es', 'en'] as const) {
      if (lang !== 'pt-BR') await reopenIn(page, lang);
      await openCalendar(page, lang);
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await noSideScroll(page, `${lang} ${width}: lista`);
      }
      await openRound(page, 5, lang);
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await noSideScroll(page, `${lang} ${width}: Rodada`);
      }
      await roundCard(page, mineIn(save, 5).id).click();
      await expect(reportDialog(page, lang)).toBeVisible();
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await noSideScroll(page, `${lang} ${width}: súmula`);
      }
      await page.goBack();
      await expect(reportDialog(page, lang)).toBeHidden();
      await page.goBack();
      await expect(heading(page, ui(lang, 'nav.tab.calendar'))).toBeVisible();
    }
  });

  test('duas colunas a 844 e 1280, uma a 360 e 390, na lista e na Rodada (medida 14)', async ({
    page,
  }) => {
    await startCareer(page);
    await advance(page, 6);
    await openCalendar(page);
    const half = list(page).locator('section').first().locator('li[data-round]');
    const sizes = onPhone(page)
      ? ([
          [360, 740, 1],
          [390, 844, 1],
          [844, 390, 2],
        ] as const)
      : ([[1280, 800, 2]] as const);
    for (const [width, height, count] of sizes) {
      await page.setViewportSize({ width, height });
      expect(await columns(half), `lista a ${width}`).toBe(count);
    }
    await openRound(page, 4);
    for (const [width, height, count] of sizes) {
      await page.setViewportSize({ width, height });
      expect(await columns(roundCards(page)), `Rodada a ${width}`).toBe(count);
    }
    // Ordem da rodada nas duas colunas: 1 e 2 na primeira linha.
    if (!onPhone(page)) {
      const firstRow = await half.evaluateAll((els) =>
        els.slice(0, 2).map((el) => Math.round(el.getBoundingClientRect().y)),
      );
      expect(firstRow[0]).toBe(firstRow[1]);
    }
  });

  test('movimento: com movimento reduzido, nenhuma animação na lista, na Rodada e com a súmula (medida 15)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startCareer(page);
    const save = await advance(page, 5);
    await openCalendar(page);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await openRound(page, 2);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await roundCard(page, mineIn(save, 2).id).click();
    await expect(reportDialog(page)).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('Simplificado: nenhuma linha de súmula com "Amarelo e suspensão" (medida 16)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    test.setTimeout(90_000);
    await startCareer(page, { realism: 'simplified' });
    await playUntil(page, 4);
    const save = await readSave(page);
    expect(save.game.rules.realism).toBe('simplified');
    const suspended = ui('pt-BR', 'report.event.yellowSuspended');
    await openCalendar(page);
    for (const round of [1, 3]) {
      const sheets = await readMatchSheets(page, round);
      await openRound(page, round);
      for (const fixture of roundOf(save, round)) {
        await roundCard(page, fixture.id).click();
        await expect(reportDialog(page).locator('li.line')).toHaveCount(
          sheets[fixture.id]!.events.length,
        );
        await expect(reportDialog(page)).not.toContainText(suspended);
        await page.goBack();
        await expect(reportDialog(page)).toBeHidden();
      }
      await page.goBack();
      await expect(cards(page)).toHaveCount(38);
    }
  });
});
