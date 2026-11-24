import type { Locator, Page } from '@playwright/test';
import { setTheme, tokenColor } from './css.ts';
import { closeSummary, reopenIn, roundHeading, startCareer } from './career.ts';
import { expect, test } from './fixtures.ts';
import {
  careerWith,
  control,
  freezeClock,
  matchScreen,
  onPhone,
  openMatch,
  playToEnd,
  runUntil,
  ui,
  type Lang,
} from './match-helpers.ts';
import { readSave, type SaveJson } from './save.ts';

/*
 * De qual time é cada lance (docs/design/telas/partida.md, "Proposta para o CEO: de qual time é
 * cada lance", opção A, e "Medidas para o E2E"): na narração e na súmula, o escudo `xs` de 24px,
 * decorativo, logo depois do minuto, do clube certo; as fases sem escudo; a frase escondida com o
 * clube logo depois do minuto; a altura da linha igual (o escudo e o ícone não a aumentam); nenhum
 * `id` repetido; sem rolagem lateral a 360 em pt-BR, es e en com "Inter-Regional".
 */

/** O que a página diz de cada linha de lance (narração ou súmula). */
interface LineFacts {
  /** `data-line` (narração) ou a posição (súmula). */
  key: string;
  phase: boolean;
  club: string | null;
  kind: string;
  hidden: string;
  crests: number;
  crestHidden: string | null;
  crestWidth: number;
  crestHtml: string;
  crestLeft: number;
  minuteRight: number;
  textLeft: number;
  textWidth: number;
  rowHeight: number;
  padding: number;
  whatHeight: number;
  mainHeight: number;
  lineHeight: number;
}

async function factsOf(rows: Locator): Promise<LineFacts[]> {
  return rows.evaluateAll((lis) =>
    lis.map((li, i) => {
      const box = (el: Element | null) => el?.getBoundingClientRect();
      const style = getComputedStyle(li);
      const what = li.querySelector('.what')!;
      const main = li.querySelector('.main')!;
      const crest = li.querySelector('.crest-slot .crest');
      return {
        key: li.getAttribute('data-line') ?? String(i),
        phase: li.classList.contains('phase'),
        club: li.querySelector('.club')?.textContent?.trim() ?? null,
        kind: li.querySelector('.kind')?.textContent?.trim() ?? '',
        hidden: li.querySelector(':scope > .visually-hidden')?.textContent ?? '',
        crests: li.querySelectorAll('.crest').length,
        crestHidden: crest?.getAttribute('aria-hidden') ?? null,
        crestWidth: box(crest)?.width ?? 0,
        crestHtml: crest?.innerHTML ?? '',
        crestLeft: box(crest)?.left ?? 0,
        minuteRight: box(li.querySelector('.minute'))!.right,
        textLeft: box(what)!.left,
        textWidth: box(what)!.width,
        rowHeight: box(li)!.height,
        padding: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
        whatHeight: box(what)!.height,
        mainHeight: box(main)!.height,
        lineHeight: parseFloat(getComputedStyle(li.querySelector('.kind')!).lineHeight),
      };
    }),
  );
}

/** A frase escondida começa pelo minuto, depois o clube, depois o tipo (medida 2). */
const spokenOrder = (f: LineFacts) =>
  f.club === null
    ? f.hidden.includes(`, ${f.kind}`) || f.hidden.endsWith(f.kind)
    : f.hidden.split(', ')[1] === f.club &&
      f.hidden.indexOf(`, ${f.club}, ${f.kind}`) > 0 &&
      f.hidden.indexOf(f.club) < f.hidden.indexOf(f.kind);

/**
 * Confere as linhas: o escudo do clube de cada linha com clube (o mesmo SVG do gerador, no
 * tamanho de 24px), nenhum nas outras; fora da frase, a coluna depois do minuto; a altura da
 * linha é a do texto mais o respiro, e o ícone não faz a primeira linha crescer.
 */
