import type { BrowserContext, Page } from '@playwright/test';
import { matchSteps } from '../../app/src/ui/match/steps.ts';
import { MATCH_TIMING } from '../../app/src/ui/match/timing.ts';
import { closeSummary, continueCareer, roundHeading, startCareer } from './career.ts';
import { setTheme, tokenColor } from './css.ts';
import { expect, playButton, test } from './fixtures.ts';
import {
  board,
  careerWith,
  control,
  freezeClock,
  goalsOf,
  lively,
  matchScreen,
  onPhone,
  openMatch,
  playToEnd,
  runToMinute,
  runUntil,
  shownScore,
  timeTo,
  ui,
} from './match-helpers.ts';

/*
 * O campo 2D (T-085; docs/design/telas/partida.md, "Medidas para o E2E", T-085, e
 * docs/02-architecture.md, 4.7). Cada teste diz os itens que cobre; os itens 3 a 7 são do Vitest
 * (app/src/ui/match/pitch/scene.test.ts e app/src/lib/generators/kit.test.ts). O relógio da
 * partida corre pelo relógio falso do Playwright, menos na medida de quadros (relógio real). Os
 * pedidos de quadro (`requestAnimationFrame`) são contados por um `addInitScript` registrado depois
 * do relógio falso, então contam os do relógio falso; nada disso existe no jogo.
 */

const pitchBox = (page: Page) => matchScreen(page).locator('.pitch-box');
const canvas = (page: Page) => matchScreen(page).locator('canvas');
/** A etiqueta de gol (PitchTag `goal`, no lugar da comemoração em cartão): o `.place` é o `aria-hidden`. */
const celebration = (page: Page) => matchScreen(page).locator('.place:has(.tag.goal)');

/** Conta as chamadas a `requestAnimationFrame` da página (em `window.rafCalls`). */
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

/** A altura visível da narração (a caixa de conteúdo da lista rolável, sem o respiro). */
const feedHeight = (page: Page) =>
  matchScreen(page)
    .locator('section.feed')
    .evaluate((feed) => {
      const style = getComputedStyle(feed);
      return feed.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    });

/**
 * A cor de um pixel do canvas, como `rgb(r, g, b)` (partida-campo-v2.md, 13, E2E 3): `grass` é o
 * meio da borda de baixo (o gramado de perto, que nenhum disco nem a bola alcança) e `stand` o
 * canto de cima à esquerda (a cobertura da arquibancada).
 */
const pixelOf = (page: Page, where: 'grass' | 'stand') =>
  canvas(page).evaluate((element, spot) => {
    const c = element as HTMLCanvasElement;
    const [x, y] = spot === 'grass' ? [Math.floor(c.width / 2), c.height - 1] : [0, 0];
    const [r, g, b] = c.getContext('2d')!.getImageData(x, y, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  }, where);

/** As linhas do registro de erros (`errors` do banco de teste). */
const errorCodes = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('prancheta-test');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('errors').objectStore('errors').getAll();
          all.onsuccess = () => {
            db.close();
            resolve((all.result as { code: string; screen?: string }[]).map((e) => e.code));
          };
          all.onerror = () => reject(all.error);
        };
      }),
  );

/** Uma partida com um gol de jogada. */
const withGoal = (r: Parameters<typeof lively>[0]) =>
  lively(r) && goalsOf(r).some((g) => g.kind === 'open');

