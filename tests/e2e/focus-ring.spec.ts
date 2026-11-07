import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { startCareer } from './career.ts';

/*
 * Anel de foco só para o teclado (design-system.md, "Foco: anel só para o teclado"): o que o
 * club-squad.spec.ts não cobre. Lá: toque com o foco do mouse impedido (jeito do WebKit), Tab
 * depois do toque, Enter e Esc. Aqui: clique de mouse de verdade, o campo de texto (anel depois
 * do clique e no Esc de dentro dele) e a volta do teclado depois do mouse.
 */

const outline = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).outlineStyle);

test.describe('Anel de foco: clique, campo de texto e teclado', () => {
  test('clique do mouse: o X e o nome voltam sem anel; o teclado traz o anel de volta', async ({
    page,
  }) => {
    await startCareer(page);
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Elenco' })
      .click();
    const rows = page.locator('main tbody th[scope="row"]');
    await expect(rows).toHaveCount(25);
    const name = rows.first().getByRole('button');
    const dialog = page.getByRole('dialog');
    const close = dialog.getByRole('button', { name: 'Fechar' });

    await name.click();
    await expect(close).toBeFocused();
    expect(await outline(close), 'X depois do clique').toBe('none');
    await close.click();
    await expect(dialog).toBeHidden();
    await expect(name).toBeFocused();
    expect(await outline(name), 'nome depois do clique').toBe('none');

    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle),
      'Tab depois do clique',
    ).toBe('solid');
  });

  test('campo de texto: mantém o anel depois do clique e no Esc de dentro dele', async ({
    page,
  }) => {
    await page.goto('/jogo/');
    await page.getByRole('button', { name: 'Nova carreira' }).click();
    await page.getByRole('button', { name: /Opções da carreira/ }).click();
    const field = page.getByRole('dialog').locator('input[type="text"]');
    await expect(field).toBeVisible();

    await field.click();
    await expect(field).toBeFocused();
    expect(await outline(field), 'campo depois do clique').toBe('solid');

    // Typing in the field is not navigation; the ring stays.
    await page.keyboard.type('ab');
    expect(await outline(field), 'campo depois de digitar').toBe('solid');

    // Esc inside the field is the keyboard: the ring shows on whatever has focus.
    await page.keyboard.press('Escape');
    expect(
      await page.evaluate(() => {
        const el = document.activeElement!;
        return {
          html: document.documentElement.dataset.input,
          outline: getComputedStyle(el).outlineStyle,
        };
      }),
    ).toEqual({ html: 'keyboard', outline: 'solid' });
  });
});
