import { expect, playButton } from './fixtures.ts';
import type { Page } from '@playwright/test';

/*
 * Passos da carreira que dependem das telas atuais. A tela inicial e o "Novo jogo" são provisórios
 * (T-023) e viram as reais na T-025: quando mudarem, o ajuste é só aqui.
 */

/** Abre o jogo e cria uma carreira com as opções padrão; termina na moldura da carreira. */
export async function startCareer(page: Page): Promise<void> {
  await page.goto('/jogo/');
  await page.getByRole('button', { name: /nova carreira|novo jogo/i }).click();
  await expect(playButton(page)).toBeVisible();
}

/** Abre a primeira carreira da lista da tela inicial. */
export async function continueCareer(page: Page): Promise<void> {
  await page.goto('/jogo/');
  await page
    .getByText(/continuar/i)
    .first()
    .click();
  await expect(playButton(page)).toBeVisible();
}

/** A rodada a ser jogada, lida do texto da área de conteúdo. */
export async function nextRound(page: Page): Promise<number> {
  const text = await page.locator('main').innerText();
  const match = /rodada:?\s*(\d+)/i.exec(text);
  if (match === null) throw new Error(`rodada não encontrada no texto: ${text}`);
  return Number(match[1]);
}