test.describe('Campo 2D (T-085)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
  });

  test('campo presente na "Animada completa": canvas escondido do leitor, de borda a borda, 240px a 360×740 e 4 linhas de narração; a 360×640, até 200px (item 1)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await page.setViewportSize({ width: 360, height: 740 });
    await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    await expect(canvas(page)).toHaveAttribute('aria-hidden', 'true');
    const box = (await pitchBox(page).boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.width).toBe(360);
    expect(Math.abs(box.height - 240)).toBeLessThanOrEqual(2);
    expect(await feedHeight(page)).toBeGreaterThanOrEqual(220);
    // The canvas is the 1.5:1 rectangle inside the room: 360 × 240.
    const drawn = (await canvas(page).boundingBox())!;
    expect(Math.abs(drawn.width / drawn.height - 111 / 74)).toBeLessThan(0.02);

    await page.setViewportSize({ width: 360, height: 640 });
    await expect
      .poll(async () => (await pitchBox(page).boundingBox())!.height)
      .toBeLessThanOrEqual(200);
    expect(await feedHeight(page)).toBeGreaterThanOrEqual(170);
    const scroll = await page.evaluate(() => ({
      h: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      w: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(scroll).toEqual({ h: 0, w: 0 });
  });

  test.describe('sem service worker', () => {
    test.use({ serviceWorkers: 'block' });

    test('só na "Animada completa": em "Só lances principais", nenhum canvas, nenhum pedido ao chunk do campo e nenhum quadro (item 2)', async ({
      page,
    }) => {
      await countFrames(page);
      const asked: string[] = [];
      page.on('request', (request) => {
        if (/\/assets\/pitch-chunk-/.test(request.url())) asked.push(request.url());
      });
      await careerWith(page, 'highlights');
      await freezeClock(page);
      await openMatch(page);
      const before = await frames(page);
      await runToMinute(page, 20);
      await page.clock.runFor(5_000);
      await expect(matchScreen(page)).toHaveAttribute('data-mode', 'highlights');
      await expect(page.locator('canvas')).toHaveCount(0);
      await expect(pitchBox(page)).toHaveCount(0);
      expect(await frames(page)).toBe(before);
      expect(asked).toEqual([]);
    });

    test('canvas que falha: sem contexto 2D, o leiaute da T-032 sem aviso até o resumo, registrado uma vez (item 10)', async ({
      page,
    }) => {
      await page.addInitScript(() => {
        HTMLCanvasElement.prototype.getContext = () => null;
      });
      const { expected } = await careerWith(page, 'full');
      await freezeClock(page);
      await openMatch(page);
      await runToMinute(page, 5);
      await expect(canvas(page)).toHaveCount(0);
      await expect(pitchBox(page)).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(matchScreen(page)).not.toHaveClass(/two/);
      await playToEnd(page);
      expect(await shownScore(page)).toEqual(expected.result.score);
      await control(page, 'match.toSummary').click();
      await expect(roundHeading(page)).toBeVisible();
      expect((await errorCodes(page)).filter((c) => c.startsWith('pitch-'))).toEqual([
        'pitch-context',
      ]);
    });

    test('canvas que falha: o desenho lança no meio do jogo, o leiaute da T-032 sem aviso até o resumo, um registro pitch-draw (item 10)', async ({
      page,
    }) => {
      // `arc` throws from the moment the test raises the flag, with the pitch already drawn.
      await page.addInitScript(() => {
        const arc = CanvasRenderingContext2D.prototype.arc;
        CanvasRenderingContext2D.prototype.arc = function (
          this: CanvasRenderingContext2D,
          ...args: Parameters<CanvasRenderingContext2D['arc']>
        ) {
          if ((window as unknown as { failArc?: boolean }).failArc) {
            throw new Error('arc failed (test)');
          }
          return arc.apply(this, args);
        };
      });
      const { expected } = await careerWith(page, 'full');
      await freezeClock(page);
      await openMatch(page);
      await runToMinute(page, 5);
      // The pitch is there (two columns on the desktop) until the draw fails.
      await expect(canvas(page)).toHaveCount(1);
      if (!onPhone(page)) await expect(matchScreen(page)).toHaveClass(/two/);
      await page.evaluate(() => ((window as unknown as { failArc: boolean }).failArc = true));
      await page.clock.runFor(500);
      await expect(canvas(page)).toHaveCount(0);
      await expect(pitchBox(page)).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(matchScreen(page)).not.toHaveClass(/two/);
      await runToMinute(page, 20);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await control(page, 'match.skip').click();
      await runUntil(page, async () => (await roundHeading(page).count()) === 1);
      await expect(roundHeading(page)).toHaveAccessibleName(
        new RegExp(`${expected.result.score[0]}.*${expected.result.score[1]}`),
      );
      expect((await errorCodes(page)).filter((c) => c.startsWith('pitch-'))).toEqual([
        'pitch-draw',
      ]);
    });

    test('canvas que falha: o chunk do campo não carrega, o leiaute da T-032 sem aviso até o resumo, registrado (item 10)', async ({
      page,
    }) => {
      let aborted = 0;
      await page.route('**/assets/pitch-chunk-*', (route) => {
        aborted++;
        return route.abort('failed');
      });
      await careerWith(page, 'full');
      await freezeClock(page);
      await openMatch(page);
      await runToMinute(page, 5);
      expect(aborted).toBeGreaterThan(0);
      await expect(canvas(page)).toHaveCount(0);
      await expect(pitchBox(page)).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await control(page, 'match.skip').click();
      await runUntil(page, async () => (await roundHeading(page).count()) === 1);
      expect((await errorCodes(page)).filter((c) => c.startsWith('pitch-'))).toEqual([
        'pitch-chunk',
      ]);
    });
  });

  test('etiqueta de gol: no desfecho do gol, a camisa e o artilheiro, escondida do leitor, até o passo seguinte; a 360×640, sem o nome (item 8)', async ({
    page,
  }) => {
    const { save, expected } = await careerWith(page, 'full', withGoal);
    const steps = matchSteps(expected.result.events, 'full');
    const goal = goalsOf(expected.result).find((g) => g.kind === 'open')!;
    const id = `e${expected.result.events.indexOf(goal)}`;
    const outcome = steps.findIndex((s) => s.line?.id === id && s.line.stage === 'final');
    const name = (save.game.players[goal.scorer] as { name: { display: string } }).name.display;
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    // The start of the play: no celebration yet.
    await page.clock.runFor(timeTo(steps, outcome) - 300);
    await expect(celebration(page)).toHaveCount(0);
    await page.clock.runFor(400);
    await expect(celebration(page)).toBeVisible();
    await expect(celebration(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(celebration(page)).toContainText(ui('pt-BR', 'match.celebration.title'));
    await expect(celebration(page)).toContainText(name);
    expect(await shownScore(page)).toEqual([...goal.score]);
    // The shirt of the scorer (no crest: the line of the commentary has it): his number, and the
    // kit of his own club (the id of the clip of the shirt is made of the club of the kit).
    const shirt = (save.game.players[goal.scorer] as { shirt: number }).shirt;
    await expect(celebration(page).locator('.number')).toHaveText(String(shirt));
    const clip = (id: string) => `id="kt-${id.toLowerCase().replace(/[^a-z0-9-]/g, '')}-`;
    const scoringClub = goal.side === 'home' ? expected.homeId : expected.awayId;
    const otherClub = goal.side === 'home' ? expected.awayId : expected.homeId;
    const svg = await celebration(page).locator('svg[viewBox="0 0 64 42"]').innerHTML();
    expect(svg).toContain(clip(scoringClub));
    expect(svg).not.toContain(clip(otherClub));
    await expect(celebration(page).locator('svg[viewBox="0 0 64 42"]')).toHaveCount(1);
    await expect(celebration(page).locator('.crest')).toHaveCount(0);
    expect(await celebration(page).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe(
      'none',
    );
    // Until the next step.
    await page.clock.runFor(MATCH_TIMING.normal.afterGoal - 500);
    await expect(celebration(page)).toBeVisible();
    await page.clock.runFor(600);
    await expect(celebration(page)).toHaveCount(0);

    // With the pitch under 200px tall (360×640): the shirt and the title only.
    await page.setViewportSize({ width: 360, height: 640 });
    await control(page, 'match.skip').click();
    await runUntil(page, async () => (await roundHeading(page).count()) === 1);
    await page.clock.resume();
    await closeSummary(page);
    const again = await careerWith(page, 'full', withGoal);
    const againSteps = matchSteps(again.expected.result.events, 'full');
    const againGoal = goalsOf(again.expected.result).find((g) => g.kind === 'open')!;
    const againName = (again.save.game.players[againGoal.scorer] as { name: { display: string } })
      .name.display;
    const againId = `e${again.expected.result.events.indexOf(againGoal)}`;
    const againOutcome = againSteps.findIndex(
      (s) => s.line?.id === againId && s.line.stage === 'final',
    );
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    expect((await pitchBox(page).boundingBox())!.height).toBeLessThan(200);
    await page.clock.runFor(timeTo(againSteps, againOutcome) + 100);
    await expect(celebration(page)).toBeVisible();
    await expect(celebration(page)).toContainText(ui('pt-BR', 'match.celebration.title'));
    await expect(celebration(page)).not.toContainText(againName);
  });

  test('pausada com a página escondida no meio de um passo: ao voltar, o campo está no fim do passo, igual a um redesenho (regressão da revisão)', async ({
    page,
  }) => {
    const { expected } = await careerWith(page, 'full');
    const steps = matchSteps(expected.result.events, 'full');
    // A minute with nothing shown, where the ball walks the whole step.
    const minute = steps.findIndex(
      (s, i) => i > 3 && s.line === undefined && steps[i - 1]!.timing !== 'afterGoal',
    );
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    await page.clock.runFor(timeTo(steps, minute) + MATCH_TIMING.normal.minuteFull / 2);
    const visibility = (state: 'hidden' | 'visible') =>
      page.evaluate((value) => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => value,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    // Hidden in the middle of the step: the pause waits for its end, with the pitch already still.
    await visibility('hidden');
    const paused = board(page)
      .getByText(ui('pt-BR', 'match.paused'), { exact: true })
      .filter({ visible: true });
    await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });
    await page.clock.runFor(3_000);
    const pixels = () =>
      canvas(page).evaluate((element) => {
        const c = element as HTMLCanvasElement;
        const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let hash = 0;
        for (let i = 0; i < data.length; i++) hash = (Math.imul(hash, 31) + data[i]!) | 0;
        return hash;
      });
    // Still hidden: the pause itself drew the end of the step (the player's `onchange`).
    const hidden = await pixels();
    await visibility('visible');
    await expect(paused).toBeVisible();
    const shown = await pixels();
    expect(shown).toBe(hidden);
    // A forced redraw (the theme there and back) draws the same instant: the end of the step.
    await setTheme(page, 'dia');
    await setTheme(page, 'noite');
    await expect.poll(pixels).toBe(shown);
  });

  test('a linha ao vivo não muda de altura ao pausar: o campo fica no mesmo lugar a 360×740 (revisão)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await page.setViewportSize({ width: 360, height: 740 });
    await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    await page.clock.runFor(2_000);
    const running = (await canvas(page).boundingBox())!.y;
    await control(page, 'match.pause').click();
    const paused = board(page)
      .getByText(ui('pt-BR', 'match.paused'), { exact: true })
      .filter({ visible: true });
    await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });
    expect((await canvas(page).boundingBox())!.y).toBe(running);
    await control(page, 'match.resume').click();
    await expect(paused).toHaveCount(0);
    expect((await canvas(page).boundingBox())!.y).toBe(running);
  });

  test('movimento reduzido: nenhum quadro pedido entre os lances, a comemoração parada e nenhuma animação (item 9)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await countFrames(page);
    const { expected } = await careerWith(page, 'full', withGoal);
    const steps = matchSteps(expected.result.events, 'full');
    const goal = goalsOf(expected.result).find((g) => g.kind === 'open')!;
    const id = `e${expected.result.events.indexOf(goal)}`;
    const outcome = steps.findIndex((s) => s.line?.id === id && s.line.stage === 'final');
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    const animations = () => page.evaluate(() => document.getAnimations().length);
    const before = await frames(page);
    await page.clock.runFor(timeTo(steps, outcome) + 100);
    await expect(celebration(page)).toBeVisible();
    expect(await animations()).toBe(0);
    expect(await frames(page)).toBe(before);
    await page.clock.runFor(10_000);
    expect(await frames(page)).toBe(before);
    expect(await animations()).toBe(0);
  });

  test('tema: o meio da borda de baixo tem a cor de --pitch e o canto de cima, a de --surface-0, nos temas noite e dia, trocados no meio da partida (item 11)', async ({
    page,
  }) => {
    await careerWith(page, 'full');
    await setTheme(page, 'noite');
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    await page.clock.runFor(1_000);
    const grass = () => pixelOf(page, 'grass');
    const stand = () => pixelOf(page, 'stand');
    expect(await grass()).toBe(await tokenColor(page, 'pitch'));
    expect(await stand()).toBe(await tokenColor(page, 'surface-0'));
    // The floodlights are lit: 8px under the roof, under the 2nd one, the red is up by 45 or more.
    const lit = await canvas(page).evaluate((element) => {
      const c = element as HTMLCanvasElement;
      const q = c.width / 360;
      // The median of 5 pixels in a column: a 1px row of seats cannot be the one that is read.
      const column = Math.round(c.width * 0.37);
      const top = Math.round(17 * q);
      const reds = [0, 1, 2, 3, 4]
        .map((i) => c.getContext('2d')!.getImageData(column, top + i, 1, 1).data[0]!)
        .sort((x, y) => x - y);
      return reds[2]!;
    });
    const base = Number((await tokenColor(page, 'surface-0')).match(/\d+/)![0]);
    expect(lit - base).toBeGreaterThanOrEqual(45);
    const night = {
      pitch: await tokenColor(page, 'pitch'),
      stand: await tokenColor(page, 'surface-0'),
    };
    await setTheme(page, 'dia');
    const day = {
      pitch: await tokenColor(page, 'pitch'),
      stand: await tokenColor(page, 'surface-0'),
    };
    expect(day.pitch).not.toBe(night.pitch);
    expect(day.stand).not.toBe(night.stand);
    await expect.poll(grass).toBe(day.pitch);
    await expect.poll(stand).toBe(day.stand);
    // Paused, the theme still redraws the field.
    await control(page, 'match.pause').click();
    await page.clock.runFor(3_000);
    await setTheme(page, 'noite');
    await expect.poll(grass).toBe(night.pitch);
    await expect.poll(stand).toBe(night.stand);
  });

  test('a sobra da caixa ao lado do campo continua a arquibancada: nenhum pixel de --pitch acima de 85% da altura, a 360×640, 844×390 e 1280×800, nos dois temas', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    for (const [width, height] of [
      [360, 640],
      [844, 390],
      [1280, 800],
    ] as const) {
      await page.setViewportSize({ width, height });
      for (const theme of ['noite', 'dia'] as const) {
        await setTheme(page, theme);
        await page.clock.runFor(500);
        const box = (await pitchBox(page).boundingBox())!;
        const cv = (await canvas(page).boundingBox())!;
        const strip = Math.floor(cv.x - box.x) - 2;
        // Only a phone upright has room left at the sides; elsewhere the box is the canvas.
        if (width === 360) expect(strip, `${width}×${height}: há sobra`).toBeGreaterThan(4);
        if (strip < 1) continue;
        const png = await page.screenshot({
          clip: { x: box.x + 1, y: box.y, width: strip, height: box.height },
        });
        const grass = await tokenColor(page, 'pitch');
        const found = await page.evaluate(
          async ([data, pitch]) => {
            const bitmap = await createImageBitmap(await (await fetch(data!)).blob());
            const c = new OffscreenCanvas(bitmap.width, bitmap.height);
            const g = c.getContext('2d')!;
            g.drawImage(bitmap, 0, 0);
            const column = Math.floor(bitmap.width / 2);
            const bad: number[] = [];
            for (let y = 0; y < bitmap.height * 0.85; y++) {
              const [r, gr, b] = g.getImageData(column, y, 1, 1).data;
              if (`rgb(${r}, ${gr}, ${b})` === pitch) bad.push(y);
            }
            return bad.length;
          },
          [`data:image/png;base64,${png.toString('base64')}`, grass],
        );
        expect(found, `${width}×${height} ${theme}`).toBe(0);
      }
    }
  });

  test('deitado (844×390) e desktop (1280×800): cabeçalho e campo à esquerda, placar e narração à direita, com a barra inteira (item 12)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await careerWith(page, 'full');
    await freezeClock(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    const layout = async () => {
      const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
      const pitch = (await pitchBox(page).boundingBox())!;
      const scoreboard = (await board(page).boundingBox())!;
      const feed = (await matchScreen(page).locator('section.feed').boundingBox())!;
      const bar = (await matchScreen(page).locator('.bar').boundingBox())!;
      return { h1, pitch, scoreboard, feed, bar };
    };
    let at = await layout();
    expect(at.h1.x + at.h1.width).toBeLessThanOrEqual(at.scoreboard.x + 1);
    expect(at.pitch.x + at.pitch.width).toBeLessThanOrEqual(at.scoreboard.x + 1);
    expect(at.pitch.y).toBeGreaterThanOrEqual(at.h1.y + at.h1.height - 1);
    expect(at.feed.x).toBeGreaterThanOrEqual(at.pitch.x + at.pitch.width);
    expect(at.feed.y).toBeGreaterThanOrEqual(at.scoreboard.y + at.scoreboard.height - 1);
    // At least 3 lines of a play (54px with their 4px gaps).
    expect(await feedHeight(page)).toBeGreaterThanOrEqual(3 * 54 + 2 * 4);
    expect(at.bar.y + at.bar.height).toBeLessThanOrEqual(390 + 1);
    expect(at.bar.x).toBeGreaterThanOrEqual(-1);
    expect(at.bar.x + at.bar.width).toBeLessThanOrEqual(844 + 1);
    for (const key of ['match.pause', 'match.fast', 'match.skip']) {
      const button = (await control(page, key).boundingBox())!;
      expect(button.y + button.height, key).toBeLessThanOrEqual(390);
      expect(button.x + button.width, key).toBeLessThanOrEqual(844);
    }
    const sideScroll = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    expect(await sideScroll()).toBe(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(matchScreen(page)).toHaveClass(/two/);
    at = await layout();
    expect(at.pitch.x + at.pitch.width).toBeLessThanOrEqual(at.scoreboard.x + 1);
    expect(at.pitch.y).toBeGreaterThanOrEqual(at.h1.y + at.h1.height - 1);
    const wide = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.width = 'var(--layout-wide-max)';
      document.body.append(probe);
      const max = probe.getBoundingClientRect().width;
      probe.remove();
      return max;
    });
    const main = (await matchScreen(page).boundingBox())!;
    expect(main.width).toBeLessThanOrEqual(wide + 1);
    // The bar at the foot of the right column.
    expect(at.bar.x).toBeGreaterThanOrEqual(at.feed.x - 1);
    expect(at.bar.y).toBeGreaterThanOrEqual(at.feed.y + at.feed.height - 1);
    expect(at.bar.y + at.bar.height).toBeLessThanOrEqual(800 + 1);
    expect(await sideScroll()).toBe(0);
  });

  test('"Animada completa" é a primeira carta do Novo jogo e do seletor, marcada da primeira vez; com outra lembrada, a lembrada (item 13)', async ({
    page,
  }) => {
    await page.goto('/jogo/');
    await page.getByRole('button', { name: 'Nova carreira' }).click();
    const options = page.getByRole('button', { name: /Opções da carreira/ });
    await expect(options).toContainText(ui('pt-BR', 'newGame.match.full'));
    await options.click();
    const sheet = page.getByRole('dialog');
    const titles = [ui('pt-BR', 'newGame.match.full'), ui('pt-BR', 'newGame.match.highlights')];
    const matchCards = sheet.getByRole('radio', {
      name: new RegExp(`^(${titles.join('|')}|${ui('pt-BR', 'newGame.match.result')})`),
    });
    await expect(matchCards).toHaveCount(3);
    await expect(matchCards.first()).toHaveAccessibleName(new RegExp(`^${titles[0]}`));
    await expect(matchCards.first()).toBeChecked();
    await sheet.getByRole('button', { name: ui('pt-BR', 'newGame.options.done') }).click();

    // The selector of "Jogar rodada": "Animada completa" first, checked in a new career.
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Começar' }).click();
    await expect(playButton(page)).toContainText(ui('pt-BR', 'newGame.match.full'));
    await page
      .getByRole('button', { name: /^Mudar o tipo de partida/ })
      .first()
      .click();
    const selector = page.getByRole('dialog', { name: ui('pt-BR', 'play.mode.title') });
    await expect(selector.getByRole('radio')).toHaveCount(3);
    await expect(selector.getByRole('radio').first()).toHaveAccessibleName(
      new RegExp(`^${titles[0]}`),
    );
    await expect(selector.getByRole('radio').first()).toBeChecked();
    await selector.getByRole('button', { name: ui('pt-BR', 'nav.close') }).click();

    // Another mode remembered (newGame.last): the remembered one is checked.
    await startCareer(page, { matchMode: 'highlights' });
    await page.goto('/jogo/');
    await page.getByRole('button', { name: 'Nova carreira' }).click();
    await expect(options).toContainText(ui('pt-BR', 'newGame.match.highlights'));
    await options.click();
    await expect(sheet.getByRole('radio', { name: new RegExp(`^${titles[1]}`) })).toBeChecked();
    await expect(sheet.getByRole('radio', { name: new RegExp(`^${titles[0]}`) })).not.toBeChecked();
  });

  test('canvas parado depois do apito final e com a partida pausada (item 14, parte do canvas parado)', async ({
    page,
  }) => {
    await countFrames(page);
    await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await expect(canvas(page)).toHaveCount(1);
    await page.clock.runFor(2_000);
    expect(await frames(page)).toBeGreaterThan(0);
    // Paused: no frame.
    await control(page, 'match.pause').click();
    const paused = board(page)
      .getByText(ui('pt-BR', 'match.paused'), { exact: true })
      .filter({ visible: true });
    await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });
    let before = await frames(page);
    await page.clock.runFor(5_000);
    expect(await frames(page)).toBe(before);
    // The page hidden: no frame.
    await control(page, 'match.resume').click();
    await page.clock.runFor(1_000);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });
    before = await frames(page);
    await page.clock.runFor(5_000);
    expect(await frames(page)).toBe(before);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // After the final whistle: no frame.
    await control(page, 'match.resume').click();
    await playToEnd(page);
    before = await frames(page);
    await page.clock.runFor(5_000);
    expect(await frames(page)).toBe(before);
  });
});

