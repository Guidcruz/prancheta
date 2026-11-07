import type { Locator, Page } from '@playwright/test';
import {
  POTENTIAL_STORED_MAX,
  getStandings,
  isProspect,
  type GameState,
  type Player,
} from '../../app/src/engine/index.ts';
import { playUntil, startCareer } from './career.ts';
import { expect, test } from './fixtures.ts';
import { changePlayer, patchSave, readSave, type SaveJson } from './save.ts';

/*
 * Clube, Elenco e card do jogador (T-028; US-015, US-016, US-026): as "Medidas para o E2E" de
 * docs/design/telas/clube.md, elenco.md e jogador.md, o que é CSS, toque, foco, histórico e
 * diálogo de verdade. Os textos por idioma e cada estado das telas estão no Vitest
 * (app/src/ui/club-screens.test.ts); a regra de que a interface nunca lê o potencial, em
 * app/src/ui/squad.test.ts.
 */

const SIDE_FROM = 900;
const MOODS = ['Em revolta', 'Irritada', 'Desconfiada', 'Animada', 'Em festa'];

/** As larguras de cada projeto: o celular em pé (duas) e deitado; o desktop. */
function sizesOf(page: Page) {
  return page.viewportSize()!.width >= SIDE_FROM
    ? [{ width: 1280, height: 800 }]
    : [
        { width: 390, height: 844 },
        { width: 360, height: 740 },
        { width: 844, height: 390 },
      ];
}

async function setTheme(page: Page, theme: 'noite' | 'dia'): Promise<void> {
  await page.evaluate((name) => (document.documentElement.dataset.theme = name), theme);
}

async function noPageScroll(page: Page): Promise<void> {
  const box = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(box.scroll, 'rolagem lateral da página').toBeLessThanOrEqual(box.client);
}

/**
 * Os alvos visíveis da área de conteúdo menores que 44×44 px, menos os que ficam dentro de outro
 * alvo. Um rádio escondido conta pelo rótulo que o envolve.
 */
async function smallTargets(scope: Locator) {
  return scope.evaluate((root) => {
    const selector = 'a[href], button, input, select';
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
    };
    return Array.from(root.querySelectorAll(selector))
      .filter((el) => !el.parentElement?.closest(selector))
      .map((el) => (el instanceof HTMLInputElement && el.labels?.[0] ? el.labels[0] : el))
      .filter(visible)
      .map((el) => {
        const box = el.getBoundingClientRect();
        return {
          name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      })
      .filter((t) => t.width < 44 || t.height < 44);
  });
}

