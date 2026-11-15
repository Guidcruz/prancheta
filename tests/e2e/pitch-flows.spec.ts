import type { Page } from '@playwright/test';
import { closeSummary, continueCareer, roundHeading } from './career.ts';
import { expect, playButton, test } from './fixtures.ts';
import {
  board,
  careerWith,
  control,
  freezeClock,
  matchScreen,
  minuteText,
  openMatch,
  playToEnd,
  runToMinute,
  runUntil,
  shownScore,
  ui,
} from './match-helpers.ts';
import { readSave } from './save.ts';

/*
 * QA da T-085: os fluxos em volta do campo 2D que os outros specs não cruzam (docs/design/telas/
 * partida.md, "Campo 2D (T-085)"): a carreira que já tem um tipo de partida o mantém; "Só resultado"
 * e "Só lances principais" sem campo; o voltar do celular e o fechar no meio (fluxo da T-032) agora
 * com o campo; a troca de app e o retorno; e o movimento reduzido ligado no meio da partida.
 * Sem service worker, para o pedido do chunk do campo ser visível. Nada disso existe no jogo.
 */

const canvas = (page: Page) => matchScreen(page).locator('canvas');

/** Conta as chamadas a `requestAnimationFrame` (em `window.rafCalls`). */
async function countFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { rafCalls: number };
    w.rafCalls = 0;
    const ask = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (run) => {
      w.rafCalls++;
      return ask(run);
    };
  });
}
const frames = (page: Page) =>
  page.evaluate(() => (window as unknown as { rafCalls: number }).rafCalls);

/** Um resumo dos pixels do canvas (para ver se o campo foi desenhado e se ele mudou). */
const pixels = (page: Page) =>
  canvas(page).evaluate((element) => {
    const c = element as HTMLCanvasElement;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let hash = 0;
    for (let i = 0; i < data.length; i++) hash = (Math.imul(hash, 31) + data[i]!) | 0;
    return hash;
  });

const pitchRequests = (page: Page): string[] => {
  const asked: string[] = [];
  page.on('request', (request) => {
    if (/\/assets\/pitch-chunk-/.test(request.url())) asked.push(request.url());
  });
  return asked;
};