test.describe('Campo 2D: offline (T-085)', () => {
  test.use({ serviceWorkers: 'allow' });

  /** Espera o service worker controlar a página (recarrega uma vez, se preciso). */
  async function controlled(page: Page): Promise<void> {
    await page.goto('/jogo/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) {
      await page.reload();
    }
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
  }

  async function offline(context: BrowserContext): Promise<void> {
    await context.route('**/*', (route) => route.abort('internetdisconnected'));
    await context.setOffline(true);
  }

  test('a primeira partida da carreira em "Animada completa" abre sem rede, com o campo (§4.7)', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium' || !onPhone(page), 'só Chromium (§4.7); uma vez');
    await controlled(page);
    await startCareer(page, { matchMode: 'full' });
    await offline(context);
    await continueCareer(page);
    await playButton(page).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Rodada 1' })).toBeVisible();
    await expect(canvas(page)).toHaveCount(1);
    await expect.poll(() => pixelOf(page, 'grass')).toBe(await tokenColor(page, 'pitch'));
    await expect.poll(() => pixelOf(page, 'stand')).toBe(await tokenColor(page, 'surface-0'));
  });
});

/** A long task of the page, with the minute the board showed when it was reported. */
interface LongFrame {
  startTime: number;
  duration: number;
  blockingDuration: number;
  styleAndLayoutStart: number;
  scripts: { sourceURL: string; sourceFunctionName: string; invoker: string; duration: number }[];
}