/** A cor computada de um token no tema atual (resolvida por um elemento de prova). */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(--${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

/**
 * Imita o WebKit, que não move o foco num toque: impede o foco do mouse emulado, de modo que o
 * único foco depois do toque é o dado por script (o que desenhava o anel no iPhone). No WebKit
 * do CI é inofensivo.
 */
async function emulateWebKitTapFocus(page: Page): Promise<void> {
  await page.addInitScript(() =>
    document.addEventListener('mousedown', (event) => event.preventDefault(), { capture: true }),
  );
}

/** Condição 74, moral 60 e forma 5,5 no primeiro jogador; forma vazia no segundo. */
async function forceStates(page: Page): Promise<{ banded: string; noForm: string }> {
  let names = { banded: '', noForm: '' };
  await patchSave(page, (save) => {
    const [a, b] = squadOf(save);
    changePlayer(save, a!.id, { condition: 74, morale: 60, recentRatings: [5.5] });
    changePlayer(save, b!.id, { condition: 90, morale: 30, recentRatings: [] });
    names = { banded: a!.name.display, noForm: b!.name.display };
  });
  return names;
}

const LEVEL_CLASS = /level-(good|fair|poor)/;

const main = (page: Page) => page.locator('main');
const block = (page: Page, name: string) => main(page).locator(`[data-block="${name}"]`);
const squadTab = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Elenco' });

async function openSquad(page: Page): Promise<void> {
  await squadTab(page).click();
  await expect(page).toHaveURL(/#\/squad$/);
  await expect(main(page).locator('tbody th[scope="row"]')).toHaveCount(25);
}

/** Os jogadores do clube do técnico na ordem do elenco, para os ajustes de fixture. */
function squadOf(save: SaveJson): Player[] {
  return save.game.squads[save.career.clubId]!.map(
    (id) => save.game.players[id] as unknown as Player,
  );
}

test.describe('Clube (clube.md; US-015, US-026)', () => {
  test('rodada 5: adversário com mando, posição do getStandings e termômetro em número e palavra', async ({
    page,
  }) => {
    await startCareer(page);
    await playUntil(page, 5);
    const save = await readSave(page);
    const mine = save.career.clubId;
    const fixture = save.game.fixtures.find(
      (f) => f.round === 5 && (f.homeId === mine || f.awayId === mine),
    )!;
    const home = fixture.homeId === mine;
    const opponent = save.game.clubs[home ? fixture.awayId : fixture.homeId]!.def.shortName;

    const card = block(page, 'next').locator('a.match');
    await expect(card).toHaveAttribute('href', '#/calendar');
    await expect(card).toContainText(opponent);
    await expect(card).toContainText(home ? 'Em casa' : 'Fora de casa');
    await expect(card).toContainText('Rodada 5');

    const row = getStandings(save.game as unknown as GameState).find((r) => r.clubId === mine)!;
    await expect(block(page, 'table').locator('[data-position]')).toHaveAttribute(
      'data-position',
      String(row.position),
    );
    await expect(block(page, 'table').locator('[data-position]')).toHaveText(`${row.position}º`);

    const fans = block(page, 'fans');
    await expect(fans.locator('.number')).toHaveText(
      String(Math.round(save.game.clubs[mine]!.fans)),
    );
    const mood = (await fans.locator('.label').innerText()).trim();
    expect(MOODS).toContain(mood);
    await expect(fans.locator('.label')).toBeVisible();
    await expect(fans.locator('.bar')).toHaveAttribute('aria-hidden', 'true');
  });

  test('sem rolagem lateral, alvos de 44 px, pé igual ao "Mais" e a ordem dos blocos', async ({
    page,
  }) => {
    await startCareer(page);
    for (const size of sizesOf(page)) {
      await page.setViewportSize(size);
      for (const theme of ['noite', 'dia'] as const) {
        await setTheme(page, theme);
        await noPageScroll(page);
        expect(await smallTargets(main(page)), `${size.width}/${theme}`).toEqual([]);
      }
      const at = async (name: string) => (await block(page, name).boundingBox())!;
      const [next, fans, table] = [await at('next'), await at('fans'), await at('table')];
      // DOM order: next, fans, table; from 720px of column the fans go to the right.
      const order = await main(page).evaluate((root) =>
        Array.from(root.querySelectorAll('[data-block]'), (el) => el.getAttribute('data-block')),
      );
      expect(order).toEqual(['next', 'fans', 'table']);
      if (size.width >= 844) {
        expect(fans.x, `${size.width}: Torcida à direita`).toBeGreaterThan(next.x + next.width - 1);
        expect(table.x).toBeCloseTo(next.x, 0);
      } else {
        expect(fans.x).toBeCloseTo(next.x, 0);
        expect(fans.y).toBeGreaterThan(next.y);
        expect(table.y).toBeGreaterThan(fans.y);
      }

      const foot = main(page).locator('section.more');
      if (size.width < SIDE_FROM) {
        await expect(foot).toBeVisible();
        const footLabels = await foot.getByRole('link').allInnerTexts();
        await page.getByRole('button', { name: 'Mais opções' }).click();
        const menuLabels = await page.getByRole('dialog').getByRole('link').allInnerTexts();
        expect(footLabels.map((s) => s.trim())).toEqual(menuLabels.map((s) => s.trim()));
        await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
        await expect(page.getByRole('dialog')).toBeHidden();
      } else {
        await expect(foot).toBeHidden();
      }
    }
  });

  test('mini tabela a 360 px: nenhum nome cortado e sem rolagem lateral (medida 9)', async ({
    page,
  }) => {
    test.skip(page.viewportSize()!.width >= SIDE_FROM, 'a medida é do celular estreito');
    await startCareer(page);
    await page.setViewportSize({ width: 360, height: 740 });
    const table = block(page, 'table').locator('table');
    await expect(table.locator('tbody th[scope="row"]')).toHaveCount(3);
    const names = await table
      .locator('tbody th[scope="row"] .name')
      .evaluateAll((els) => els.map((el) => ({ scroll: el.scrollWidth, client: el.clientWidth })));
    expect(names).toHaveLength(3);
    for (const name of names) expect(name.scroll).toBeLessThanOrEqual(name.client);
    const box = await table.evaluate((el) => {
      const outer = el.parentElement!;
      return {
        table: el.getBoundingClientRect().width,
        outer: outer.clientWidth,
        scroll: outer.scrollWidth,
      };
    });
    expect(box.scroll).toBeLessThanOrEqual(box.outer);
    expect(box.table).toBeLessThanOrEqual(box.outer + 1);
    await noPageScroll(page);
  });

  test('com movimento reduzido, nenhuma animação depois de a tela abrir', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startCareer(page);
    await expect(block(page, 'fans')).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('Completo: um lesionado faz a linha de desfalques, que leva ao Elenco', async ({ page }) => {
    await startCareer(page);
    await patchSave(page, (save) => {
      const [first] = squadOf(save);
      changePlayer(save, first!.id, { injuryRounds: 2 });
    });
    const line = block(page, 'next').getByRole('link', { name: /Desfalques: 1 lesionado/ });
    await expect(line).toBeVisible();
    await line.click();
    await expect(page).toHaveURL(/#\/squad$/);
  });

  test('Simplificado: nunca a linha de desfalques', async ({ page }) => {
    await startCareer(page, { realism: 'simplified' });
    await patchSave(page, (save) => {
      const [first] = squadOf(save);
      changePlayer(save, first!.id, { injuryRounds: 2 });
    });
    await expect(block(page, 'next').locator('a.match')).toBeVisible();
    await expect(block(page, 'next')).not.toContainText('Desfalques');
    await expect(block(page, 'next').locator('a[href="#/squad"]')).toHaveCount(0);
  });
});

/** Os números de uma coluna da tabela do elenco (pelo índice da célula depois do jogador). */
async function column(page: Page, index: number): Promise<number[]> {
  const texts = await main(page)
    .locator(`tbody tr:has(th[scope="row"]) td:nth-of-type(${index})`)
    .allInnerTexts();
  return texts.map((s) => Number(s.trim().replace(',', '.')));
}

test.describe('Elenco (elenco.md; US-016)', () => {
  test('25 jogadores com as colunas; ordenar por Nota e por Condição', async ({ page }) => {
    await startCareer(page);
    await playUntil(page, 2);
    await openSquad(page);
    // The visible short label of each header (the full name is for screen readers).
    const headers = await main(page)
      .locator('thead th')
      .evaluateAll((cells) =>
        cells.map((cell) => {
          const copy = cell.cloneNode(true) as HTMLElement;
          copy.querySelectorAll('.visually-hidden, .arrow').forEach((el) => el.remove());
          return (copy.textContent ?? '').trim();
        }),
      );
    expect(headers).toEqual(['Jogador', 'Nota', 'Cond.', 'Moral', 'Forma', 'Idade']);
    const first = main(page).locator('tbody tr:has(th[scope="row"])').first();
    await expect(first.locator('th button')).not.toBeEmpty();
    await expect(first.locator('td')).toHaveCount(5);

    await main(page).locator('fieldset label', { hasText: 'Nota' }).click();
    await expect(main(page).locator('th[aria-sort="descending"]')).toContainText('Nota');
    const overall = await column(page, 1);
    expect(overall).toEqual([...overall].sort((a, b) => b - a));

    await main(page).locator('fieldset label', { hasText: 'Condição' }).click();
    await expect(main(page).locator('th[aria-sort="ascending"]')).toContainText('Cond.');
    const condition = await column(page, 2);
    expect(condition).toEqual([...condition].sort((a, b) => a - b));

    // The order is kept while the career is open.
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Clube' })
      .click();
    await openSquad(page);
    await expect(main(page).locator('th[aria-sort="ascending"]')).toContainText('Cond.');
  });

  test('coluna fixa a 360 px; sem rolagem da página; deitado e no desktop a tabela cabe', async ({
    page,
  }) => {
    await startCareer(page);
    await openSquad(page);
    const box = main(page).locator('[role="region"]').first();
    if (page.viewportSize()!.width < SIDE_FROM) {
      await page.setViewportSize({ width: 360, height: 740 });
      await noPageScroll(page);
      const cell = main(page).locator('tbody th[scope="row"]').first();
      const before = (await cell.boundingBox())!;
      const boxSize = (await box.boundingBox())!;
      expect(before.width).toBeLessThanOrEqual(boxSize.width * 0.5);
      const scrolls = await box.evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(scrolls, 'a 360 px a tabela rola por dentro').toBe(true);
      await box.evaluate((el) => (el.scrollLeft = el.scrollWidth));
      const after = (await cell.boundingBox())!;
      expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
      await noPageScroll(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await noPageScroll(page);
      await page.setViewportSize({ width: 844, height: 390 });
    }
    await noPageScroll(page);
    expect(await box.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await smallTargets(main(page))).toEqual([]);
  });

  test('situação em texto com ícone: lesionado 3 rodadas, suspenso e promessa', async ({
    page,
  }) => {
    await startCareer(page);
    let names = { injured: '', suspended: '', prospect: '', plain: '' };
    await patchSave(page, (save) => {
      const squad = squadOf(save);
      const [a, b] = squad;
      // The prospect needs room for overall + 15 under the stored ceiling of the potential
      // (99): any squad has players that low, whatever the career's seed.
      const GAP = 15;
      const c = squad.slice(2).find((p) => p.overall + GAP <= POTENTIAL_STORED_MAX)!;
      const d = squad.slice(2).find((p) => p.id !== c.id)!;
      changePlayer(save, a!.id, { injuryRounds: 3, suspendedGames: 0 });
      changePlayer(save, b!.id, { injuryRounds: 0, suspendedGames: 1 });
      // A prospect and a player who is not one, by the engine's own rule.
      changePlayer(save, c.id, { age: 19, potential: c.overall + GAP });
      changePlayer(save, d.id, { age: 30, potential: d.overall });
      expect(isProspect(save.game.players[c!.id] as unknown as Player)).toBe(true);
      expect(isProspect(save.game.players[d!.id] as unknown as Player)).toBe(false);
      const display = (p: Player) => p.name.display;
      names = {
        injured: display(a!),
        suspended: display(b!),
        prospect: display(c),
        plain: display(d),
      };
    });
    await openSquad(page);
    const rowOf = (name: string) =>
      main(page).locator('tbody tr', { has: page.getByRole('button', { name, exact: true }) });
    const injured = rowOf(names.injured).locator('.badge.injured');
    await expect(injured).toHaveText('Lesionado, 3 rodadas');
    await expect(injured.locator('svg')).toHaveCount(1);
    const suspended = rowOf(names.suspended).locator('.badge.suspended');
    await expect(suspended).toContainText('Suspenso');
    await expect(suspended.locator('svg')).toHaveCount(1);
    await expect(rowOf(names.prospect).locator('.badge.prospect')).toHaveText('Promessa');
    await expect(rowOf(names.plain).locator('.badge.prospect')).toHaveCount(0);
  });

  test('Simplificado: sem a coluna "Cond." e sem a opção "Condição"', async ({ page }) => {
    await startCareer(page, { realism: 'simplified' });
    await openSquad(page);
    await expect(main(page).locator('thead th', { hasText: 'Cond.' })).toHaveCount(0);
    await expect(main(page).getByRole('radio')).toHaveCount(2);
    await expect(main(page).locator('label', { hasText: 'Condição' })).toHaveCount(0);
  });

  test('cores por faixa: condição 74 ruim, moral 60 boa, forma 5,5 regular; a nota sem cor (medida 10)', async ({
    page,
  }) => {
    await startCareer(page);
    const names = await forceStates(page);
    await openSquad(page);
    const rowOf = (name: string) =>
      main(page).locator('tbody tr', { has: page.getByRole('button', { name, exact: true }) });
    const cells = rowOf(names.banded).locator('td');
    const expected = [
      { index: 1, text: '74', level: 'poor', sr: '74, ruim' },
      { index: 2, text: '60', level: 'good', sr: '60, boa' },
      { index: 3, text: '5,5', level: 'fair', sr: '5,5, regular' },
    ];
    for (const theme of ['noite', 'dia'] as const) {
      await setTheme(page, theme);
      for (const { index, text, level, sr } of expected) {
        const number = cells.nth(index).locator(`span.level-${level}`);
        await expect(number).toHaveText(text);
        await expect(number).toBeVisible();
        await expect(cells.nth(index).locator('.visually-hidden')).toHaveText(sr);
        await expect(number).toHaveCSS('color', await tokenColor(page, `level-${level}`));
      }
    }
    // The overall rating and the age have no band.
    await expect(cells.nth(0).locator('[class*="level-"]')).toHaveCount(0);
    await expect(cells.nth(4).locator('[class*="level-"]')).toHaveCount(0);
    // No games: the dash has no band, read as "sem jogos".
    const bare = rowOf(names.noForm).locator('td').nth(3);
    await expect(bare).toContainText('—');
    await expect(bare.locator('[class*="level-"]')).toHaveCount(0);
    await expect(bare.locator('.visually-hidden')).toHaveText('sem jogos');
  });
});

test.describe('Anel de foco só para o teclado (elenco.md, medida 11)', () => {
  test.use({ hasTouch: true });
  const dialog = (page: Page) => page.getByRole('dialog');
  const outline = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).outlineStyle);

  test('toque: o nome volta com o foco sem anel; Enter e Esc: com anel', async ({ page }) => {
    await emulateWebKitTapFocus(page);
    await startCareer(page);
    await openSquad(page);
    const name = main(page).locator('tbody th[scope="row"] button').first();
    const close = dialog(page).getByRole('button', { name: 'Fechar' });

    await name.tap();
    await expect(close).toBeFocused();
    expect(await outline(close), 'X aberto por toque').toBe('none');
    await close.tap();
    await expect(dialog(page)).toBeHidden();
    await expect(name).toBeFocused();
    expect(await outline(name), 'nome depois do toque').toBe('none');

    // The keyboard: Tab after a tap brings the ring back on the element it reaches, before any
    // Enter; then Enter opens and Esc closes, with the ring.
    await page.keyboard.press('Tab');
    await expect(name).not.toBeFocused();
    expect(
      await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle),
      'foco movido pelo Tab',
    ).toBe('solid');
    await page.keyboard.press('Shift+Tab');
    await expect(name).toBeFocused();
    expect(await outline(name), 'nome depois do Shift+Tab').toBe('solid');
    await page.keyboard.press('Enter');
    await expect(close).toBeFocused();
    expect(await outline(close), 'X aberto pelo teclado').toBe('solid');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(name).toBeFocused();
    expect(await outline(name), 'nome depois do Esc').toBe('solid');
  });
});

test.describe('Card do jogador (jogador.md; US-016)', () => {
  const dialog = (page: Page) => page.getByRole('dialog');

  test('abre com atributos, traço e temporada; voltar fecha e fica no Elenco; Próximo não cresce o histórico', async ({
    page,
  }) => {
    await startCareer(page);
    await openSquad(page);
    const before = await page.evaluate(() => history.length);
    const name = main(page).locator('tbody th[scope="row"] button').first();
    await name.click();
    await expect(dialog(page)).toBeVisible();
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
    // The focus enters on the close button.
    await expect(dialog(page).getByRole('button', { name: 'Fechar' })).toBeFocused();

    const attributes = dialog(page).locator('section.block', {
      has: page.getByRole('heading', { name: 'Atributos' }),
    });
    const values = (await attributes.locator('dd .numero').allInnerTexts()).map(Number);
    expect(values).toHaveLength(6);
    for (const v of values) expect(v >= 1 && v <= 99).toBe(true);
    await expect(
      dialog(page).locator('section.block', {
        has: page.getByRole('heading', { name: 'Personalidade' }),
      }),
    ).not.toBeEmpty();
    const season = dialog(page).locator('section.block', {
      has: page.getByRole('heading', { name: 'Na temporada' }),
    });
    await expect(season.locator('dd')).toHaveText(['0', '0']);
    await expect(dialog(page).getByText('Condição', { exact: true })).toBeVisible();
    // The avatar is drawn by code: an svg without text or image.
    const avatar = dialog(page).locator('.avatar svg');
    await expect(avatar).toHaveCount(1);
    await expect(avatar.locator('text, image')).toHaveCount(0);

    const title = await dialog(page).getByRole('heading', { level: 2 }).first().innerText();
    await dialog(page).getByRole('button', { name: 'Próximo' }).click();
    await expect(dialog(page).getByRole('heading', { level: 2 }).first()).not.toHaveText(title);
    expect(await page.evaluate(() => history.length)).toBe(before + 1);

    await page.evaluate(() => history.back());
    await expect(dialog(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/squad$/);
  });

  test('Esc devolve o foco ao nome; Anterior no primeiro e Próximo no último ficam desabilitados', async ({
    page,
  }) => {
    await startCareer(page);
    await openSquad(page);
    const names = main(page).locator('tbody th[scope="row"] button');
    await names.first().click();
    await expect(dialog(page).getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await expect(dialog(page).getByRole('button', { name: 'Próximo' })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(names.first()).toBeFocused();

    await names.last().click();
    await expect(dialog(page).getByRole('button', { name: 'Próximo' })).toBeDisabled();
    await expect(dialog(page).getByRole('button', { name: 'Anterior' })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(names.last()).toBeFocused();
  });

  test('o X e o pé ficam inteiros na janela; deitado, o corpo rola; sem animação com movimento reduzido', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startCareer(page);
    await openSquad(page);
    await main(page).locator('tbody th[scope="row"] button').first().click();
    const sizes =
      page.viewportSize()!.width >= SIDE_FROM
        ? [{ width: 1280, height: 800 }]
        : [
            { width: 390, height: 844 },
            { width: 844, height: 390 },
          ];
    for (const size of sizes) {
      await page.setViewportSize(size);
      for (const name of ['Fechar', 'Anterior', 'Próximo']) {
        const box = (await dialog(page).getByRole('button', { name }).boundingBox())!;
        expect(box.y, `${size.width}: ${name}`).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, `${size.width}: ${name}`).toBeLessThanOrEqual(size.height);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      if (size.height < 500) {
        const body = dialog(page).getByRole('region');
        expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
      }
    }
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('aberto pela linha (não pelo nome), o foco volta ao nome da linha ao fechar', async ({
    page,
  }) => {
    await startCareer(page);
    await openSquad(page);
    const rows = main(page).locator('tbody tr:has(th[scope="row"])');
    const names = main(page).locator('tbody th[scope="row"] button');
    // A tap on a number cell of the 3rd row: the focus goes to the table's box, not the name.
    await rows.nth(2).locator('td').nth(2).click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(names.nth(2)).toBeFocused();
    // The same by the X, after moving to the next player: back to the name that opened it.
    await rows.nth(4).locator('td').first().click();
    await dialog(page).getByRole('button', { name: 'Próximo' }).click();
    await dialog(page).getByRole('button', { name: 'Fechar' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(names.nth(4)).toBeFocused();
  });

  test('o título do card é o nome da linha; o nome completo, se diferente, vem abaixo', async ({
    page,
  }) => {
    await startCareer(page);
    await openSquad(page);
    const save = await readSave(page);
    const players = save.game.squads[save.career.clubId]!.map(
      (id) => save.game.players[id] as unknown as { name: { display: string; full: string } },
    );
    const buttons = main(page).locator('tbody th[scope="row"] button');
    const names = (await buttons.allInnerTexts()).map((n) => n.trim());
    let withFullName = 0;
    // The whole squad, so at least one nickname is sure to be in the sample.
    for (let i = 0; i < names.length; i++) {
      await buttons.nth(i).click();
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page).getByRole('heading', { level: 2 }).first()).toHaveText(names[i]!);
      const name = players.find((p) => p.name.display === names[i])!.name;
      const key = (text: string) =>
        text
          .normalize('NFD')
          .replace(/\p{M}/gu, '')
          .toLowerCase()
          .replace(/[-\s]+/g, ' ')
          .trim();
      if (key(name.full) !== key(name.display)) {
        withFullName++;
        await expect(
          dialog(page).getByRole('paragraph').filter({ hasText: name.full }),
        ).toHaveCount(1);
      } else {
        await expect(
          dialog(page).getByRole('paragraph').filter({ hasText: name.full }),
        ).toHaveCount(0);
      }
      await dialog(page).getByRole('button', { name: 'Fechar' }).click();
      await expect(dialog(page)).toBeHidden();
    }
    expect(withFullName, 'jogadores com nome completo diferente do da linha').toBeGreaterThan(0);
  });

  test('toque duplo no X fecha o card e continua no Elenco', async ({ page }) => {
    await startCareer(page);
    await openSquad(page);
    await main(page).locator('tbody th[scope="row"] button').first().click();
    await expect(dialog(page)).toBeVisible();
    // Two taps in the same instant, before the popstate of the first one arrives.
    await dialog(page)
      .getByRole('button', { name: 'Fechar' })
      .evaluate((button: HTMLElement) => {
        button.click();
        button.click();
      });
    await expect(dialog(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/squad$/);
    await expect(main(page).locator('tbody th[scope="row"]')).toHaveCount(25);
    expect(await page.evaluate(() => history.state?.sheet)).toBeUndefined();
  });

  test('Simplificado: sem a linha "Condição"', async ({ page }) => {
    await startCareer(page, { realism: 'simplified' });
    await openSquad(page);
    await main(page).locator('tbody th[scope="row"] button').first().click();
    await expect(dialog(page).getByText('Moral', { exact: true })).toBeVisible();
    await expect(dialog(page).getByText('Condição', { exact: true })).toHaveCount(0);
  });

  test('faixas no card: estados com cor e leitura; atributos e nota sem classe (medida 9)', async ({
    page,
  }) => {
    await startCareer(page);
    const names = await forceStates(page);
    await openSquad(page);
    const states = () =>
      dialog(page).locator('section.block', {
        has: page.getByRole('heading', { name: 'Como está' }),
      });
    const row = (label: string) =>
      states().locator('.attr', { has: page.getByText(label, { exact: true }) });
    await page.getByRole('button', { name: names.banded, exact: true }).click();
    await expect(dialog(page)).toBeVisible();
    for (const theme of ['noite', 'dia'] as const) {
      await setTheme(page, theme);
      const expected = [
        ['Condição', '74', 'poor', '74, ruim'],
        ['Moral', '60', 'good', '60, boa'],
        ['Forma (últimos 5 jogos)', '5,5', 'fair', '5,5, regular'],
      ] as const;
      for (const [label, text, level, sr] of expected) {
        const number = row(label).locator(`span.level-${level}`);
        await expect(number).toHaveText(text);
        await expect(row(label).locator('.visually-hidden')).toHaveText(sr);
        await expect(number).toHaveCSS('color', await tokenColor(page, `level-${level}`));
      }
    }
    // Attributes and the overall rating carry no band.
    const attributes = dialog(page).locator('section.block', {
      has: page.getByRole('heading', { name: 'Atributos' }),
    });
    await expect(attributes.locator('[class*="level-"]')).toHaveCount(0);
    await expect(dialog(page).locator('.overall [class*="level-"]')).toHaveCount(0);
    // No games: the dash keeps no band.
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await page.getByRole('button', { name: names.noForm, exact: true }).click();
    await expect(row('Forma (últimos 5 jogos)').locator('[class*="level-"]')).toHaveCount(0);
    await expect(row('Moral').locator('span.level-poor')).toHaveText('30');
    await expect(row('Condição').locator('span.level-good')).toHaveText('90');
  });
});
