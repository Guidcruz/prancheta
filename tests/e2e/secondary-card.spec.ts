import type { Locator, Page } from '@playwright/test';
import { reopenIn, saveSettled } from './career.ts';
import { setTheme, tokenColor } from './css.ts';
import { expect, test } from './fixtures.ts';
import {
  main,
  noPageScroll,
  sizesOf,
  withSecondaryFixture,
  type Fixture,
  type SecondaryCases,
} from './lineup-fixture.ts';

/*
 * A posição secundária no Elenco, no card do jogador e na linha do banco da Escalação (T-081;
 * ADR-0022): as "Medidas para o E2E" de docs/design/telas/elenco.md, jogador.md e a medida 6 de
 * escalacao.md, nos três idiomas e a 360 px. A fixture é a da T-079 (`withSecondaryFixture`): um
 * volante com secundária ZAG (a), um lateral com secundária ZAG no banco (b), um meia sem
 * secundária (c) e os goleiros. O que cabe no Vitest (textos, nomes, montagem) está em
 * app/src/ui/squad.secondary.test.ts.
 */

type Lang = 'pt-BR' | 'es' | 'en';

const IN_LANG = {
  'pt-BR': {
    tab: 'Elenco',
    squad: 'Elenco',
    lineup: 'Escalação',
    label: 'Posição secundária',
    hint: 'Outra posição em que ele joga bem. Ali rende um pouco menos que na natural.',
    dm: 'Volante',
    cb: 'Zagueiro',
    group: 'Volantes',
    reading: 'Volante, também joga de zagueiro',
    close: 'Fechar',
  },
  es: {
    tab: 'Plantel',
    squad: 'Plantel',
    lineup: 'Alineación',
    label: 'Posición secundaria',
    hint: 'Otra posición donde juega bien. Allí rinde un poco menos que en la natural.',
    dm: 'Mediocampista defensivo',
    cb: 'Defensa central',
    group: 'Mediocampistas defensivos',
    reading: 'Mediocampista defensivo, también juega de defensa central',
    close: 'Cerrar',
  },
  en: {
    tab: 'Squad',
    squad: 'Squad',
    lineup: 'Lineup',
    label: 'Second position',
    hint: 'Another position he plays well in. There he performs a little below his natural level.',
    dm: 'Defensive midfielder',
    cb: 'Center-back',
    group: 'Defensive midfielders',
    reading: 'Defensive midfielder, also plays as center-back',
    close: 'Close',
  },
} as const;

const LANGS = Object.keys(IN_LANG) as Lang[];

/** O jogo na fixture, no idioma pedido, na aba do Elenco (a lista), com o save já assentado. */
async function openSquadIn(
  page: Page,
  lang: Lang,
): Promise<{ fixture: Fixture; cases: SecondaryCases }> {
  const built = await withSecondaryFixture(page);
  await saveSettled(page);
  if (lang !== 'pt-BR') await reopenIn(page, lang);
  await page.getByRole('navigation').getByRole('link', { name: IN_LANG[lang].tab }).first().click();
  await main(page).locator('fieldset label', { hasText: IN_LANG[lang].squad }).click();
  await expect(main(page).locator('tbody th[scope="row"]')).toHaveCount(25);
  return built;
}

/** A linha da tabela do Elenco de um jogador, pelo botão do nome. */
const rowOf = (page: Page, display: string) =>
  main(page).locator('tbody tr', {
    has: page.getByRole('button', { name: display, exact: true }),
  });
const tagsOf = (row: Locator) => row.locator('th[scope="row"] .tag');

async function tagBoxes(tags: Locator) {
  return tags.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    }),
  );
}