/** A long animation frame (>= 50 ms) as the page saw it, with its scripts. */
interface SeenFrame {
  at: number;
  duration: number;
  blocking: number;
  renderMs: number;
  scripts: LongFrame['scripts'];
}

/*
 * "Measure only what the pitch causes" (partida-campo-v2.md, 16 item 9, 12 and 13 E2E 2). A long
 * animation frame (long-animation-frame, >= 50 ms) is the pitch's when the scripts of the pitch
 * inside it are what makes it long:
 *   - script of the pitch: the code of the pitch chunk (sourceURL pitch-chunk, MatchPitch,
 *     backdrop, scene, geometry, tokens, motion, kits), which also holds the callbacks the pitch
 *     registers (ResizeObserver, MutationObserver, MessagePort, requestAnimationFrame): the
 *     invoker names the callback, the sourceURL says whose code it is;
 *   - the pitch's share of the frame = the sum of the duration of those scripts in it;
 *   - the frame FAILS when the share is >= 50 ms (the pitch alone is a long task) or when the
 *     frame has blocking time and the share is >= 50% of it (the pitch is most of the part that
 *     blocks the page). The union of the two is the strictest rule that still names a cause:
 *     the first alone would let a pitch of 45 ms inside a 90 ms frame go; the second alone
 *     would not catch a pitch of 60 ms next to a 130 ms render.
 * The frames that are only style, layout and paint, and the scripts of other code (MatchScreen,
 * timers), are real but not the pitch's: they are printed and do not fail (they show even with
 * the box of the pitch hidden, so the load of the machine and of the page decide them).
 */
