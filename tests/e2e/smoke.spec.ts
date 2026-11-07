import { continueCareer, nextRound, saveSettled, startCareer } from './career.ts';
import { expect, playButton, test } from './fixtures.ts';

test('cria uma carreira, joga uma rodada, reabre a página e vê a carreira', async ({ page }) => {
  await startCareer(page);
  const before = await nextRound(page);

  await playButton(page).click();
  await expect.poll(() => nextRound(page)).toBe(before + 1);

  // Sem aviso de falha de gravação.
  await expect(page.getByRole('alert')).toHaveCount(0);

  // A rodada nova aparece antes de a gravação acabar; recarregar no meio perde a rodada.
  await saveSettled(page);
  await page.reload();
  await continueCareer(page);
  expect(await nextRound(page)).toBe(before + 1);
});
