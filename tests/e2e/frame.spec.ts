import type { Page } from '@playwright/test';
import { startCareer } from './career.ts';
import { expect, playButton, test } from './fixtures.ts';

/*
 * Moldura da carreira (docs/design/telas/navegacao.md): o que é CSS e comportamento de navegador
 * e por isso não cabe no Vitest (observações da QA da T-023).
 */

const SIDE_FROM = 900;

/** Elementos interativos visíveis da página. */
async function touchTargets(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
    };
    return (
      Array.from(document.querySelectorAll('a[href], button, [role="button"], input, select'))
        .filter(visible)
        // O link "pular para o conteúdo" só aparece com foco do teclado.
        .filter((el) => !el.classList.contains('skip'))
        .map((el) => {
          const box = el.getBoundingClientRect();
          return {
            name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
            width: Math.round(box.width),
            height: Math.round(box.height),
          };
        })
    );
  });
}

test.describe('moldura da carreira', () => {
  test.beforeEach(async ({ page }) => {
    await startCareer(page);
  });

  test('só um "Jogar rodada" visível e anunciado, o da barra ou o da lateral conforme a largura', async ({
    page,
  }) => {
    const width = page.viewportSize()!.width;
    // Os dois estão no HTML; o CSS esconde um (fora da árvore de acessibilidade).
    await expect(playButton(page)).toHaveCount(1);
    await expect(playButton(page)).toBeVisible();
    const inSide = await playButton(page).evaluate((el) => el.closest('aside') !== null);
    expect(inSide).toBe(width >= SIDE_FROM);
    // A navegação principal também aparece uma vez só.
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(1);
  });

  test('alvos de toque de pelo menos 44px nos elementos interativos', async ({ page }) => {
    const small = (await touchTargets(page)).filter((t) => t.width < 44 || t.height < 44);
    expect(small, 'alvos menores que 44px').toEqual([]);
  });

  test('sem rolagem horizontal em 360px', async ({ page }) => {
    test.skip(page.viewportSize()!.width >= SIDE_FROM, 'o celular estreito é o caso do teste');
    await page.setViewportSize({ width: 360, height: 740 });
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
  });

  test('o breakpoint de 900px troca a barra pela lateral', async ({ page }) => {
    test.skip(page.viewportSize()!.width >= SIDE_FROM, 'a troca parte do celular');
    await page.setViewportSize({ width: SIDE_FROM - 1, height: 800 });
    expect(await playButton(page).evaluate((el) => el.closest('aside') !== null)).toBe(false);
    await page.setViewportSize({ width: SIDE_FROM, height: 800 });
    expect(await playButton(page).evaluate((el) => el.closest('aside') !== null)).toBe(true);
    await expect(playButton(page)).toHaveCount(1);
  });

  test('prefers-reduced-motion: nenhuma animação nem transição', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    );
    expect(running).toBe(0);
    const animated = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('*'))
          .map((el) => getComputedStyle(el))
          .filter(
            (s) =>
              s.animationName !== 'none' ||
              s.transitionDuration.split(',').some((d) => parseFloat(d) > 0),
          ).length,
    );
    expect(animated).toBe(0);
  });
});