test.describe('Campo 2D: fluxos em volta (QA T-085)', () => {
  test.use({ serviceWorkers: 'block' });
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
  });

  test('carreira antiga: o tipo que o save já tinha continua, no seletor e na partida, sem campo (highlights)', async ({
    page,
  }) => {
    const asked = pitchRequests(page);
    await careerWith(page, 'highlights');
    // Reopen the career in a fresh load: the stored type wins over the new default.
    await page.reload();
    await continueCareer(page);
    await expect(playButton(page)).toContainText(ui('pt-BR', 'newGame.match.highlights'));
    expect((await readSave(page)).career).toMatchObject({ matchMode: 'highlights' });
    await freezeClock(page);
    await openMatch(page);
    await expect(matchScreen(page)).toHaveAttribute('data-mode', 'highlights');
    await expect(page.locator('canvas')).toHaveCount(0);
    await playToEnd(page);
    expect(asked).toEqual([]);
    expect((await readSave(page)).career).toMatchObject({ matchMode: 'highlights' });
  });

  test('carreira antiga em "Só resultado": o resumo direto, nenhuma tela de partida, nenhum canvas e nenhum pedido ao campo', async ({
    page,
  }) => {
    await countFrames(page);
    const asked = pitchRequests(page);
    await careerWith(page, 'result');
    await page.reload();
    await continueCareer(page);
    await expect(playButton(page)).toContainText(ui('pt-BR', 'newGame.match.result'));
    await freezeClock(page);
    await playButton(page).click();
    await runUntil(page, async () => (await roundHeading(page).count()) === 1);
    await expect(matchScreen(page)).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(asked).toEqual([]);
    await page.clock.resume();
    await closeSummary(page);
    expect((await readSave(page)).career).toMatchObject({ matchMode: 'result' });
  });

  test('voltar do celular no 20 com o campo: pausa e pergunta, o canvas fica, continuar retoma e o campo anda; pular abre o resumo', async ({
    page,
  }) => {
    await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    await runToMinute(page, 20);
    await page.goBack();
    const sheet = page.getByRole('dialog', { name: ui('pt-BR', 'match.leave.title') });
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/#\/match$/);
    const paused = board(page).getByText(ui('pt-BR', 'match.paused'), { exact: true });
    await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });
    // Paused at the end of a step: the pitch stops there (no frames, same pixels).
    const still = await pixels(page);
    await page.clock.runFor(3_000);
    expect(await pixels(page)).toBe(still);
    await expect(canvas(page)).toHaveCount(1);

    await sheet.getByRole('button', { name: ui('pt-BR', 'match.leave.stay') }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/match$/);
    const minute = await minuteText(page);
    await page.clock.runFor(3_000);
    expect(await minuteText(page)).not.toBe(minute);
    await expect(canvas(page)).toHaveCount(1);

    await page.goBack();
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: ui('pt-BR', 'match.leave.skip') }).click();
    await runUntil(page, async () => (await roundHeading(page).count()) === 1);
    await expect(page).toHaveURL(/#\/round$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/club$/);
    await expect(playButton(page)).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('fechar no 30 com o campo e reabrir: nada aplicado, e jogar de novo dá o mesmo placar com o campo de volta', async ({
    page,
    context,
  }) => {
    const { expected } = await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    await runToMinute(page, 30);
    await page.clock.resume();
    await page.close();
    const again = await context.newPage();
    await continueCareer(again);
    await expect(again).toHaveURL(/#\/club$/);
    const stored = await readSave(again);
    expect(stored.game.round).toBe(1);
    expect((stored.career as unknown as { matchMode: string }).matchMode).toBe('full');
    await again.clock.install();
    await freezeClock(again);
    await openMatch(again);
    await expect(matchScreen(again)).toHaveAttribute('data-mode', 'full');
    await expect(canvas(again)).toHaveCount(1);
    await playToEnd(again);
    expect(await shownScore(again)).toEqual(expected.result.score);
  });

  test('troca de app no meio: a página escondida pausa no fim do passo, ao voltar o campo é o mesmo e "Retomar" o faz andar até o fim', async ({
    page,
  }) => {
    const { expected } = await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    await runToMinute(page, 15);
    const visibility = (state: 'hidden' | 'visible') =>
      page.evaluate((value) => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => value,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await visibility('hidden');
    const paused = board(page).getByText(ui('pt-BR', 'match.paused'), { exact: true });
    await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });
    const minute = await minuteText(page);
    const hidden = await pixels(page);
    await page.clock.runFor(20_000);
    expect(await minuteText(page)).toBe(minute);
    await visibility('visible');
    // Coming back does not resume by itself, and the pitch was not wiped.
    await expect(paused).toBeVisible();
    expect(await pixels(page)).toBe(hidden);
    await expect(canvas(page)).toHaveCount(1);
    await control(page, 'match.resume').click();
    await expect(paused).toHaveCount(0);
    await playToEnd(page);
    expect(await shownScore(page)).toEqual(expected.result.score);
    await expect(canvas(page)).toHaveCount(1);
  });

  test('movimento reduzido ligado no meio da partida: antes, o campo pede quadros; depois, nenhum quadro entre os lances e nenhuma animação', async ({
    page,
  }) => {
    await countFrames(page);
    await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    const start = await frames(page);
    await runToMinute(page, 10);
    expect(await frames(page)).toBeGreaterThan(start);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // The change counts from the next step on: let the one in course end.
    await page.clock.runFor(3_000);
    const before = await frames(page);
    // A silent stretch of minutes: still pitch, no frame requested.
    await page.clock.runFor(1_500);
    const quiet = await frames(page);
    expect(quiet - before).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await playToEnd(page);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('movimento reduzido ligado no meio da partida sem o evento change da media query (como o WebKit, que só o despacha na próxima atualização da tela): o passo seguinte já para o campo', async ({
    page,
  }) => {
    // The `change` of the reduced-motion query never reaches the game; `matches` is up to date.
    await page.addInitScript(() => {
      const add = MediaQueryList.prototype.addEventListener;
      MediaQueryList.prototype.addEventListener = function (
        this: MediaQueryList,
        ...args: Parameters<MediaQueryList['addEventListener']>
      ) {
        if (args[0] === 'change' && this.media.includes('prefers-reduced-motion')) return;
        return add.apply(this, args);
      } as MediaQueryList['addEventListener'];
    });
    await countFrames(page);
    await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    const start = await frames(page);
    await runToMinute(page, 10);
    expect(await frames(page)).toBeGreaterThan(start);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.runFor(3_000);
    const before = await frames(page);
    await page.clock.runFor(1_500);
    expect((await frames(page)) - before).toBeLessThanOrEqual(2);
  });
});