async function expectLines(
  page: Page,
  rows: Locator,
  save: SaveJson,
  instanceOf: (f: LineFacts) => string,
  label: string,
  singleHeight: number,
): Promise<LineFacts[]> {
  const facts = await factsOf(rows);
  expect(facts.length, `${label}: lines`).toBeGreaterThan(3);
  // Short name -> club id: the generator puts the id of the club in the ids of its SVG.
  const idOf = new Map<string, string>(
    Object.entries(
      save.game.clubs as unknown as Record<string, { def: { shortName: string } }>,
    ).map(([id, c]) => [c.def.shortName, id]),
  );
  // The same club draws the same crest (the ids of the SVG carry the line, so they are removed).
  const shapeOf = (f: LineFacts) =>
    f.crestHtml.replace(new RegExp(`-${instanceOf(f)}\\b`, 'g'), '-X');
  const byClub = new Map<string, string>();
  for (const f of facts) {
    const where = `${label} ${f.key} "${f.kind}"`;
    if (f.phase) {
      expect(f.crests, `${where}: no crest on a phase`).toBe(0);
    } else if (f.club === null) {
      // The change of tactics names the club in its text, so it has no club line, but a crest.
      expect(f.crests, `${where}: crest on the tactic line`).toBe(1);
      expect(f.crestHidden, `${where}: decorative`).toBe('true');
    } else {
      expect(f.crests, `${where}: one crest`).toBe(1);
      expect(f.crestHidden, `${where}: decorative`).toBe('true');
      expect(Math.round(f.crestWidth), `${where}: 24px`).toBe(24);
      expect(f.crestHtml, `${where}: the crest of ${f.club}`).toContain(
        `id="sh-${idOf.get(f.club)!}-s-${instanceOf(f)}`,
      );
      expect(f.crestHtml, `${where}: the id carries the line`).toContain(instanceOf(f));
      const shape = shapeOf(f);
      expect(byClub.get(f.club) ?? shape, `${where}: the same crest for ${f.club}`).toBe(shape);
      byClub.set(f.club, shape);
      expect(f.crestLeft, `${where}: after the minute`).toBeGreaterThanOrEqual(f.minuteRight);
      expect(f.textLeft, `${where}: text after the crest`).toBeGreaterThanOrEqual(
        f.crestLeft + 24 - 0.5,
      );
    }
    expect(spokenOrder(f), `${where}: spoken "${f.hidden}"`).toBe(true);
    expect(f.hidden.startsWith('minuto') || f.hidden.startsWith('minute'), where).toBe(true);
    // The row is its text plus the padding: neither the crest nor the icon makes it taller.
    expect(
      Math.abs(f.rowHeight - f.padding - f.whatHeight),
      `${where}: row height ${f.rowHeight} what ${f.whatHeight}`,
    ).toBeLessThan(1.5);
    // The icon never makes the first line taller: the text is a whole number of lines.
    const lines = f.mainHeight / f.lineHeight;
    expect(
      Math.abs(f.mainHeight - Math.round(lines) * f.lineHeight),
      `${where}: icon keeps the line (${f.mainHeight} of ${f.lineHeight})`,
    ).toBeLessThanOrEqual(0.5);
    // A line of one line of text with the club below is exactly 54px (38px of text and 16 of padding).
    if (f.club !== null && f.whatHeight <= 40) {
      expect(
        Math.abs(f.rowHeight - singleHeight),
        `${where}: row ${f.rowHeight}`,
      ).toBeLessThanOrEqual(0.5);
    }
  }
  const shapes = [...byClub.values()];
  expect(new Set(shapes).size, `${label}: two clubs, two crests`).toBe(shapes.length);
  return facts;
}

const noRepeatedIds = (page: Page) =>
  page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll('[id]')) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** The width of `main.match` minus the width of `.pitch-box` (0 once the pitch measure arrived). */
const pitchGap = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelector('main.match')!.getBoundingClientRect().width -
      (document.querySelector('.pitch-box')?.getBoundingClientRect().width ?? 0),
  );