test.describe('Posição secundária no Elenco (elenco.md; T-081)', () => {
  test('medida 1, nos dois temas: a segunda caixinha é aria-hidden, sem setor, com borda line e texto ink-muted', async ({
    page,
  }) => {
    const { cases, fixture } = await openSquadIn(page, 'pt-BR');
    const volante = tagsOf(rowOf(page, cases.onSecondary.name.display));
    await expect(volante).toHaveCount(2);
    await expect(volante.nth(0)).toHaveText('VOL');
    await expect(volante.nth(0)).toHaveClass(/\bsector-mid\b/);
    const second = volante.nth(1);
    await expect(second).toHaveText('ZAG');
    await expect(second).toHaveAttribute('aria-hidden', 'true');
    await expect(second).not.toHaveClass(/sector-/);
    for (const theme of ['noite', 'dia'] as const) {
      await setTheme(page, theme);
      await expect(second).toHaveCSS('border-top-color', await tokenColor(page, 'line'));
      await expect(second).toHaveCSS('color', await tokenColor(page, 'ink-muted'));
      await expect(second).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    }
    // The attacking midfielder without one and the goalkeepers have a single tag.
    await expect(tagsOf(rowOf(page, cases.benchPlain.name.display))).toHaveCount(1);
    await expect(tagsOf(rowOf(page, fixture.starters[0]!.name.display))).toHaveCount(1);
    await expect(tagsOf(rowOf(page, fixture.bench[0]!.name.display))).toHaveCount(1);
    // Only the three cases of the fixture have a second tag.
    await expect(main(page).locator('tbody th[scope="row"] .tag.sm')).toHaveCount(3);
  });

  for (const lang of LANGS) {
    test(`${lang}, medidas 2 a 5: nome acessível, larguras a 360 px, grupo e sem rolagem lateral`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const { cases } = await openSquadIn(page, lang);
      const text = IN_LANG[lang];
      const row = rowOf(page, cases.onSecondary.name.display);

      // 2. The hidden text of the row is the approved sentence, and nothing of it is visible.
      await expect(row.locator('th[scope="row"] .visually-hidden')).toHaveText(text.reading);
      await expect(row.locator('th[scope="row"]')).not.toContainText(text.cb);
      await expect(row.locator('th[scope="row"] .tag.sm')).toHaveText(
        { 'pt-BR': 'ZAG', es: 'DEF', en: 'CB' }[lang],
      );

      // 4. In the "Posição" order, the player is in the group of his natural position.
      const rows = await main(page)
        .locator('tbody tr')
        .evaluateAll((els) => els.map((el) => el.textContent ?? ''));
      const at = rows.findIndex((r) => r.includes(cases.onSecondary.name.display));
      let heading = at;
      // A group row has no numbers; the player rows have the rating, the age and the rest.
      while (heading > 0 && /\d/.test(rows[heading]!)) heading--;
      expect(rows[heading]).toContain(text.group);

      for (const size of sizesOf(page)) {
        await page.setViewportSize(size);
        // 5. No sideways scroll of the page, in 360, 390, 844 and 1280.
        await noPageScroll(page);
        if (size.width !== 360) continue;
        // 3. At 360 px the two tags are as wide as the one of the attacking midfielder (±1px).
        const [first, second] = await tagBoxes(tagsOf(row));
        const [plain] = await tagBoxes(tagsOf(rowOf(page, cases.benchPlain.name.display)));
        expect(Math.abs(first!.width - second!.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(first!.width - plain!.width)).toBeLessThanOrEqual(1);
        expect(second!.height).toBeCloseTo(18, 0);
        // The fixed column does not pass half of the table's box and the name stays a target.
        const box = (await main(page).locator('[role="region"]').first().boundingBox())!;
        const cell = (await row.locator('th[scope="row"]').boundingBox())!;
        expect(cell.width).toBeLessThanOrEqual(box.width * 0.5);
        // Max 56px without a badge under the name (a "Promessa" badge, drawn by chance, adds its line).
        if ((await row.locator('.badges').count()) === 0) {
          expect(cell.height).toBeLessThanOrEqual(56);
        }
        const name = (await row.getByRole('button').boundingBox())!;
        expect(name.width).toBeGreaterThanOrEqual(44);
        expect(name.height).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe('Posição secundária no card do jogador (jogador.md; T-081)', () => {
  const dialog = (page: Page) => page.getByRole('dialog');

  for (const lang of LANGS) {
    test(`${lang}, medidas 1 a 4: o bloco do volante, a ausência no meia e no goleiro, sem rolagem lateral`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const { cases, fixture } = await openSquadIn(page, lang);
      const text = IN_LANG[lang];
      const open = async (display: string) => {
        await rowOf(page, display).getByRole('button', { name: display, exact: true }).click();
        await expect(dialog(page)).toBeVisible();
      };
      const closeCard = async () => {
        await dialog(page).getByRole('button', { name: text.close }).click();
        await expect(dialog(page)).toBeHidden();
      };
      const sheetBody = () => dialog(page).locator('div.body[role="region"]');

      // 1. The volante: dt with the label; the dd has the position and a neutral hidden tag.
      await open(cases.onSecondary.name.display);
      const dt = dialog(page).locator('dt', { hasText: text.label });
      await expect(dt).toHaveCount(1);
      await expect(dt).toHaveText(text.label);
      const dd = dt.locator('xpath=following-sibling::dd[1]');
      await expect(dd).toContainText(text.cb);
      const tag = dd.locator('.tag');
      await expect(tag).toHaveCount(1);
      await expect(tag).toHaveAttribute('aria-hidden', 'true');
      await expect(tag).not.toHaveClass(/sector-/);
      await expect(dialog(page).getByText(text.hint, { exact: true })).toBeVisible();
      // 4. The header's tag keeps the sector of the natural position.
      const header = dialog(page).locator('.position .tag');
      await expect(header).toHaveClass(/\bsector-mid\b/);
      await expect(dialog(page).locator('.position')).toContainText(text.dm);

      // 3. No sideways scroll of the body, and the dd inside the sheet, at each width.
      for (const size of sizesOf(page)) {
        await page.setViewportSize(size);
        await noPageScroll(page);
        const fits = await sheetBody().evaluate((el) => el.scrollWidth <= el.clientWidth);
        expect(fits, `${lang} ${size.width}: o corpo da folha rola na horizontal`).toBe(true);
        const inside = await dd.evaluate((el) => {
          const sheet = el.closest('div.body')!.getBoundingClientRect();
          const box = el.getBoundingClientRect();
          return box.left >= sheet.left - 0.5 && box.right <= sheet.right + 0.5;
        });
        expect(inside, `${lang} ${size.width}: o dd sai da folha`).toBe(true);
      }
      await closeCard();

      // 2. No block for the player without one and for a goalkeeper.
      for (const display of [cases.benchPlain.name.display, fixture.starters[0]!.name.display]) {
        await open(display);
        await expect(dialog(page).locator('dt', { hasText: text.label })).toHaveCount(0);
        await expect(dialog(page).getByText(text.hint, { exact: true })).toHaveCount(0);
        await closeCard();
      }
    });
  }
});

test.describe('Sigla secundária na linha do banco (escalacao.md, medida 6; T-081)', () => {
  for (const lang of LANGS) {
    test(`${lang}: a linha de (b) tem duas siglas, a segunda neutra e escondida; a de (c) tem uma; nome acessível`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const { cases } = await openSquadIn(page, lang);
      const text = IN_LANG[lang];
      await main(page).locator('fieldset label', { hasText: text.lineup }).click();
      await expect(main(page).locator('button[data-slot]')).toHaveCount(11);
      const b = main(page).locator('[data-place="bench-2"]');
      const c = main(page).locator('[data-place="bench-4"]');

      const second = b.locator('.second .tag');
      await expect(second).toHaveCount(1);
      await expect(second).toHaveAttribute('aria-hidden', 'true');
      await expect(second).not.toHaveClass(/sector-/);
      await expect(c.locator('.second')).toHaveCount(0);
      // The accessible name reads the natural and the secondary position (and the lower case).
      await expect(b).toHaveAttribute(
        'aria-label',
        new RegExp(
          `^${cases.benchSecondary.name.full}, [^,]+, ${
            {
              'pt-BR': 'também joga de zagueiro',
              es: 'también juega de defensa central',
              en: 'also plays as center-back',
            }[lang]
          }, `,
        ),
      );
      await expect(c).toHaveAttribute(
        'aria-label',
        new RegExp(`^${cases.benchPlain.name.full}, [^,]+, [^,]+`),
      );
      await expect(c).not.toHaveAttribute('aria-label', /também|también|also/);

      for (const size of sizesOf(page)) {
        await page.setViewportSize(size);
        await noPageScroll(page);
        const [pos] = await tagBoxes(b.locator('.pos'));
        const [tag] = await tagBoxes(second);
        expect(Math.abs(pos!.width - tag!.width), `${lang} ${size.width}`).toBeLessThanOrEqual(1);
        for (const row of [b, c]) {
          expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  }
});
