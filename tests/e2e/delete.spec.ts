import type { Page } from '@playwright/test';
import { careerActions, startCareer } from './career.ts';
import { expect, test } from './fixtures.ts';

/*
 * Apagar uma carreira em dois passos (US-034; docs/design/telas/inicio.md), no navegador: as
 * folhas de verdade (dialog modal), o foco e o voltar. E o toque duplo (revisão da T-025): cada
 * botão de passo ignora toques por 500 ms depois de a folha abrir. O relógio do Playwright fica
 * parado nesses testes, então dois toques seguidos acontecem "no mesmo instante" e só passam
 * depois de `runFor`: se a janela sumir, o teste do toque duplo apaga e reprova.
 */

const GUARD_MS = 500;

const dialog = (page: Page) => page.getByRole('dialog');
const button = (page: Page, name: string) =>
  dialog(page).getByRole('button', { name, exact: true });

/** Uma carreira criada e a tela inicial aberta com o relógio parado; devolve o clube. */
async function homeWithCareer(page: Page): Promise<string> {
  await page.clock.install();
  const club = await startCareer(page);
  await page.goto('/jogo/');
  await expect(careerActions(page, club)).toBeVisible();
  await page.clock.pauseAt(Date.now() + 3_600_000);
  return club;
}

test.describe('apagar com confirmação dupla', () => {
  test('só o passo 2 apaga; o aviso sai e o estado vazio aparece', async ({ page }) => {
    const club = await homeWithCareer(page);
    await careerActions(page, club).click();
    await expect(dialog(page)).toHaveAccessibleName(`Carreira de ${club}`);
    await page.clock.runFor(GUARD_MS);
    await button(page, 'Apagar carreira').click();
    await expect(dialog(page)).toHaveAccessibleName(`Apagar a carreira de ${club}?`);
    // O foco entra no fechar da folha, nunca no botão do passo.
    await expect(button(page, 'Fechar')).toBeFocused();
    await page.clock.runFor(GUARD_MS);
    await button(page, 'Quero apagar').click();
    await expect(dialog(page)).toHaveAccessibleName(`Apagar de vez a carreira de ${club}?`);
    await expect(button(page, 'Fechar')).toBeFocused();
    await page.clock.runFor(GUARD_MS);
    await button(page, 'Apagar carreira').click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText(`Carreira de ${club} apagada.`)).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Nenhuma carreira ainda' })).toBeVisible();
    // Depois da recarga a carreira continua apagada.
    await page.clock.resume();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Nenhuma carreira ainda' })).toBeVisible();
  });

  test('cancelar no passo 2 não apaga e devolve o foco ao "Mais ações"', async ({ page }) => {
    const club = await homeWithCareer(page);
    await careerActions(page, club).click();
    await page.clock.runFor(GUARD_MS);
    await button(page, 'Apagar carreira').click();
    await page.clock.runFor(GUARD_MS);
    await button(page, 'Quero apagar').click();
    await button(page, 'Cancelar').click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(careerActions(page, club)).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Suas carreiras' })).toBeVisible();
  });

  test('o voltar do celular fecha o passo 1 sem apagar', async ({ page }) => {
    const club = await homeWithCareer(page);
    await careerActions(page, club).click();
    await page.clock.runFor(GUARD_MS);
    await button(page, 'Apagar carreira').click();
    await expect(dialog(page)).toHaveAccessibleName(`Apagar a carreira de ${club}?`);
    await page.goBack();
    await expect(dialog(page)).toHaveCount(0);
    await expect(careerActions(page, club)).toBeVisible();
    await expect(careerActions(page, club)).toBeFocused();
  });

  test('toque duplo e triplo nunca passam de um passo para o outro', async ({ page }) => {
    const club = await homeWithCareer(page);
    await careerActions(page, club).click();
    await page.clock.runFor(GUARD_MS);
    // Toque duplo: o segundo toque cai em "Quero apagar" logo que o passo 1 abre.
    await button(page, 'Apagar carreira').click();
    await button(page, 'Quero apagar').click();
    await expect(dialog(page)).toHaveAccessibleName(`Apagar a carreira de ${club}?`);
    await page.clock.runFor(GUARD_MS);
    // Toque triplo a partir do passo 1: o passo 2 abre, mas o destrutivo ignora os dois toques.
    await button(page, 'Quero apagar').click();
    await button(page, 'Apagar carreira').click();
    await button(page, 'Apagar carreira').click();
    await expect(dialog(page)).toHaveAccessibleName(`Apagar de vez a carreira de ${club}?`);
    await expect(button(page, 'Apagar carreira')).not.toHaveAttribute('aria-busy', 'true');
    // Nada foi apagado: cancela e a carta continua lá, também depois de recarregar.
    await button(page, 'Cancelar').click();
    await expect(careerActions(page, club)).toBeVisible();
    await page.clock.resume();
    await page.reload();
    await expect(careerActions(page, club)).toBeVisible();
  });

  test('em todas as folhas o "Cancelar" fica abaixo do botão do passo, também no passo 2', async ({
    page,
  }) => {
    const club = await homeWithCareer(page);
    await careerActions(page, club).click();
    await page.clock.runFor(GUARD_MS);
    await button(page, 'Apagar carreira').click();
    await page.clock.runFor(GUARD_MS);
    await button(page, 'Quero apagar').click();
    const cancel = await button(page, 'Cancelar').boundingBox();
    const destroy = await button(page, 'Apagar carreira').boundingBox();
    expect(cancel!.y).toBeGreaterThan(destroy!.y);
  });

  test('o destrutivo do passo 2 sobe e o "Cancelar" não sai do lugar entre as folhas', async ({
    page,
  }) => {
    const club = await homeWithCareer(page);
    await careerActions(page, club).click();
    const cancelActions = await button(page, 'Cancelar').boundingBox();
    await page.clock.runFor(GUARD_MS);
    await button(page, 'Apagar carreira').click();
    const step1 = await button(page, 'Quero apagar').boundingBox();
    const cancelStep1 = await button(page, 'Cancelar').boundingBox();
    await page.clock.runFor(GUARD_MS);
    await button(page, 'Quero apagar').click();
    await expect(dialog(page)).toHaveAccessibleName(`Apagar de vez a carreira de ${club}?`);
    const destroy = await button(page, 'Apagar carreira').boundingBox();
    const cancelStep2 = await button(page, 'Cancelar').boundingBox();
    // O destrutivo do passo 2 fica pelo menos 56 px acima de onde estava o "Quero apagar".
    expect(step1!.y - destroy!.y).toBeGreaterThanOrEqual(56);
    const overlap = (a: typeof step1, b: typeof step1) =>
      a!.y < b!.y + b!.height && b!.y < a!.y + a!.height;
    expect(overlap(step1, destroy)).toBe(false);
    // O "Cancelar" fica no mesmo lugar nas três folhas (até 1 px).
    expect(Math.abs(cancelStep1!.y - cancelActions!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(cancelStep2!.y - cancelActions!.y)).toBeLessThanOrEqual(1);
  });
});