test.describe('De qual time é cada lance', () => {
  test('narração: o escudo do clube certo em cada lance de time, nenhum nas fases; frase com o clube depois do minuto; altura igual', async ({
    page,
  }) => {
    await page.clock.install();
    if (onPhone(page)) await page.setViewportSize({ width: 360, height: 740 });
    const { save } = await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await playToEnd(page);
    const rows = matchScreen(page).locator('section.feed li.line');
    const facts = await expectLines(page, rows, save, (f) => f.key, 'narration', 54);
    expect(
      facts.some((f) => f.club === null),
      'has phase lines',
    ).toBe(true);
    expect(
      facts.some((f) => f.club !== null && f.kind !== ''),
      'has club lines',
    ).toBe(true);
    // Both clubs appear (a whole match).
    expect(new Set(facts.map((f) => f.club).filter((c) => c !== null)).size).toBe(2);
    if (onPhone(page)) {
      for (const f of facts) {
        expect(Math.round(f.textWidth), `${f.key}: text width`).toBe(244);
      }
    }
    expect(await noRepeatedIds(page), 'no repeated id').toEqual([]);
  });

  test('narração a 360×740 com campo: o escudo não muda a altura da linha (54px de uma linha de texto com o clube)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await page.clock.install();
    await page.setViewportSize({ width: 360, height: 740 });
    await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await playToEnd(page);
    const facts = await factsOf(matchScreen(page).locator('section.feed li.line'));
    // A line of a single line of text and the club below: 2 x 8 of padding and 38 of text.
    const singles = facts.filter((f) => f.club !== null && f.whatHeight <= 40);
    expect(singles.length).toBeGreaterThan(0);
    for (const f of singles) expect(Math.abs(f.rowHeight - 54), f.key).toBeLessThanOrEqual(0.5);
  });

  for (const lang of ['pt-BR', 'es', 'en'] as const) {
    test(`sem rolagem lateral em 360, 390, 844 e 1280 com a partida, em ${lang}, com "Inter-Regional"`, async ({
      page,
    }) => {
      test.skip(!onPhone(page), 'uma vez por navegador');
      await page.clock.install();
      await careerWith(page, 'full', undefined, 'Inter-Regional');
      if (lang !== 'pt-BR') {
        await page.clock.resume();
        await reopenIn(page, lang);
      }
      await freezeClock(page);
      await openMatch(page, lang);
      await runUntil(
        page,
        async () => (await matchScreen(page).locator('section.feed li.line').count()) > 6,
        { step: 500 },
      );
      for (const [width, height] of [
        [360, 740],
        [390, 844],
        [844, 390],
        [1280, 800],
      ] as const) {
        await page.setViewportSize({ width, height });
        // The measure of the pitch arrives in a real task (MessageChannel and ResizeObserver), outside the
        // fake clock: poll in real time (with a ceiling), moving the fake clock a little on each turn.
        // In the single column (portrait: 360 and 390) the pitch is as wide as the match column.
        await expect
          .poll(
            async () => {
              await page.clock.runFor(100);
              return {
                over: Math.max(0, await sideScroll(page)),
                gap: width < height ? await pitchGap(page) : 0,
              };
            },
            {
              message: `${lang} ${width}: no side scroll and pitch-box vs main.match`,
              timeout: 15_000,
            },
          )
          .toEqual({ over: 0, gap: 0 });
      }
      await control(page, 'match.skip', lang).click();
      await runUntil(page, async () => (await roundHeading(page).count()) === 1);
      await page.clock.resume();
      await closeSummary(page, ui(lang as Lang, 'round.continue'));
    });
  }

  test('o fundo do gol é grass-soft nos dois lados e nos dois temas; as outras linhas sem fundo (o escudo não pinta nada)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await page.clock.install();
    await page.setViewportSize({ width: 360, height: 740 });
    await careerWith(page, 'full');
    await freezeClock(page);
    await openMatch(page);
    await playToEnd(page);
    const rows = matchScreen(page).locator('section.feed li.line');
    for (const theme of ['noite', 'dia'] as const) {
      await setTheme(page, theme);
      const soft = await tokenColor(page, 'grass-soft');
      const colors = await rows.evaluateAll((lis) =>
        lis.map((li) => ({
          goal: li.classList.contains('goal'),
          club: li.querySelector('.club')?.textContent?.trim() ?? '',
          bg: getComputedStyle(li).backgroundColor,
        })),
      );
      const goals = colors.filter((c) => c.goal);
      expect(goals.length, `${theme}: has a goal`).toBeGreaterThan(0);
      for (const g of goals) expect(g.bg, `${theme}: goal of ${g.club}`).toBe(soft);
      for (const c of colors.filter((x) => !x.goal)) {
        expect(c.bg, `${theme}: not a goal`).not.toBe(soft);
      }
    }
  });

  test('súmula: a mesma linha, escudo do clube certo, frase com o clube depois do minuto, sem id repetido', async ({
    page,
  }) => {
    if (onPhone(page)) await page.setViewportSize({ width: 360, height: 740 });
    await startCareer(page);
    await page.getByRole('button', { name: ui('pt-BR', 'play.label') }).click();
    await expect(roundHeading(page)).toBeVisible();
    const save = await readSave(page);
    await page
      .locator('main.round')
      .getByRole('button', { name: ui('pt-BR', 'round.sheet.open'), exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: ui('pt-BR', 'report.title') });
    await expect(dialog).toBeVisible();
    const rows = dialog.locator('li.line');
    const facts = await expectLines(page, rows, save, (f) => `tl${f.key}`, 'report', 38);
    expect(facts.every((f) => f.club !== null && f.crests === 1)).toBe(true);
    if (onPhone(page)) {
      for (const f of facts) expect(Math.round(f.textWidth), f.key).toBe(244);
    }
    expect(await noRepeatedIds(page), 'no repeated id').toEqual([]);
  });

  test('súmula a 360×740 em es e en, com "Inter-Regional": sem rolagem lateral', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await page.setViewportSize({ width: 360, height: 740 });
    await startCareer(page, { club: 'Inter-Regional' });
    for (const lang of ['es', 'en'] as const) {
      await reopenIn(page, lang);
      await page.getByRole('button', { name: ui(lang, 'play.label') }).click();
      await expect(roundHeading(page)).toBeVisible();
      await page
        .locator('main.round')
        .getByRole('button', { name: ui(lang, 'round.sheet.open'), exact: true })
        .click();
      const dialog = page.getByRole('dialog', { name: ui(lang, 'report.title') });
      await expect(dialog).toBeVisible();
      const scroll = await dialog.evaluate((root) => ({
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        sheet: root.scrollWidth - root.clientWidth,
        body: root.querySelector('.body')!.scrollWidth - root.querySelector('.body')!.clientWidth,
      }));
      expect(scroll.page, `${lang} page`).toBeLessThanOrEqual(0);
      expect(scroll.sheet, `${lang} sheet`).toBeLessThanOrEqual(0);
      expect(scroll.body, `${lang} body`).toBeLessThanOrEqual(0);
      await dialog.getByRole('button', { name: ui(lang, 'nav.close') }).click();
      await closeSummary(page, ui(lang, 'round.continue'));
    }
  });
});
