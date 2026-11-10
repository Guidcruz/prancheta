import type { Page } from '@playwright/test';
import { careerActions, nextRound, saveSettled, startCareer } from './career.ts';
import { expect, playButton, test } from './fixtures.ts';

/*
 * Acceptance of US-034 (several careers: list, independence, cancelling the delete) and US-014
 * (new game: defaults, last setup, nickname, hidden options of later stages), in the browser.
 * The double-confirmation delete itself is in delete.spec.ts; the sheets and texts per language
 * are in app/src/ui/screens.test.ts. Each test runs in a fresh browser context, so the
 * IndexedDB starts empty.
 */

const GUARD_MS = 500;
const dialog = (page: Page) => page.getByRole('dialog');

/** Creates a career with the club at `index` in the list and leaves the frame open; returns its short name. */
async function createCareer(page: Page, index: number): Promise<string> {
  await page.goto('/jogo/');
  await page.getByRole('button', { name: 'Nova carreira' }).click();
  const club = page.getByRole('radio').nth(index);
  await club.check();
  const name = (await club.locator('xpath=ancestor::label').locator('.name').innerText()).trim();
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(playButton(page)).toBeVisible();
  return name;
}

/** Counts the rows of an object store of the test database. */
async function countRows(page: Page, store: 'careers' | 'snapshots'): Promise<number> {
  return page.evaluate(
    (name) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('prancheta-test');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(name).objectStore(name).count();
          req.onsuccess = () => {
            db.close();
            resolve(req.result);
          };
          req.onerror = () => reject(req.error);
        };
      }),
    store,
  );
}

