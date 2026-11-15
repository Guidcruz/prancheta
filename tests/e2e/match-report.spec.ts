import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { closeSummary, playUntil, reopenIn, roundHeading, startCareer } from './career.ts';
import { setTheme } from './css.ts';
import { expect, playButton, test } from './fixtures.ts';
import { readMatchSheets, readSave, type SaveJson, type SheetEventJson } from './save.ts';

/*
 * A súmula do jogo (T-083; docs/design/telas/resumo-rodada.md, "Súmula (folha) — T-083" e
 * "Medidas para o E2E", T-083; US-019). Cada teste diz as medidas que cobre. O que depende de
 * largura roda uma vez por navegador (no projeto de celular) com a janela que a medida pede; o
 * desktop (1280×800) roda no projeto de desktop.
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

/** Um texto de `ui.json` em `lang` (o teste falha se a chave não existe). */
function ui(lang: Lang, key: string): string {
  const text = UI[lang][key];
  if (text === undefined) throw new Error(`no ${key} in ${lang}`);
  return text;
}

const onPhone = (page: Page) => page.viewportSize()!.width < 900;

interface Played {
  id: string;
  round: number;
  homeId: string;
  awayId: string;
  result: {
    score: [number, number];
    abandoned: boolean;
    motm?: string;
    attendance: number;
    stats: Record<
      'home' | 'away',
      { shots: number; onTarget: number; possession: number; yellows: number; reds: number }
    >;
  };
}
const roundOf = (save: SaveJson, round: number) =>
  (save.game.fixtures as unknown as Played[]).filter((f) => f.round === round);
const isMine = (save: SaveJson, f: Played) =>
  f.homeId === save.career.clubId || f.awayId === save.career.clubId;
const displayName = (save: SaveJson, id: string) =>
  (save.game.players[id] as { name: { display: string } }).name.display;
const shortName = (save: SaveJson, id: string) => save.game.clubs[id]!.def.shortName;
const stadium = (save: SaveJson, id: string) =>
  (save.game.clubs[id]!.def as unknown as { stadium: { name: string } }).stadium.name;

const summary = (page: Page) => page.locator('main.round');
const othersList = (page: Page) => summary(page).locator('ul.others');
const sheetButton = (page: Page, lang: Lang = 'pt-BR') =>
  summary(page).getByRole('button', { name: ui(lang, 'round.sheet.open'), exact: true });
const reportDialog = (page: Page, lang: Lang = 'pt-BR') =>
  page.getByRole('dialog', { name: ui(lang, 'report.title') });
const cardOf = (page: Page, id: string) =>
  othersList(page).locator(`li[data-fixture="${id}"]`).getByRole('button');

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

/**
 * Confere a súmula aberta de `fixture` contra o save (medida 1): os lances da súmula gravada, na
 * mesma ordem e com a palavra do tipo; o melhor em campo com a nota de uma casa; as estatísticas
 * de `result.stats`; o estádio do mandante e o público.
 */
async function expectReport(
  page: Page,
  save: SaveJson,
  sheets: Awaited<ReturnType<typeof readMatchSheets>>,
  fixture: Played,
): Promise<void> {
  const dialog = reportDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.report')).toHaveAttribute('data-fixture', fixture.id);
  const sheet = sheets[fixture.id]!;
  const lines = dialog.locator('li.line');
  await expect(lines).toHaveCount(sheet.events.length);
  for (const [i, event] of sheet.events.entries()) {
    const line = lines.nth(i);
    await expect(line.locator('.kind')).toHaveText(kindWord(event, save.game.rules.realism));
    await expect(line.locator('.kind')).toBeVisible();
    const minute = event.added ? `${event.minute}+${event.added}'` : `${event.minute}'`;
    await expect(line.locator('.minute')).toHaveText(minute);
    await expect(line.locator('.club')).toHaveText(
      shortName(save, event.side === 'home' ? fixture.homeId : fixture.awayId),
    );
  }
  if (sheet.events.length === 0)
    await expect(dialog).toContainText(ui('pt-BR', 'report.events.none'));

  const motm = fixture.result.motm;
  if (motm === undefined) await expect(dialog.locator('.motm')).toHaveCount(0);
  else {
    await expect(dialog.locator('.motm .name')).toHaveText(displayName(save, motm));
    const rating = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(sheet.motmRating!);
    await expect(dialog.locator('.motm .rating')).toHaveText(`nota ${rating}`);
  }

  const { home, away } = fixture.result.stats;
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
  const heads = dialog.locator('table.stats thead th');
  await expect(heads.first()).toHaveText(shortName(save, fixture.homeId));
  await expect(heads.last()).toHaveText(shortName(save, fixture.awayId));

  const attendance = new Intl.NumberFormat('pt-BR').format(fixture.result.attendance);
  await expect(dialog.locator('.place')).toHaveText(
    `${stadium(save, fixture.homeId)} · Público: ${attendance}`,
  );
}

