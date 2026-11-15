import { PLAY_GUARD_MS } from '../../app/src/ui/play-guard.ts';
import { expect, playButton } from './fixtures.ts';
import type { Page } from '@playwright/test';

/*
 * Passos da carreira que dependem das telas atuais (Início e Novo jogo da T-025): quando elas
 * mudarem, o ajuste é só aqui.
 */

/**
 * Abre o jogo e cria uma carreira com as opções padrão: "Nova carreira", o primeiro clube da
 * lista (o mais forte) e "Começar". Com `realism: 'simplified'`, marca "Simplificado" nas opções
 * da carreira antes. Termina na moldura da carreira e devolve o nome curto do clube.
 */
export async function startCareer(
  page: Page,
  options: { realism?: 'full' | 'simplified' } = {},
): Promise<string> {
  await page.goto('/jogo/');
  await page.getByRole('button', { name: 'Nova carreira' }).click();
  if (options.realism === 'simplified') {
    await page.getByRole('button', { name: /Opções da carreira/ }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('radio', { name: /Simplificado/ }).check();
    await sheet.getByRole('button', { name: 'Pronto' }).click();
  }
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

/**
 * Espera a gravação terminar: o botão "Jogar rodada" fica em `aria-busy` enquanto o IndexedDB
 * grava; recarregar ou editar o save nesse intervalo aborta a transação (WebKit). Desde a T-030 o
 * resumo da rodada só abre depois da gravação, mas o "Tentar de novo" e a ficha ainda gravam com o
 * botão na tela.
 */
export async function saveSettled(page: Page): Promise<void> {
  await expect(playButton(page)).not.toHaveAttribute('aria-busy', 'true');
}

/**
 * O `h1` do resumo da rodada (resumo-rodada.md), em qualquer idioma: o nome acessível é a rodada
 * seguida da frase do resultado ("Rodada 5. Vitória. ...").
 */
export const roundHeading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: /^(Rodada|Jornada|Round) \d+\. / });

/** A janela em que o "Jogar rodada" ignora toques depois de o resumo fechar (o valor do jogo). */
export { PLAY_GUARD_MS } from '../../app/src/ui/play-guard.ts';

/**
 * "Continuar" no resumo da rodada (`label` no idioma da página): volta à aba de origem, com o foco
 * no "Jogar rodada", e espera a janela de proteção passar, para o próximo toque valer.
 */
export async function closeSummary(page: Page, label = 'Continuar'): Promise<void> {
  await expect(roundHeading(page)).toBeVisible();
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(roundHeading(page)).toHaveCount(0);
  await expect(page.locator('button.play:focus')).toHaveCount(1);
  await page.waitForTimeout(PLAY_GUARD_MS + 50);
}

/**
 * Joga uma rodada pelo "Jogar rodada" da aba atual do Clube: espera o resumo dela abrir (só depois
 * da gravação), toca "Continuar" e confere que o Clube passou à rodada seguinte. Numa carreira em
 * modo assistido (T-032), a partida abre antes: toca "Pular", que joga, grava e abre o resumo.
 */
export async function playRound(page: Page): Promise<void> {
  const next = await nextRound(page);
  await playButton(page).click();
  const match = page.locator('main.match');
  await expect(roundHeading(page).or(match)).toBeVisible();
  if ((await match.count()) === 1) {
    await match.getByRole('button', { name: 'Pular', exact: true }).click();
  }
  await expect(roundHeading(page)).toHaveAccessibleName(new RegExp(`^Rodada ${next}\\. `));
  await closeSummary(page);
  await expect.poll(() => nextRound(page)).toBe(next + 1);
  await saveSettled(page);
}

/** Joga rodadas pelo "Jogar rodada" até a próxima ser `round` (lida na tela do Clube). */
export async function playUntil(page: Page, round: number): Promise<void> {
  for (let next = await nextRound(page); next < round; next++) await playRound(page);
}

/** Os textos da abertura da carreira em cada idioma do navegador (content/<idioma>/ui.json). */
const OPEN_TEXTS = {
  es: { continue: 'Continuar', nav: 'Navegación principal' },
  en: { continue: 'Continue', nav: 'Main navigation' },
} as const;

/**
 * Reabre a carreira mais recente com o navegador em `lang`: o jogo lê `navigator.language` ao
 * carregar (`detectLang`), e a carreira continua a mesma. Termina na moldura, já no idioma. O
 * idioma fica para as próximas cargas da página (`addInitScript`).
 */
export async function reopenIn(page: Page, lang: keyof typeof OPEN_TEXTS): Promise<void> {
  await page.addInitScript((language) => {
    Object.defineProperty(Navigator.prototype, 'language', {
      configurable: true,
      get: () => language,
    });
  }, lang);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await continueIn(page, lang);
}

/** "Continuar" na tela inicial, com o jogo em `lang` (a página já carregada nesse idioma). */
export async function continueIn(page: Page, lang: keyof typeof OPEN_TEXTS): Promise<void> {
  await page.getByRole('button', { name: OPEN_TEXTS[lang].continue, exact: true }).click();
  await expect(page.getByRole('navigation', { name: OPEN_TEXTS[lang].nav })).toBeVisible();
}

/** {@link reopenIn} em espanhol ("Continuar" é a mesma palavra). */
export async function reopenInSpanish(page: Page): Promise<void> {
  await reopenIn(page, 'es');
}