const PITCH_SCRIPT = /pitch-chunk|MatchPitch|backdrop|scene|geometry|tokens|motion|kits/i;
const isPitchScript = (x: LongFrame['scripts'][number]) =>
  PITCH_SCRIPT.test(x.sourceURL) || PITCH_SCRIPT.test(x.sourceFunctionName);

const pitchShare = (frame: SeenFrame) =>
  frame.scripts.filter(isPitchScript).reduce((sum, x) => sum + x.duration, 0);

const isPitchFrame = (frame: SeenFrame) => {
  const share = pitchShare(frame);
  return share >= 50 || (frame.blocking > 0 && share >= 0.5 * frame.blocking);
};

const describeFrame = (frame: SeenFrame, from = 0) =>
  `aos ${((frame.at - from) / 1000).toFixed(1)} s: ${frame.duration.toFixed(0)} ms (bloqueio ${frame.blocking.toFixed(0)} ms, estilo e leiaute ${frame.renderMs.toFixed(0)} ms, campo ${pitchShare(frame).toFixed(0)} ms; ${
    frame.scripts
      .map(
        (x) =>
          `${isPitchScript(x) ? 'CAMPO ' : ''}${x.sourceFunctionName || x.invoker} ${x.sourceURL.split('/').pop()} ${x.duration.toFixed(0)} ms`,
      )
      .join(', ') || 'sem script'
  })`;

