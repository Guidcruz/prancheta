import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { getStandings, type GameState, type StandingRow } from '../../app/src/engine/index.ts';
import { closeSummary, reopenIn, startCareer } from './career.ts';
import { setTheme } from './css.ts';
import { expect, playButton, test } from './fixtures.ts';
import { patchSave, playInEngine, readSave, type SaveJson } from './save.ts';

/*
 * A aba Tabela (T-031; US-023; docs/design/telas/tabela.md, "Medidas para o E2E"). Cada teste diz
 * as medidas que cobre. As rodadas adiante são jogadas no motor, no Node, e gravadas no save
 * (`playInEngine` + `patchSave`), menos a primeira, jogada pelo "Jogar rodada" para conferir a
 * volta do resumo à Tabela. O que depende de largura roda no projeto de celular com a janela que
 * a medida pede; o desktop (1280×800) roda no projeto de desktop. Os textos e cada estado da tela
 * nos três idiomas estão também no Vitest (app/src/ui/table-screens.test.ts).
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

/** A frase da mudança para o leitor de tela (round.table.up.* / down.*), em pt-BR. */
function changeText(change: number): string {
  const n = Math.abs(change);
  const key = `round.table.${change > 0 ? 'up' : 'down'}.${n === 1 ? 'one' : 'other'}`;
  return ui('pt-BR', key, { count: n });
}

const signed = (n: number, lang: Lang = 'pt-BR') =>
  new Intl.NumberFormat(lang, { signDisplay: 'exceptZero' }).format(n);
const percent = (row: StandingRow) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(
    row.points / (row.played * 3),
  );
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const COLUMNS = [
  'points',
  'played',
  'wins',
  'draws',
  'losses',
  'goalsFor',
  'goalsAgainst',
  'goalDiff',
  'percent',
  'form',
] as const;

const onPhone = (page: Page) => page.viewportSize()!.width < 900;
const gameOf = (save: SaveJson) => save.game as unknown as GameState;
const nameOf = (save: SaveJson, id: string) => save.game.clubs[id]!.def.shortName;

const table = (page: Page) => page.locator('main table');
const box = (page: Page) => page.locator('main .scroll-table');
const rows = (page: Page) => table(page).locator('tbody tr');
const rowHeader = (page: Page, i: number) => rows(page).nth(i).locator('th[scope="row"]');
const mineRow = (page: Page) => table(page).locator('tbody tr[aria-current="true"]');
const legend = (page: Page) => page.locator('main section.legend');

/** Abre a aba Tabela pela navegação visível (abas embaixo no celular, barra lateral no desktop). */
async function openTable(page: Page, lang: Lang = 'pt-BR'): Promise<void> {
  await page
    .getByRole('navigation', { name: ui(lang, 'nav.label') })
    .getByRole('link', { name: ui(lang, 'nav.tab.table'), exact: true })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: ui(lang, 'nav.tab.table') }),
  ).toBeVisible();
  await expect(rows(page)).toHaveCount(20);
}

/** Volta à aba Clube pela navegação visível. */
async function openClub(page: Page, lang: Lang = 'pt-BR'): Promise<void> {
  await page
    .getByRole('navigation', { name: ui(lang, 'nav.label') })
    .getByRole('link', { name: ui(lang, 'nav.tab.club'), exact: true })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: ui(lang, 'nav.tab.club') }),
  ).toBeVisible();
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

/** O clube que está em `position` na tabela do save. */
const clubAt = (save: SaveJson, position: number) =>
  getStandings(gameOf(save)).find((r) => r.position === position)!.clubId;

/** O id do clube de nome curto `name`. */
const clubNamed = (save: SaveJson, name: string) =>
  Object.keys(save.game.clubs).find((id) => nameOf(save, id) === name)!;

/** Sem rolagem lateral da página. */
async function noPageScroll(page: Page, label: string): Promise<void> {
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(size.scroll, `${label}: rolagem lateral da página`).toBeLessThanOrEqual(size.client);
}

