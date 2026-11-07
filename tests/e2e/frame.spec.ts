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
    const targets = await touchTargets(page);
    // Controle: a lista não pode estar vazia nem sem o botão principal.
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.map((t) => t.name)).toContain('Jogar rodada');
    const small = targets.filter((t) => t.width < 44 || t.height < 44);
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

  test('prefers-reduced-motion: a regra do app.css desliga animação e transição', async ({
    page,
  }) => {
    // Elemento de prova injetado, sem regra própria: só a regra global do app.css o afeta.
    await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.id = 'motion-probe';
      probe.style.cssText =
        'animation: probe-spin 1s linear infinite; transition: opacity 1s; width: 10px; height: 10px';
      const style = document.createElement('style');
      style.textContent = '@keyframes probe-spin { to { opacity: 0.5 } }';
      document.head.append(style);
      document.body.append(probe);
    });
    const read = () =>
      page.locator('#motion-probe').evaluate((el) => {
        const s = getComputedStyle(el);
        return { animation: s.animationName, transition: s.transitionDuration };
      });

    // Controle: sem a preferência, o elemento anima (senão o teste não prova nada).
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    expect(await read()).toEqual({ animation: 'probe-spin', transition: '1s' });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await read()).toEqual({ animation: 'none', transition: '0s' });
  });
});