/** Fecha a súmula pelo X e espera o resumo de volta. */
async function closeByX(page: Page, lang: Lang = 'pt-BR'): Promise<void> {
  await reportDialog(page, lang)
    .getByRole('button', { name: ui(lang, 'nav.close') })
    .click();
  await expect(reportDialog(page, lang)).toBeHidden();
  await expect(roundHeading(page)).toBeVisible();
}

/** Joga a rodada atual e espera o resumo; devolve o save e as súmulas da rodada jogada. */
async function playAndRead(page: Page, lang: Lang = 'pt-BR') {
  await page.getByRole('button', { name: ui(lang, 'play.label') }).click();
  await expect(roundHeading(page)).toBeVisible();
  const save = await readSave(page);
  const round = save.game.round - 1;
  return { save, round, sheets: await readMatchSheets(page, round) };
}

test.describe('Súmula do jogo (T-083)', () => {
  test('"Súmula do jogo" abre a súmula do meu jogo com os dados do save; o voltar fecha e fica no resumo; o avançar reabre (medida 1)', async ({
    page,
  }) => {
    await startCareer(page);
    const { save, sheets } = await playAndRead(page);
    const mine = roundOf(save, 1).find((f) => isMine(save, f))!;
    const before = await page.evaluate(() => history.length);

    await sheetButton(page).click();
    await expectReport(page, save, sheets, mine);
    // O meu clube jogou: o selo do resultado, com a palavra inteira.
    await expect(reportDialog(page).locator('.badge')).toHaveText(
      /^\s*(Vitória|Empate|Derrota)\s*$/,
    );
    // O placar é lido por extenso, como grupo.
    const [hg, ag] = mine.result.score;
    await expect(reportDialog(page).getByRole('group')).toHaveAccessibleName(
      `Placar: ${shortName(save, mine.homeId)} ${hg}, ${shortName(save, mine.awayId)} ${ag}`,
    );
    expect(await page.evaluate(() => history.length)).toBe(before + 1);

    // O voltar do celular fecha a folha e fica no resumo, sem trocar o endereço.
    await page.goBack();
    await expect(reportDialog(page)).toBeHidden();
    await expect(roundHeading(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/round$/);
    await expect(sheetButton(page)).toBeFocused();
    // O avançar reabre a mesma súmula (a entrada nunca fica morta).
    await page.goForward();
    await expect(reportDialog(page).locator('.report')).toHaveAttribute('data-fixture', mine.id);
    // Fechada pelo X, a entrada dela sai; "Continuar" volta à aba sem entrada de folha.
    await closeByX(page);
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
    expect(await page.evaluate(() => history.state)).toEqual({ round: true });
    await closeSummary(page);
    await expect(page).toHaveURL(/#\/club$/);
    expect(await page.evaluate(() => history.state?.sheet)).toBeUndefined();
  });

  test('tocar num card de "Outros resultados" abre a súmula daquele jogo (medida 2)', async ({
    page,
  }) => {
    await startCareer(page);
    const { save, sheets } = await playAndRead(page);
    const others = roundOf(save, 1).filter((f) => !isMine(save, f));
    expect(others).toHaveLength(9);
    for (const fixture of [others[0]!, others[8]!]) {
      await cardOf(page, fixture.id).click();
      await expectReport(page, save, sheets, fixture);
      // Jogo de outros clubes: sem selo de resultado.
      await expect(reportDialog(page).locator('.badge')).toHaveCount(0);
      await page.goBack();
      await expect(reportDialog(page)).toBeHidden();
      await expect(roundHeading(page)).toBeVisible();
    }
  });

  test('alvos de 44 px e o nome de cada card com os nomes e os gols visíveis, na mesma ordem (medida 3)', async ({
    page,
  }) => {
    await startCareer(page);
    const { save } = await playAndRead(page);
    const targets: Locator[] = [sheetButton(page)];
    for (const fixture of roundOf(save, 1).filter((f) => !isMine(save, f))) {
      const card = cardOf(page, fixture.id);
      targets.push(card);
      // O texto visível do card, na ordem: mandante, gols, visitante, gols.
      const visible = (await card.locator('.team').allInnerTexts())
        .map((text) => text.replace(/\s+/g, ' ').trim())
        .join(' ');
      const [hg, ag] = fixture.result.score;
      expect(visible).toBe(
        `${shortName(save, fixture.homeId)} ${hg} ${shortName(save, fixture.awayId)} ${ag}`,
      );
      const name = (await card.getAttribute('aria-label'))!;
      expect(name.startsWith(`Ver súmula: ${visible}`), name).toBe(true);
      const derby = save.game.clubs[fixture.homeId]!.def.rivals.includes(fixture.awayId);
      expect(name.includes('Clássico')).toBe(derby);
    }
    for (const target of targets) {
      const box = (await target.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('foco: ao fechar, volta ao botão ou card que abriu, pelo X, pelo Esc e pelo voltar (medida 4)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await startCareer(page);
    const { save } = await playAndRead(page);
    const other = roundOf(save, 1).find((f) => !isMine(save, f))!;

    await sheetButton(page).click();
    // Ao abrir, o foco entra na folha.
    await expect(reportDialog(page).getByRole('button', { name: 'Fechar' })).toBeFocused();
    await closeByX(page);
    await expect(sheetButton(page)).toBeFocused();

    await cardOf(page, other.id).click();
    await expect(reportDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(reportDialog(page)).toBeHidden();
    await expect(cardOf(page, other.id)).toBeFocused();

    await cardOf(page, other.id).click();
    await expect(reportDialog(page)).toBeVisible();
    await page.goBack();
    await expect(reportDialog(page)).toBeHidden();
    await expect(cardOf(page, other.id)).toBeFocused();
  });

  test('sem rolagem lateral em 360, 390, 844 e 1280, em pt-BR, es e en; a 360, tipos de lance em até 2 linhas (medida 5)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    test.setTimeout(90_000);
    await startCareer(page);
    for (const lang of ['pt-BR', 'es', 'en'] as const) {
      if (lang !== 'pt-BR') await reopenIn(page, lang);
      const { save } = await playAndRead(page, lang);
      const round = save.game.round - 1;
      await page.setViewportSize({ width: 360, height: 740 });
      // Cada um dos 10 jogos a 360: as palavras de tipo em até 2 linhas.
      for (const fixture of roundOf(save, round)) {
        if (isMine(save, fixture)) await sheetButton(page, lang).click();
        else await cardOf(page, fixture.id).click();
        const dialog = reportDialog(page, lang);
        await expect(dialog).toBeVisible();
        const kinds = await dialog
          .locator('li.line .kind')
          .evaluateAll((els) => els.map((el) => [el.textContent, el.getClientRects().length]));
        for (const [text, count] of kinds) {
          expect(count, `${lang} ${fixture.id}: "${text}"`).toBeLessThanOrEqual(2);
        }
        await closeByX(page, lang);
      }
      await cardOf(page, roundOf(save, round).find((f) => !isMine(save, f))!.id).click();
      await expect(reportDialog(page, lang)).toBeVisible();
      for (const theme of ['noite', 'dia'] as const) {
        await setTheme(page, theme);
        for (const [width, height] of [
          [360, 740],
          [390, 844],
          [844, 390],
          [1280, 800],
        ] as const) {
          await page.setViewportSize({ width, height });
          const scroll = await page.evaluate(() => {
            const sheet = document.querySelector('dialog[open]')!;
            const body = sheet.querySelector('.body')!;
            return {
              page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              sheet: sheet.scrollWidth - sheet.clientWidth,
              body: body.scrollWidth - body.clientWidth,
            };
          });
          expect(scroll.page, `${lang} ${theme} ${width}`).toBeLessThanOrEqual(0);
          expect(scroll.sheet, `${lang} ${theme} ${width}: folha`).toBeLessThanOrEqual(0);
          expect(scroll.body, `${lang} ${theme} ${width}: corpo da folha`).toBeLessThanOrEqual(0);
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await closeByX(page, lang);
      await closeSummary(page, ui(lang, 'round.continue'));
    }
  });

  test('textos cabem a 360×740 em es e en, com o clube de nome curto mais longo', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await page.setViewportSize({ width: 360, height: 740 });
    await startCareer(page, { club: 'Inter-Regional' });
    for (const lang of ['es', 'en'] as const) {
      await reopenIn(page, lang);
      await playAndRead(page, lang);
      await sheetButton(page, lang).click();
      const dialog = reportDialog(page, lang);
      await expect(dialog).toContainText('Inter-Regional');
      const lines = await dialog.evaluate((root) => {
        // Lines of the text itself (a cell's padding does not count): its distinct tops.
        const count = (el: Element) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
        };
        return {
          title: count(root.querySelector('h2')!),
          meta: count(root.querySelector('.meta')!),
          boardNames: Math.max(...[...root.querySelectorAll('.scoreboard .name')].map(count)),
          heads: Math.max(...[...root.querySelectorAll('h3')].map(count)),
          stats: Math.max(...[...root.querySelectorAll('table.stats th[scope="row"]')].map(count)),
        };
      });
      expect(lines.title, `${lang}: título em 1 linha`).toBe(1);
      expect(lines.meta, `${lang}: linha de cima em 1 linha`).toBe(1);
      expect(lines.boardNames, `${lang}: nomes do placar em até 2 linhas`).toBeLessThanOrEqual(2);
      expect(lines.heads, `${lang}: títulos dos blocos em 1 linha`).toBe(1);
      expect(lines.stats, `${lang}: nomes das estatísticas em 1 linha`).toBe(1);
      await closeByX(page, lang);
      await closeSummary(page, ui(lang, 'round.continue'));
    }
  });

  test('desktop (1280×800): a súmula como diálogo ancorado pela base, com 540 px (medida 6)', async ({
    page,
  }) => {
    test.skip(onPhone(page), 'só no desktop');
    await startCareer(page);
    await playAndRead(page);
    await sheetButton(page).click();
    const box = (await reportDialog(page).boundingBox())!;
    expect(Math.abs(box.width - 540)).toBeLessThanOrEqual(1);
    // Centralizado na largura e ancorado pela base: o pé a space-8 (32 px) da base da janela.
    expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y + box.height - (800 - 32))).toBeLessThanOrEqual(1);
  });

  test('movimento: com movimento reduzido, nenhuma animação com a súmula aberta (medida 7)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startCareer(page);
    await playAndRead(page);
    await sheetButton(page).click();
    await expect(reportDialog(page)).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('Simplificado: nenhuma linha de súmula com "Amarelo e suspensão" (medida 8)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await startCareer(page, { realism: 'simplified' });
    await playUntil(page, 4);
    const { save, round, sheets } = await playAndRead(page);
    expect(save.game.rules.realism).toBe('simplified');
    const suspended = ui('pt-BR', 'report.event.yellowSuspended');
    for (const fixture of roundOf(save, round)) {
      if (isMine(save, fixture)) await sheetButton(page).click();
      else await cardOf(page, fixture.id).click();
      await expect(reportDialog(page).locator('li.line')).toHaveCount(
        sheets[fixture.id]!.events.length,
      );
      await expect(reportDialog(page)).not.toContainText(suspended);
      await closeByX(page);
    }
  });
});
