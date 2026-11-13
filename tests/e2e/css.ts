import type { Page } from '@playwright/test';

/*
 * Leituras de CSS que os specs dividem: o tema e a cor computada de um token do design system.
 */

/** Troca o tema da página ("noite" ou "dia"), como a preferência faz. */
export async function setTheme(page: Page, theme: 'noite' | 'dia'): Promise<void> {
  await page.evaluate((name) => (document.documentElement.dataset.theme = name), theme);
}

/** A cor computada de um token no tema atual (resolvida por um elemento de prova). */
export async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(--${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}