/** A caixa da tabela: se rola por dentro, e a largura da coluna fixa contra a da caixa. */
async function boxGeometry(page: Page) {
  return box(page).evaluate((el) => {
    const first = el.querySelector('tbody th[scope="row"]')!.getBoundingClientRect();
    return { scroll: el.scrollWidth, client: el.clientWidth, fixed: first.width };
  });
}

test.describe('Tabela (T-031)', () => {
  test('coluna fixa até 60% da caixa, a caixa rola por dentro e os cabeçalhos na ordem (medida 1)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'medida a 360 px');
    await page.setViewportSize({ width: 360, height: 740 });
    await startCareer(page);
    await advance(page, 4);
    await openTable(page);

    const geometry = await box(page).evaluate(async (el) => {
      const first = el.querySelector('tbody th[scope="row"]')!;
      const before = first.getBoundingClientRect().x;
      const scrolls = el.scrollWidth > el.clientWidth;
      el.scrollLeft = el.scrollWidth;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const after = first.getBoundingClientRect();
      return {
        scrolls,
        scrolled: el.scrollLeft,
        before,
        after: after.x,
        width: after.width,
        box: el.clientWidth,
      };
    });
    expect(geometry.scrolls, 'a caixa da tabela rola').toBe(true);
    expect(geometry.scrolled).toBeGreaterThan(0);
    expect(
      Math.abs(geometry.after - geometry.before),
      'a coluna fixa não sai do lugar',
    ).toBeLessThanOrEqual(1);
    expect(geometry.width, 'coluna fixa com o respiro e a borda').toBeLessThanOrEqual(
      geometry.box * 0.6 + 0.5,
    );
    await noPageScroll(page, '360');

    // Clube, Pts, J, V, E, D, GP, GC, SG, %, Últimos 5: a sigla visível, o nome completo lido.
    const headers = table(page).locator('thead th[scope="col"]');
    await expect(headers).toHaveCount(11);
    await expect(headers.nth(0)).toHaveAccessibleName(ui('pt-BR', 'table.col.club'));
    for (const [i, id] of COLUMNS.entries()) {
      const header = headers.nth(i + 1);
      await expect(header).toHaveAccessibleName(ui('pt-BR', `table.col.${id}.full`));
      await expect(header.locator('[aria-hidden="true"]')).toHaveText(
        ui('pt-BR', `table.col.${id}`),
      );
      await expect(header).not.toHaveAttribute('aria-sort');
    }
  });

  test('ordem e números iguais ao getStandings do save; % e Últimos 5; tabular-nums (medida 2)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez');
    await startCareer(page);
    const save = await advance(page, 7);
    await openTable(page);
    const standings = getStandings(gameOf(save));
    for (const [i, row] of standings.entries()) {
      await expect(rowHeader(page, i), row.clubId).toContainText(nameOf(save, row.clubId));
      const cells = await rows(page).nth(i).locator('td.stat').allTextContents();
      expect(
        cells.map((c) => c.trim()),
        row.clubId,
      ).toEqual([
        String(row.points),
        String(row.played),
        String(row.wins),
        String(row.draws),
        String(row.losses),
        String(row.goalsFor),
        String(row.goalsAgainst),
        signed(row.goalDifference),
        percent(row),
      ]);
      const form = rows(page).nth(i).locator('td.form .badge');
      await expect(form).toHaveCount(row.form.length);
      for (const [k, result] of row.form.entries()) {
        await expect(form.nth(k).locator('.short')).toHaveText(
          ui('pt-BR', `result.${result}.short`),
        );
        await expect(form.nth(k)).toContainText(ui('pt-BR', `result.${result}`));
      }
    }
    const numeric = await rows(page)
      .first()
      .locator('td.stat')
      .first()
      .evaluate((el) => getComputedStyle(el).fontVariantNumeric);
    expect(numeric).toContain('tabular-nums');
    const position = await rows(page)
      .first()
      .locator('.mark')
      .evaluate((el) => getComputedStyle(el).fontVariantNumeric);
    expect(position).toContain('tabular-nums');
  });

  test('mudança da última rodada: seta, número com sinal e a frase do resumo (medida 3)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez');
    await startCareer(page);
    // Depois de 3 rodadas; se ninguém subiu 2 ou mais, a próxima rodada (e o teste diz qual).
    const start = await readSave(page);
    let round = 4;
    let game = playInEngine(start, round);
    const moved = (g: SaveJson['game'], r: number) => {
      const before = getStandings(g as unknown as GameState, r - 2);
      return getStandings(g as unknown as GameState, r - 1).some(
        (row) => before.find((b) => b.clubId === row.clubId)!.position - row.position >= 2,
      );
    };
    while (!moved(game, round) && round < 12) game = playInEngine({ ...start, game }, ++round);
    expect(moved(game, round), 'algum clube subiu 2 ou mais').toBe(true);
    if (round !== 4) {
      test
        .info()
        .annotations.push({ type: 'rodada', description: `mudança da rodada ${round - 1}` });
    }
    const save = await patchSave(page, (s) => {
      s.game = game;
    });
    await openTable(page);

    const before = getStandings(gameOf(save), round - 2);
    const after = getStandings(gameOf(save), round - 1);
    for (const [i, row] of after.entries()) {
      const change = before.find((b) => b.clubId === row.clubId)!.position - row.position;
      const move = rows(page).nth(i).locator('.move');
      await expect(move).toHaveAttribute('aria-hidden', 'true');
      if (change === 0) {
        await expect(move.locator('svg'), row.clubId).toHaveCount(0);
        await expect(move, row.clubId).toHaveText('');
        continue;
      }
      await expect(move.locator('svg path'), row.clubId).toHaveAttribute(
        'd',
        change > 0 ? /^M12 19V5/ : /^M12 5v14/,
      );
      await expect(move, row.clubId).toHaveText(signed(change));
      await expect(rowHeader(page, i), row.clubId).toHaveAccessibleName(
        new RegExp(`${escape(changeText(change))}$`),
      );
    }
  });

  test('a seta se mexe uma vez, por no máximo 400 ms, e fica parada com movimento reduzido (medida 4)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez');
    await startCareer(page);
    await advance(page, 5);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openTable(page);
    await expect(rows(page).locator('.move svg').first()).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

    await openClub(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const animations = await page.evaluate(async () => {
      const link = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href="#/table"]'),
      ).find((a) => a.closest('nav') !== null && a.getClientRects().length > 0)!;
      link.click();
      for (let i = 0; i < 60 && document.querySelector('main .table-screen') === null; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return document.getAnimations().map((a) => {
        const timing = a.effect!.getComputedTiming();
        return { iterations: timing.iterations, duration: Number(timing.duration) };
      });
    });
    expect(animations.length, 'as setas se mexem ao abrir').toBeGreaterThan(0);
    for (const animation of animations) {
      expect(animation.iterations).toBe(1);
      expect(animation.duration).toBeLessThanOrEqual(400);
    }
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('pré-temporada, a rodada 1 pelo "Jogar rodada" e as zonas nos dois temas (medidas 5, 8 e 9)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez');
    await startCareer(page);
    await openTable(page);

    // (8) Pré-temporada: a caption da pré-temporada, todos com 0 ponto, sem zona, sem mudança,
    // sem legenda.
    await expect(table(page).locator('caption')).toHaveText(ui('pt-BR', 'club.table.preseason'));
    await expect(table(page).locator('caption')).toBeVisible();
    for (let i = 0; i < 20; i++) {
      await expect(rows(page).nth(i).locator('td.stat').first()).toHaveText('0');
    }
    await expect(table(page).locator('.zone:not(:empty)')).toHaveCount(0);
    await expect(table(page).locator('[data-zone]')).toHaveCount(0);
    await expect(table(page).locator('.move svg')).toHaveCount(0);
    await expect(legend(page)).toHaveCount(0);

    // (9) "Jogar rodada" na Tabela; "Continuar" volta a ela, já com a tabela nova.
    await playButton(page).click();
    await closeSummary(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Tabela' })).toBeVisible();
    await expect(table(page).locator('caption')).toHaveText(
      ui('pt-BR', 'table.caption', { round: 1 }),
    );
    await expect(table(page).locator('.move svg')).toHaveCount(0);
    await expect(table(page).locator('.move:not(:empty)')).toHaveCount(0);
    const save = await readSave(page);
    const standings = getStandings(gameOf(save));
    for (const [i, row] of standings.entries()) {
      await expect(rowHeader(page, i)).toContainText(nameOf(save, row.clubId));
    }

    // (5) Zonas: o 1º "Líder", do 17º ao 20º "Rebaixamento", os outros sem palavra; a legenda.
    for (const theme of ['noite', 'dia'] as const) {
      await setTheme(page, theme);
      const zones = await rows(page).locator('.zone').allTextContents();
      expect(
        zones.map((z) => z.trim()),
        theme,
      ).toEqual([
        ui('pt-BR', 'table.zone.leader'),
        ...Array<string>(15).fill(''),
        ...Array<string>(4).fill(ui('pt-BR', 'table.zone.relegation')),
      ]);
      await expect(rows(page).first().locator('.zone')).toBeVisible();
      await expect(rows(page).last().locator('.zone')).toBeVisible();
      await expect(legend(page)).toBeVisible();
      for (const key of ['table.legend.leader', 'table.legend.movement']) {
        await expect(legend(page)).toContainText(ui('pt-BR', key));
      }
      await expect(legend(page)).toContainText(
        ui('pt-BR', 'table.legend.relegation', { count: 4 }),
      );
      await expect(
        page.getByRole('heading', { level: 2, name: ui('pt-BR', 'table.legend.title') }),
      ).toHaveCount(1);
    }
  });

  test('meu clube destacado, e o link "Tabela" do Clube abre a aba (medida 6)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez');
    await startCareer(page);
    const save = await advance(page, 4);
    await page.getByRole('link', { name: ui('pt-BR', 'club.table.actionA11y') }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tabela' })).toBeVisible();

    const mine = mineRow(page);
    await expect(mine).toHaveCount(1);
    await expect(mine.locator('th[scope="row"]')).toContainText(nameOf(save, save.career.clubId));
    await expect(mine.locator('th[scope="row"]')).toHaveAccessibleName(
      new RegExp(ui('pt-BR', 'table.mine')),
    );
    const weight = await mine
      .locator('.name')
      .evaluate((el) => Number(getComputedStyle(el).fontWeight));
    expect(weight).toBeGreaterThanOrEqual(600);
    const other = table(page).locator('tbody tr:not([aria-current])').first();
    const background = (row: typeof mine) =>
      row
        .locator('td')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await background(mine)).not.toBe(await background(other));
  });

  test('a célula do clube é lida na ordem posição, nome, "seu clube", zona e mudança (medida 7)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez');
    await startCareer(page);
    // A primeira rodada (a partir da 3ª) em que um clube numa zona mudou de posição; ele vira o
    // meu clube.
    const start = await readSave(page);
    let found: { round: number; clubId: string } | undefined;
    let game = start.game;
    for (let round = 4; round <= 15 && found === undefined; round++) {
      game = playInEngine({ ...start, game }, round);
      const before = getStandings(game as unknown as GameState, round - 2);
      const after = getStandings(game as unknown as GameState, round - 1);
      const pick = after.find(
        (row) =>
          (row.position === 1 || row.position > 16) &&
          before.find((b) => b.clubId === row.clubId)!.position !== row.position,
      );
      if (pick !== undefined) found = { round, clubId: pick.clubId };
    }
    expect(found, 'um clube numa zona que mudou de posição').toBeDefined();
    test
      .info()
      .annotations.push({ type: 'rodada', description: `mudança da rodada ${found!.round - 1}` });
    const save = await patchSave(page, (s) => {
      s.game = game;
      s.career.clubId = found!.clubId;
    });
    await openTable(page);

    const g = gameOf(save);
    const row = getStandings(g).find((r) => r.clubId === found!.clubId)!;
    const before = getStandings(g, found!.round - 2).find((r) => r.clubId === found!.clubId)!;
    const zone = ui('pt-BR', row.position === 1 ? 'table.zone.leader' : 'table.zone.relegation');
    const parts = [
      String(row.position),
      nameOf(save, row.clubId),
      ui('pt-BR', 'table.mine'),
      zone,
      changeText(before.position - row.position),
    ];
    await expect(mineRow(page).locator('th[scope="row"]')).toHaveAccessibleName(
      new RegExp(`^${parts.map(escape).join('\\s*')}$`),
    );
  });

  test('temporada encerrada: a classificação final, o campeão e o "Jogar rodada" bloqueado (medida 10)', async ({
    page,
  }) => {
    await startCareer(page);
    const save = await advance(page, 39);
    await openTable(page);
    await expect(table(page).locator('caption')).toHaveText(
      ui('pt-BR', 'table.caption.final', { season: (save.game as unknown as GameState).year }),
    );
    await expect(rows(page).first().locator('.zone')).toHaveText(
      ui('pt-BR', 'table.zone.champion'),
    );
    await expect(rows(page).first().locator('[data-zone="leader"]')).toHaveCount(1);
    await expect(legend(page)).toContainText(ui('pt-BR', 'table.legend.champion'));
    await expect(legend(page)).not.toContainText(ui('pt-BR', 'table.legend.leader'));
    await expect(playButton(page)).toContainText(ui('pt-BR', 'play.blocked.seasonOver'));
    // A mudança da rodada 38 continua.
    const g = gameOf(save);
    const before = getStandings(g, 37);
    const changed = getStandings(g, 38).filter(
      (r) => before.find((b) => b.clubId === r.clubId)!.position !== r.position,
    ).length;
    await expect(table(page).locator('.move svg')).toHaveCount(changed);
  });

  test('abre mostrando o meu clube: do 12º para baixo, no meio da área; entre os 5 primeiros, no topo (medida 11)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'medida a 360 × 740');
    await page.setViewportSize({ width: 360, height: 740 });
    await startCareer(page);
    const save = await advance(page, 6, (s) => {
      s.career.clubId = clubAt(s, 15);
    });
    expect(getStandings(gameOf(save)).find((r) => r.clubId === save.career.clubId)!.position).toBe(
      15,
    );
    // O Clube rolado para baixo: a Tabela não herda a rolagem.
    await page.evaluate(() => window.scrollTo(0, 300));
    await openTable(page);

    const where = await page.evaluate(() => {
      const row = document
        .querySelector('main tbody tr[aria-current="true"]')!
        .getBoundingClientRect();
      const header = document.querySelector('header.header')!.getBoundingClientRect();
      const play = Array.from(document.querySelectorAll<HTMLElement>('button.play')).find(
        (b) => b.getClientRects().length > 0,
      )!;
      return {
        top: row.top,
        bottom: row.bottom,
        headerBottom: header.bottom,
        playTop: play.getBoundingClientRect().top,
        scrollY: window.scrollY,
        maxScroll: document.documentElement.scrollHeight - window.innerHeight,
      };
    });
    expect(where.scrollY).toBeGreaterThan(0);
    expect(where.top).toBeGreaterThanOrEqual(Math.max(where.headerBottom, 0) - 0.5);
    expect(where.bottom).toBeLessThanOrEqual(where.playTop + 0.5);
    if (where.scrollY < where.maxScroll) {
      const middle = (Math.max(where.headerBottom, 0) + where.playTop) / 2;
      expect(Math.abs((where.top + where.bottom) / 2 - middle)).toBeLessThanOrEqual(2);
    }

    // Entre os 5 primeiros, a tela fica no topo.
    await patchSave(page, (s) => {
      s.career.clubId = clubAt(s, 3);
    });
    await page.evaluate(() => window.scrollTo(0, 300));
    await openTable(page);
    await expect(mineRow(page)).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('nomes inteiros a 360 × 740 com Inter-Regional, a zona em uma linha, em pt-BR, es e en (medida 12)', async ({
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
      await openTable(page, lang);
      await expect(mineRow(page)).toContainText('Inter-Regional');
      const cut = await table(page).evaluate((el) =>
        Array.from(el.querySelectorAll<HTMLElement>('tbody .name'))
          .filter((name) => name.scrollWidth > name.clientWidth)
          .map((name) => name.textContent),
      );
      expect(cut, `${lang}: nomes cortados`).toEqual([]);
      const zones = await table(page).evaluate((el) =>
        Array.from(el.querySelectorAll<HTMLElement>('tbody .zone'))
          .filter((zone) => zone.textContent!.trim() !== '')
          .map((zone) => ({
            text: zone.textContent,
            height: zone.getBoundingClientRect().height,
            line: parseFloat(getComputedStyle(zone).lineHeight),
            wraps: zone.scrollWidth > zone.clientWidth,
          })),
      );
      expect(zones).toHaveLength(5);
      for (const zone of zones) {
        expect(zone.height, `${lang}: ${zone.text} em uma linha`).toBeLessThanOrEqual(
          zone.line + 0.5,
        );
        expect(zone.wraps, `${lang}: ${zone.text} inteiro`).toBe(false);
      }
      const geometry = await boxGeometry(page);
      expect(geometry.fixed, `${lang}: coluna fixa`).toBeLessThanOrEqual(
        geometry.client * 0.6 + 0.5,
      );
      await noPageScroll(page, lang);
    }
  });

  test('linhas da mesma altura, de pelo menos 44 px, e nada tocável na tabela (medida 13)', async ({
    page,
  }) => {
    await startCareer(page);
    await advance(page, 4);
    await openTable(page);
    const heights = await rows(page).evaluateAll((trs) =>
      trs.map((tr) => tr.getBoundingClientRect().height),
    );
    expect(heights).toHaveLength(20);
    for (const height of heights) {
      expect(height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(height - heights[0]!)).toBeLessThanOrEqual(1);
    }
    await expect(table(page).locator('a, button')).toHaveCount(0);
  });

  test('sem rolagem lateral da página em 360, 390, 844 e 1280, nos três idiomas; a 844 e 1280 a tabela cabe (medida 14)', async ({
    page,
  }) => {
    await startCareer(page);
    // Cinco rodadas jogadas: os Últimos 5 na largura máxima.
    await advance(page, 8);
    const sizes = onPhone(page)
      ? [
          [360, 740],
          [390, 844],
          [844, 390],
        ]
      : [[1280, 800]];
    for (const lang of ['pt-BR', 'es', 'en'] as const) {
      if (lang !== 'pt-BR') await reopenIn(page, lang);
      await openTable(page, lang);
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width: width!, height: height! });
        await noPageScroll(page, `${lang} ${width}`);
        if (width! >= 844) {
          const geometry = await boxGeometry(page);
          expect(geometry.scroll, `${lang} ${width}: a tabela cabe`).toBeLessThanOrEqual(
            geometry.client,
          );
        }
      }
    }
  });

  test('desktop: a Tabela marcada na barra lateral e a tabela inteira sem rolar (medida 15)', async ({
    page,
  }) => {
    test.skip(onPhone(page), 'desktop');
    await startCareer(page);
    await advance(page, 8);
    await openTable(page);
    const side = page.locator('aside nav');
    await expect(side.getByRole('link', { name: 'Tabela', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const geometry = await boxGeometry(page);
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.client);
    await expect(legend(page)).toBeVisible();
  });

  test('Simplificado: a mesma tabela, com o desempate do motor', async ({ page }) => {
    test.skip(!onPhone(page), 'uma vez');
    await startCareer(page, { realism: 'simplified' });
    const save = await advance(page, 5);
    await openTable(page);
    for (const [i, row] of getStandings(gameOf(save)).entries()) {
      await expect(rowHeader(page, i)).toContainText(nameOf(save, row.clubId));
    }
    await expect(legend(page)).toBeVisible();
  });
});
