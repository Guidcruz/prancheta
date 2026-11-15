import type { Page } from '@playwright/test';
import { reopenIn } from './career.ts';
import { expect, test } from './fixtures.ts';
import {
  board,
  careerWith,
  control,
  freezeClock,
  matchScreen,
  minuteText,
  onPhone,
  openMatch,
  runUntil,
  ui,
  type Lang,
} from './match-helpers.ts';
import { patchSave } from './save.ts';

/*
 * O placar não muda ao pausar (docs/design/telas/partida.md, "Linha ao vivo: largura e altura
 * fixas", item 18 de "Medidas para o E2E"): a 360×740, com o clube de nome mais longo
 * ("Inter-Regional") como mandante e como visitante, antes e depois de "Pausar" a altura do
 * placar, o `y` do campo, a largura do centro e a de cada lado são iguais; a linha ao vivo mede 20px
 * e cada nome 22px (uma linha); a fase some e "Pausada" aparece no lugar; a frase escondida segue
 * com o minuto, a fase e "Pausada". Em es, só no 1º tempo antes do acréscimo (no acréscimo do 2º
 * tempo vale a pendência de texto registrada na spec: lá só se confere rodando × pausada).
 * A medida do `pitch.spec.ts` ("a linha ao vivo não muda de altura ao pausar") depende do clube
 * sorteado da carreira; esta fixa o clube e os dois lados.
 */

interface Shape {
  board: number;
  canvasY: number;
  center: number;
  sides: number[];
  live: number;
  names: number[];
}

const shapeOf = (page: Page): Promise<Shape> =>
  page.evaluate(() => {
    const box = (selector: string) =>
      document.querySelector(`main.match ${selector}`)!.getBoundingClientRect();
    const all = (selector: string) =>
      [...document.querySelectorAll(`main.match ${selector}`)].map(
        (e) => e.getBoundingClientRect().width,
      );
    return {
      board: box('.scoreboard').height,
      canvasY: box('canvas').y,
      center: box('.center').width,
      sides: all('.scoreboard .side'),
      live: box('.live').height,
      names: [...document.querySelectorAll('main.match .scoreboard .name')].map(
        (e) => e.getBoundingClientRect().height,
      ),
    };
  });

/** The hidden sentence of the live line (after the group's name): minute, phase and "Pausada". */
const sentence = (page: Page) =>
  board(page).locator('p.visually-hidden:not([aria-live])').textContent();

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('Placar ao pausar com o nome mais longo', () => {
  const cases: { lang: Lang; side: 'home' | 'away'; whole: boolean }[] = [
    ...(['pt-BR', 'en'] as const).flatMap((lang) =>
      (['home', 'away'] as const).map((side) => ({ lang, side, whole: true })),
    ),
    ...(['home', 'away'] as const).map((side) => ({ lang: 'es' as Lang, side, whole: false })),
  ];
  for (const { lang, side, whole } of cases) {
    test(`a 360×740 o placar não muda ao pausar, em ${lang}, com Inter-Regional de ${side === 'home' ? 'mandante' : 'visitante'}${whole ? '' : ' (1º tempo, antes do acréscimo)'}`, async ({
      page,
    }) => {
      test.skip(!onPhone(page), 'uma vez por navegador');
      await page.clock.install();
      await page.setViewportSize({ width: 360, height: 740 });
      const { save } = await careerWith(page, 'full', undefined, 'Inter-Regional');
      const myFixture = save.game.fixtures.find(
        (f) =>
          f.round === save.game.round &&
          (f.homeId === save.career.clubId || f.awayId === save.career.clubId),
      )!;
      if ((myFixture.homeId === save.career.clubId) !== (side === 'home')) {
        // The fixture has the other side: swap the clubs of my match in the save.
        await patchSave(page, (s) => {
          const mine = s.game.fixtures.find(
            (f) =>
              f.round === s.game.round &&
              (f.homeId === s.career.clubId || f.awayId === s.career.clubId),
          )!;
          [mine.homeId, mine.awayId] = [mine.awayId, mine.homeId];
        });
      }
      if (lang !== 'pt-BR') {
        await page.clock.resume();
        await reopenIn(page, lang as 'es' | 'en');
      }
      await freezeClock(page);
      await openMatch(page, lang);
      const names = board(page).locator('.name');
      await expect(names).toHaveText(
        side === 'home' ? ['Inter-Regional', /.+/] : [/.+/, 'Inter-Regional'],
      );
      // The pitch comes in a lazy chunk: wait for the canvas before measuring anything.
      await expect(matchScreen(page).locator('canvas')).toHaveCount(1);
      await page.clock.runFor(2_000);
      const minuteRunning = Number(/\d+/.exec(await minuteText(page))![0]);
      expect(minuteRunning, 'first half, before the stoppage time').toBeLessThan(45);

      const phase = board(page).locator('.live .phase');
      const pausedWord = board(page).locator('.live .paused');
      await expect(phase).toBeVisible();
      await expect(pausedWord).toBeHidden();
      const running = await shapeOf(page);
      expect(running.live, 'live line').toBe(20);
      for (const h of running.names) expect(h, 'name height').toBe(22);
      const runningSentence = await sentence(page);
      expect(runningSentence).toContain(ui(lang, 'match.phase.first'));
      expect(runningSentence).not.toContain(ui(lang, 'match.paused'));
      if (whole) expect(await sideScroll(page), 'running: no side scroll').toBeLessThanOrEqual(0);

      await control(page, 'match.pause', lang).click();
      const paused = board(page)
        .getByText(ui(lang, 'match.paused'), { exact: true })
        .filter({ visible: true });
      await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });
      await expect(phase).toBeHidden();
      await expect(pausedWord).toBeVisible();
      const still = await shapeOf(page);

      expect(still.board, 'board height').toBe(running.board);
      expect(still.canvasY, 'pitch y').toBe(running.canvasY);
      expect(Math.abs(still.center - running.center), 'center width').toBeLessThanOrEqual(0.5);
      expect(still.sides).toHaveLength(2);
      for (const [i, w] of still.sides.entries()) {
        expect(Math.abs(w - running.sides[i]!), `side ${i} width`).toBeLessThanOrEqual(0.5);
      }
      expect(still.live, 'live line').toBe(20);
      for (const h of still.names) expect(h, 'name height').toBe(22);
      expect(await sideScroll(page), 'paused: no side scroll').toBeLessThanOrEqual(0);

      // The hidden sentence keeps the minute, the phase and the word "Pausada".
      const minuteNow = Number(/\d+/.exec(await minuteText(page))![0]);
      const text = (await sentence(page))!;
      expect(text).toContain(ui(lang, 'match.minute.a11y', { minute: minuteNow }));
      expect(text).toContain(ui(lang, 'match.phase.first'));
      expect(text).toContain(ui(lang, 'match.paused'));
      expect(await matchScreen(page).count()).toBe(1);
    });
  }
});