test.describe('US-034: várias carreiras', () => {
  test('a lista mostra as duas, a mais recente em destaque, com rodada e data da última jogada', async ({
    page,
  }) => {
    const first = await createCareer(page, 0);
    const second = await createCareer(page, 1);
    expect(second).not.toBe(first);
    await page.goto('/jogo/');
    await expect(page.getByRole('heading', { name: 'Suas carreiras' })).toBeVisible();
    // The featured card (with "Continuar") is the newest; the older one is a row below it.
    const main = page.locator('main');
    const text = await main.innerText();
    expect(text.indexOf(second)).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(first)).toBeGreaterThan(text.indexOf(second));
    await expect(careerActions(page, first)).toBeVisible();
    await expect(careerActions(page, second)).toBeVisible();
    await expect(main.getByText(/Temporada 1 · (próxima )?rodada:? 1/)).toHaveCount(2);
    await expect(main.getByText(/Jogada (hoje, \d|em )/)).toHaveCount(2);
    await expect(page.getByText(/^2 de \d+$/)).toBeVisible();
  });

  test('jogar uma rodada na primeira não muda a segunda', async ({ page }) => {
    const first = await createCareer(page, 0);
    const second = await createCareer(page, 1);
    await page.goto('/jogo/');
    // Opens the older one (the row) and plays a round.
    await page.getByRole('button', { name: `Continuar a carreira de ${first}` }).click();
    await expect(playButton(page)).toBeVisible();
    const before = await nextRound(page);
    await playButton(page).click();
    await expect.poll(() => nextRound(page)).toBe(before + 1);
    await saveSettled(page);

    await page.goto('/jogo/');
    // The first is now the most recent: featured. The second is the row and still on round 1.
    await page.getByRole('button', { name: `Continuar a carreira de ${second}` }).click();
    await expect(playButton(page)).toBeVisible();
    expect(await nextRound(page)).toBe(1);
  });

  test('desistir no passo 1 pelo "Cancelar" não apaga nada', async ({ page }) => {
    await page.clock.install();
    const club = await startCareer(page);
    await page.goto('/jogo/');
    await expect(careerActions(page, club)).toBeVisible();
    await page.clock.pauseAt(Date.now() + 3_600_000);
    await careerActions(page, club).click();
    await page.clock.runFor(GUARD_MS);
    await dialog(page).getByRole('button', { name: 'Apagar carreira', exact: true }).click();
    await expect(dialog(page)).toHaveAccessibleName(`Apagar a carreira de ${club}?`);
    await dialog(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(careerActions(page, club)).toBeVisible();
    await page.clock.resume();
    await page.reload();
    await expect(careerActions(page, club)).toBeVisible();
  });

  test('apagar uma remove a carreira e as versões dela; a outra fica intacta', async ({ page }) => {
    const first = await createCareer(page, 0);
    const second = await createCareer(page, 1);
    await page.goto('/jogo/');
    await expect(careerActions(page, first)).toBeVisible();
    const careersBefore = await countRows(page, 'careers');
    const snapshotsBefore = await countRows(page, 'snapshots');
    expect(careersBefore).toBe(2);
    expect(snapshotsBefore).toBeGreaterThanOrEqual(2);

    await careerActions(page, first).click();
    await page.waitForTimeout(GUARD_MS + 100);
    await dialog(page).getByRole('button', { name: 'Apagar carreira', exact: true }).click();
    await page.waitForTimeout(GUARD_MS + 100);
    await dialog(page).getByRole('button', { name: 'Quero apagar', exact: true }).click();
    await page.waitForTimeout(GUARD_MS + 100);
    await dialog(page).getByRole('button', { name: 'Apagar carreira', exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText(`Carreira de ${first} apagada.`)).toBeAttached();

    expect(await countRows(page, 'careers')).toBe(1);
    expect(await countRows(page, 'snapshots')).toBeLessThan(snapshotsBefore);
    await expect(careerActions(page, second)).toBeVisible();
    await expect(careerActions(page, first)).toHaveCount(0);
    await page.reload();
    await expect(careerActions(page, second)).toBeVisible();
  });
});

test.describe('US-014: novo jogo', () => {
  const optionsButton = (page: Page) => page.getByRole('button', { name: /Opções da carreira/ });
  const start = (page: Page) => page.getByRole('button', { name: 'Começar' });

  test('os padrões: apelido do arquivo de conteúdo, sem clube "Começar" desabilitado', async ({
    page,
  }) => {
    await page.goto('/jogo/');
    await page.getByRole('button', { name: 'Nova carreira' }).click();
    await expect(page.getByRole('radio')).toHaveCount(20);
    await expect(start(page)).toBeDisabled();
    await expect(optionsButton(page)).toContainText('Técnico');
    await expect(optionsButton(page)).toContainText('Completo');
    await expect(optionsButton(page)).toContainText('Só resultado');
    await page.getByRole('radio').first().check();
    await expect(start(page)).toBeEnabled();
  });

  test('a última configuração volta marcada ao abrir o novo jogo de novo', async ({ page }) => {
    await page.goto('/jogo/');
    await page.getByRole('button', { name: 'Nova carreira' }).click();
    await optionsButton(page).click();
    await dialog(page)
      .getByRole('radio', { name: /Simplificado/ })
      .check();
    await dialog(page).getByRole('button', { name: 'Pronto' }).click();
    await page.getByRole('radio').nth(3).check();
    await start(page).click();
    await expect(playButton(page)).toBeVisible();

    await page.goto('/jogo/');
    await page.getByRole('button', { name: 'Nova carreira' }).click();
    await expect(optionsButton(page)).toContainText('Simplificado');
    await expect(optionsButton(page)).toContainText('Só resultado');
    await optionsButton(page).click();
    await expect(dialog(page).getByRole('radio', { name: /Simplificado/ })).toBeChecked();
    await expect(dialog(page).getByRole('radio', { name: /Só resultado/ })).toBeChecked();
  });

  test('apelido vazio, só com espaços ou longo demais desabilita "Começar" com a mensagem', async ({
    page,
  }) => {
    await page.goto('/jogo/');
    await page.getByRole('button', { name: 'Nova carreira' }).click();
    await page.getByRole('radio').first().check();
    await optionsButton(page).click();
    const field = dialog(page).getByLabel('Apelido do técnico');
    const cases: [string, string][] = [
      ['', 'Escreva um apelido.'],
      ['     ', 'Escreva um apelido.'],
      ['x'.repeat(25), 'Use até 24 caracteres.'],
    ];
    for (const [value, message] of cases) {
      await field.fill(value);
      await field.blur();
      await expect(dialog(page).getByText(message)).toBeVisible();
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    }
    await field.fill('x'.repeat(24));
    await field.blur();
    await expect(field).not.toHaveAttribute('aria-invalid', 'true');
    await field.fill('');
    await dialog(page).getByRole('button', { name: 'Pronto' }).click();
    await expect(start(page)).toBeDisabled();
    await expect(page.getByText('Corrija o apelido do técnico para começar.')).toBeVisible();
  });

  test('as opções de etapas futuras não aparecem, nem desabilitadas nem "em breve"', async ({
    page,
  }) => {
    await page.goto('/jogo/');
    await page.getByRole('button', { name: 'Nova carreira' }).click();
    await optionsButton(page).click();
    const text = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of [
      'tempo real',
      'desempregado',
      'técnico livre',
      'américa do sul',
      'nuvem',
      'em breve',
    ]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
    await expect(page.locator('input:disabled')).toHaveCount(0);
  });
});

test.describe('apagar, passo 2 com a folha rolável: tabulação', () => {
  test('Tab percorre fechar, região rolável, "Apagar carreira" e "Cancelar", e Shift+Tab volta', async ({
    page,
  }) => {
    // A short window makes the body of the sheet scroll.
    await page.setViewportSize({ width: 844, height: 300 });
    await page.clock.install();
    const club = await startCareer(page);
    await page.goto('/jogo/');
    await expect(careerActions(page, club)).toBeVisible();
    await page.clock.pauseAt(Date.now() + 3_600_000);
    await careerActions(page, club).click();
    await page.clock.runFor(GUARD_MS);
    await dialog(page).getByRole('button', { name: 'Apagar carreira', exact: true }).click();
    await page.clock.runFor(GUARD_MS);
    await dialog(page).getByRole('button', { name: 'Quero apagar', exact: true }).click();
    await expect(dialog(page)).toHaveAccessibleName(`Apagar de vez a carreira de ${club}?`);

    const region = dialog(page).getByRole('region');
    const scrolls = await region.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(scrolls, 'the body must overflow in this window').toBe(true);

    const close = dialog(page).getByRole('button', { name: 'Fechar', exact: true });
    const destroy = dialog(page).getByRole('button', { name: 'Apagar carreira', exact: true });
    const cancel = dialog(page).getByRole('button', { name: 'Cancelar', exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(region).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(destroy).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    // Shift+Tab walks it back.
    await page.keyboard.press('Shift+Tab');
    await expect(destroy).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(region).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(close).toBeFocused();
    // The keyboard scrolls the focused region.
    await page.clock.resume();
    await region.focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });
});
