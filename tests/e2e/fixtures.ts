import { expect, test as base, type Page } from '@playwright/test';

/*
 * Fixtures dos specs. `test` é o do Playwright com uma trava de rede: qualquer requisição que
 * saia da origem do servidor de teste é abortada e reprova o teste no fim (nada sai do aparelho;
 * docs/03-test-plan.md, 3, item 4; P-15).
 */
export const test = base.extend<{ blocked: string[] }>({
  blocked: [
    async ({ context, baseURL }, use) => {
      const origin = new URL(baseURL ?? 'http://127.0.0.1').origin;
      const blocked: string[] = [];
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (new URL(url).origin === origin) return route.fallback();
        blocked.push(url);
        return route.abort('blockedbyclient');
      });
      await use(blocked);
      expect(blocked, 'requisições para fora da origem').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** O botão primário da moldura. Só um é visível (e anunciado) por largura. */
export const playButton = (page: Page) => page.getByRole('button', { name: 'Jogar rodada' });
