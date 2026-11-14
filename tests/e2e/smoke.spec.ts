import {
  closeSummary,
  continueCareer,
  nextRound,
  roundHeading,
  saveSettled,
  startCareer,
} from './career.ts';
import { expect, playButton, test } from './fixtures.ts';

test('cria uma carreira, joga uma rodada, reabre a página e vê a carreira', async ({ page }) => {
  await startCareer(page);
  const before = await nextRound(page);

  await playButton(page).click();
  // O resumo da rodada só abre com a gravação terminada (T-030).
  await expect(roundHeading(page)).toBeVisible();

  // Sem aviso de falha de gravação.
  await expect(page.getByRole('alert')).toHaveCount(0);

  await closeSummary(page);
  await expect.poll(() => nextRound(page)).toBe(before + 1);
  await saveSettled(page);
  await page.reload();
  await continueCareer(page);
  expect(await nextRound(page)).toBe(before + 1);
});
