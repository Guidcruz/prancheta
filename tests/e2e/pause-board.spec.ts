import { expect, test } from './fixtures.ts';
import {
  board,
  careerWith,
  control,
  freezeClock,
  matchScreen,
  onPhone,
  openMatch,
  runUntil,
  ui,
} from './match-helpers.ts';

/*
 * O placar não muda de altura ao pausar, nem com o clube de nome mais longo ("Inter-Regional") em
 * um dos lados a 360px. A medida do `pitch.spec.ts` ("a linha ao vivo não muda de altura ao
 * pausar") depende do clube sorteado da carreira; esta fixa o clube e confere os dois lados.
 */
test.describe('Placar ao pausar com o nome mais longo', () => {
  for (const mine of ['Inter-Regional']) {
    test(`a 360×740 o placar mantém a altura e o campo o lugar ao pausar (meu clube: ${mine})`, async ({
      page,
    }) => {
      test.skip(!onPhone(page), 'uma vez por navegador');
      await page.setViewportSize({ width: 360, height: 740 });
      await careerWith(page, 'full', undefined, mine);
      await freezeClock(page);
      await openMatch(page);
      await page.clock.runFor(2_000);
      const canvas = matchScreen(page).locator('canvas');
      const boardBox = async () => (await board(page).boundingBox())!.height;
      const before = { board: await boardBox(), y: (await canvas.boundingBox())!.y };
      await control(page, 'match.pause').click();
      const paused = board(page)
        .getByText(ui('pt-BR', 'match.paused'), { exact: true })
        .filter({ visible: true });
      await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });
      expect(await boardBox(), 'board height').toBe(before.board);
      expect((await canvas.boundingBox())!.y, 'pitch y').toBe(before.y);
    });
  }
});
