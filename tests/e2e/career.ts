import { expect, playButton } from './fixtures.ts';
import type { Page } from '@playwright/test';

/*
 * Passos da carreira que dependem das telas atuais (Início e Novo jogo da T-025): quando elas
 * mudarem, o ajuste é só aqui.
 */

/**
 * Abre o jogo e cria uma carreira com as opções padrão: "Nova carreira", o primeiro clube da
 * lista (o mais forte) e "Começar". Termina na moldura da carreira e devolve o nome curto do
 * clube.
 */
export async function startCareer(page: Page): Promise<string> {
  await page.goto('/jogo/');
  await page.getByRole('button', { name: 'Nova carreira' }).click();
  const club = page.getByRole('radio').first();
  await club.check();
  const name = (await club.locator('xpath=ancestor::label').locator('.name').innerText()).trim();
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(playButton(page)).toBeVisible();
  return name;
}

/** Abre a carreira em destaque (a mais recente) da tela inicial. */
export async function continueCareer(page: Page): Promise<void> {
  await page.goto('/jogo/');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(playButton(page)).toBeVisible();
}

/** O botão "Mais ações" da carta de um clube na tela inicial. */
export const careerActions = (page: Page, club: string) =>
  page.getByRole('button', { name: `Mais ações da carreira de ${club}` });

/** A rodada a ser jogada, lida do texto da área de conteúdo. */
export async function nextRound(page: Page): Promise<number> {
  const text = await page.locator('main').innerText();
  const match = /rodada:?\s*(\d+)/i.exec(text);
  if (match === null) throw new Error(`rodada não encontrada no texto: ${text}`);
  return Number(match[1]);
}