/** Starts to record the long animation frames in `window.seenFrames`. */
const watchFrames = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { seenFrames: SeenFrame[] };
    w.seenFrames = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as LongFrame[]) {
        if (entry.duration < 50) continue;
        w.seenFrames.push({
          at: entry.startTime,
          duration: entry.duration,
          blocking: entry.blockingDuration,
          renderMs:
            entry.styleAndLayoutStart > 0
              ? entry.startTime + entry.duration - entry.styleAndLayoutStart
              : 0,
          scripts: entry.scripts.map((x) => ({
            sourceURL: x.sourceURL,
            sourceFunctionName: x.sourceFunctionName,
            invoker: x.invoker,
            duration: x.duration,
          })),
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  });

const seenFrames = (page: Page) =>
  page.evaluate(() => [...(window as unknown as { seenFrames: SeenFrame[] }).seenFrames]);

interface LongTask {
  start: number;
  duration: number;
  minute: string;
}

test.describe('Campo 2D: desempenho (T-085)', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

  test('quadros p95 ≤ 34 ms e desenho mediano ≤ 6 ms em 15 s, CPU 4×; densidade limitada a 2 (item 14)', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' || test.info().project.name.endsWith('desktop'),
      'CDP; uma vez',
    );
    test.setTimeout(120_000);
    // Each frame callback: when it ran and how long it took (the draw of a frame of the pitch).
    await page.addInitScript(() => {
      const w = window as unknown as { frameAt: number[]; frameTook: number[] };
      w.frameAt = [];
      w.frameTook = [];
      const ask = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (run) =>
        ask((time) => {
          const start = performance.now();
          run(time);
          w.frameTook.push(performance.now() - start);
          w.frameAt.push(time);
        });
    });
    await careerWith(page, 'full');
    const cdp = await page.context().newCDPSession(page);
    await page.getByRole('button', { name: ui('pt-BR', 'play.label') }).click();
    await expect(canvas(page)).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(3);
    const size = await canvas(page).evaluate((element) => {
      const c = element as HTMLCanvasElement;
      const rect = c.getBoundingClientRect();
      return { width: c.width, height: c.height, css: rect.width, cssHeight: rect.height };
    });
    expect(size.width).toBe(Math.round(size.css * 2));
    expect(size.height).toBe(Math.round(size.cssHeight * 2));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => {
      const w = window as unknown as { frameAt: number[]; frameTook: number[] };
      w.frameAt.length = 0;
      w.frameTook.length = 0;
    });
    await page.waitForTimeout(15_000);
    const { at, took } = await page.evaluate(() => {
      const w = window as unknown as { frameAt: number[]; frameTook: number[] };
      return { at: [...w.frameAt], took: [...w.frameTook] };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const gaps = at.slice(1).map((t, i) => t - at[i]!);
    const quantile = (list: number[], q: number) =>
      [...list].sort((a, b) => a - b)[Math.max(0, Math.ceil(q * list.length) - 1)]!;
    const p95 = quantile(gaps, 0.95);
    const median = quantile(took, 0.5);
    console.log(
      `quadros em 15 s (CPU 4×, 390×844, densidade 3): ${at.length}; intervalo p50 ${quantile(gaps, 0.5).toFixed(1)} ms, p95 ${p95.toFixed(1)} ms; desenho p50 ${median.toFixed(2)} ms, p95 ${quantile(took, 0.95).toFixed(2)} ms; canvas ${size.width}×${size.height}`,
    );
    expect(at.length).toBeGreaterThan(200);
    expect(p95).toBeLessThanOrEqual(34);
    expect(median).toBeLessThanOrEqual(6);
  });

  test('nenhum quadro longo (≥ 50 ms) é do campo na partida inteira da "Animada completa" em Rápido, CPU 4×, com a troca de tema no meio (partida-campo-v2.md, 13, E2E 2)', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' || test.info().project.name.endsWith('desktop'),
      'CDP; uma vez',
    );
    test.setTimeout(180_000);
    await careerWith(page, 'full');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => {
      const w = window as unknown as { longTasks: LongTask[] };
      w.longTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.longTasks.push({
            start: entry.startTime,
            duration: entry.duration,
            minute:
              document.querySelector('main.match .scoreboard .live .minute')?.textContent ?? '',
          });
        }
      }).observe({ type: 'longtask' });
    });
    await watchFrames(page);
    await playButton(page).click();
    await expect(matchScreen(page)).toBeVisible();
    await expect(canvas(page)).toHaveCount(1);
    // The match counts from the first frame of the pitch: the first drawing, with the code cold,
    // is the opening of the screen (see the test of the redraw of the background).
    await expect
      .poll(() => pixelOf(page, 'grass'), { timeout: 15_000 })
      .toBe(await tokenColor(page, 'pitch'));
    await page.evaluate(
      (word) => {
        const w = window as unknown as { kickoff: number; whistle?: number };
        w.kickoff = performance.now();
        const phase = document.querySelector('main.match .scoreboard .live .phase')!;
        new MutationObserver(() => {
          if (w.whistle === undefined && phase.textContent === word) w.whistle = performance.now();
        }).observe(phase, { childList: true, characterData: true, subtree: true });
      },
      ui('pt-BR', 'match.phase.end'),
    );
    await control(page, 'match.fast').click();
    // The theme changes in the middle of the match, with the plays going on (E2E 2 of the spec).
    const minute = async () =>
      Number(/^(\d+)/.exec(await board(page).locator('.live .minute').innerText())?.[1] ?? 0);
    const changes = [
      { at: 15, run: () => setTheme(page, 'dia') },
      { at: 40, run: () => setTheme(page, 'noite') },
      { at: 65, run: () => setTheme(page, 'dia') },
    ];
    const themeAt: number[] = [];
    for (const change of changes) {
      await expect.poll(minute, { timeout: 90_000 }).toBeGreaterThanOrEqual(change.at);
      themeAt.push(await page.evaluate(() => performance.now()));
      await change.run();
    }
    await expect(control(page, 'match.toSummary')).toBeVisible({ timeout: 90_000 });
    const longTasks = await page.evaluate(() => {
      const w = window as unknown as {
        longTasks: LongTask[];
        kickoff: number;
        whistle?: number;
      };
      return w.longTasks
        .filter((t) => t.start >= w.kickoff && t.start < (w.whistle ?? Infinity))
        .map((t) => ({ ...t, start: t.start - w.kickoff }));
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const { kickoff, whistle } = await page.evaluate(() => {
      const w = window as unknown as { kickoff: number; whistle?: number };
      return { kickoff: w.kickoff, whistle: w.whistle ?? Infinity };
    });
    // The long frames from the first frame of the pitch to the final whistle.
    const inMatch = (await seenFrames(page)).filter((f) => f.at >= kickoff && f.at < whistle);
    const pitchFrames = inMatch.filter(isPitchFrame);
    const others = inMatch.filter((f) => !isPitchFrame(f));
    console.log(
      `quadros longos da partida que não são do campo (não reprovam, ${others.length}): ${others.map((f) => describeFrame(f, kickoff)).join(' | ')}`,
    );
    console.log(
      `quadros longos da partida do campo (${pitchFrames.length}): ${pitchFrames.map((f) => describeFrame(f, kickoff)).join(' | ')}`,
    );
    console.log(
      `tarefas longas na "Animada completa" inteira (CPU 4×, só registro): [${longTasks
        .map(
          (t) =>
            `${t.duration.toFixed(0)} ms aos ${(t.start / 1000).toFixed(1)} s, minuto ${t.minute}`,
        )
        .join(
          '; ',
        )}]; trocas de tema aos ${themeAt.map((t) => ((t - kickoff) / 1000).toFixed(1)).join(', ')} s`,
    );
    expect(pitchFrames.map((f) => describeFrame(f, kickoff))).toEqual([]);
  });

  test('o redesenho do fundo, na troca de tema e no redimensionamento, tem p95 ≤ 30 ms e nenhuma medida acima de 50 ms com CPU 4×, e nenhum quadro longo é do campo (partida-campo-v2.md, 12)', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' || test.info().project.name.endsWith('desktop'),
      'CDP; uma vez',
    );
    test.setTimeout(120_000);
    // The background is drawn in a canvas out of the page (`field`): it starts when its size is
    // set and ends when the first copy to the main canvas returns. Measured from outside, with no hook in the game.
    await page.addInitScript(() => {
      const w = window as unknown as {
        redraws: { took: number; width: number }[];
        longTasks: { start: number; duration: number }[];
      };
      w.redraws = [];
      w.longTasks = [];
      let started: number | null = null;
      const width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')!;
      Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
        ...width,
        set(this: HTMLCanvasElement, value: number) {
          if (!this.isConnected) started = performance.now();
          width.set!.call(this, value);
        },
      });
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (
        this: CanvasRenderingContext2D,
        ...args: [CanvasImageSource, number, number]
      ) {
        const source = args[0];
        const first =
          started !== null && source instanceof HTMLCanvasElement && !source.isConnected;
        const result = drawImage.apply(this, args as never);
        // The first copy of the new background is part of the redraw: it is where the browser
        // resolves the canvas, so the time is taken when the copy returns.
        if (first) {
          w.redraws.push({ took: performance.now() - started!, width: source.width });
          started = null;
        }
        return result;
      } as typeof drawImage;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.longTasks.push({ start: entry.startTime, duration: entry.duration });
        }
      }).observe({ type: 'longtask' });
    });
    await careerWith(page, 'full');
    await watchFrames(page);
    await page.getByRole('button', { name: ui('pt-BR', 'play.label') }).click();
    await expect(canvas(page)).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(3);
    const redraws = () =>
      page.evaluate(
        () => (window as unknown as { redraws: { took: number; width: number }[] }).redraws.length,
      );
    await expect.poll(redraws).toBeGreaterThan(0);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const wanted: { what: string; at: number }[] = [];
    const next = async (what: string, change: () => Promise<unknown>) => {
      const before = await redraws();
      const at = await page.evaluate(() => performance.now());
      await change();
      await expect.poll(redraws, { message: what }).toBeGreaterThan(before);
      wanted.push({ what, at });
    };
    // Four rounds of 6 changes (24 redraws, enough for a p95): theme, theme, and the sizes of the phone upright, the small phone, lying
    // down and the desktop. The phone sizes run at CPU 4× (the target of the spec); the desktop,
    // whose canvas is the largest (about 1190×790 px), at CPU 1×: no desktop is 4× slower.
    for (let round = 0; round < 4; round++) {
      await next(`tema dia ${round}`, () => setTheme(page, 'dia'));
      await next(`tema noite ${round}`, () => setTheme(page, 'noite'));
      for (const [width, height] of [
        [360, 640],
        [844, 390],
        [1280, 800],
        [390, 844],
      ] as const) {
        const desktop = width === 1280;
        if (desktop) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        await next(`${width}×${height} ${round}`, () => page.setViewportSize({ width, height }));
        if (desktop) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      }
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const { took, long } = await page.evaluate(() => {
      const w = window as unknown as {
        redraws: { took: number; width: number }[];
        longTasks: { start: number; duration: number }[];
      };
      return { took: w.redraws.map((r) => ({ ...r })), long: [...w.longTasks] };
    });
    // The first redraw is the pitch loading (cold code, no throttling): not a theme or a size.
    const measured = took.slice(1);
    const worst = Math.max(...measured.map((r) => r.took));
    console.log(
      `redesenho do fundo (ms, CPU 4×, ${measured.length} redesenhos): ${measured
        .map((r) => `${r.took.toFixed(1)}@${r.width}`)
        .join(' ')}; pior ${worst.toFixed(1)} ms`,
    );
    // Each long task, with the last change made before it (only logged).
    for (const task of long) {
      const last = [...wanted].reverse().find((w) => w.at <= task.start);
      console.log(
        `tarefa longa de ${task.duration.toFixed(0)} ms, ${last === undefined ? 'antes das mudanças' : `${(task.start - last.at).toFixed(0)} ms depois de "${last.what}"`}`,
      );
    }
    const frames = await seenFrames(page);
    const pitchFrames = frames.filter(isPitchFrame);
    console.log(
      `quadros longos que não são do campo (não reprovam, ${frames.length - pitchFrames.length}): ${frames
        .filter((f) => !isPitchFrame(f))
        .map((f) => describeFrame(f))
        .join(' | ')}`,
    );
    const p95 = [...measured.map((r) => r.took)].sort((a, b) => a - b)[
      Math.ceil(0.95 * measured.length) - 1
    ]!;
    console.log(
      `redesenho do fundo: ${measured.length} medidas, p95 ${p95.toFixed(1)} ms, pior ${worst.toFixed(1)} ms`,
    );
    // At least 20 samples, so that the p95 is not the maximum under another name.
    expect(measured.length).toBeGreaterThanOrEqual(20);
    expect(measured.length).toBeGreaterThanOrEqual(wanted.length - 1);
    expect(p95).toBeLessThanOrEqual(30);
    expect(worst).toBeLessThanOrEqual(50);
    expect(pitchFrames.map((f) => describeFrame(f))).toEqual([]);
  });
});
