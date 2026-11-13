import type { Locator, Page } from '@playwright/test';
import {
  FORMATIONS,
  FORMATION_SLOTS,
  effectiveRating,
  fitLevel,
  isAvailable,
  sheetStrength,
  type GameState,
  type Player,
  type Position,
} from '../../app/src/engine/index.ts';
import { continueIn, reopenIn, startCareer } from './career.ts';
import { setTheme, tokenColor } from './css.ts';
import { expect, playButton, test } from './fixtures.ts';
import {
  SIDE_FROM,
  main,
  noPageScroll,
  openLineup,
  pitch,
  sizesOf,
  squadOf,
  withFixture,
  withSecondaryFixture,
} from './lineup-fixture.ts';
import {
  changePlayer,
  patchSave,
  readDraft,
  readSave,
  type DraftJson,
  type SaveJson,
} from './save.ts';

/*
 * Escalação (T-029; US-017): as "Medidas para o E2E" de docs/design/telas/escalacao.md, o que é
 * toque, arrasto, teclado, foco, CSS, histórico e gravação de verdade. Os textos por idioma e os
 * estados da tela estão no Vitest (app/src/ui/lineup-screens.test.ts).
 *
 * A fixture do Completo está em lineup-fixture.ts (a mesma da Tática).
 */

const slot = (page: Page, index: number) => main(page).locator(`[data-slot="${index}"]`);
const place = (page: Page, key: string) => main(page).locator(`[data-place="${key}"]`);
const bar = (page: Page) => main(page).locator('.bar-slot > [role="status"]');
const numbers = (page: Page) => main(page).locator('section.strength dd.value .numero');

/** The 18 places as the screen shows them: each slot's name and each bench place's name. */
async function places(page: Page): Promise<string[]> {
  return main(page)
    .locator('[data-slot], [data-place^="bench-"]')
    .evaluateAll((els) =>
      els.map(
        (el) =>
          `${(el as HTMLElement).dataset.slot ?? (el as HTMLElement).dataset.place}=${el.getAttribute('aria-label')}`,
      ),
    );
}

/** The short code of each position in pt-BR, as the tags write it. */
const SHORT: Readonly<Record<Position, string>> = {
  GK: 'GOL',
  CB: 'ZAG',
  FB: 'LAT',
  DM: 'VOL',
  AM: 'MEI',
  ST: 'ATA',
};

/** The position of each slot of the pitch, in slot order, from its accessible name. */
async function slotPositions(page: Page): Promise<string[]> {
  const labels = await pitch(page)
    .locator('button[data-slot]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  return labels.map((label) => label.split(':')[0]!);
}

/** The four numbers of the strength strip (Força, Defesa, Meio, Ataque). */
async function shown(page: Page): Promise<number[]> {
  return (await numbers(page).allInnerTexts()).map(Number);
}

/** The draft stored once it has `starter` in `index`, and the screen's numbers against it. */
async function expectStored(page: Page, check: (draft: DraftJson) => boolean): Promise<DraftJson> {
  await expect
    .poll(async () => {
      const draft = await readDraft(page);
      return draft !== undefined && check(draft);
    })
    .toBe(true);
  return (await readDraft(page))!;
}

/** The strength the engine reads for `draft`, rounded as the screen shows it. */
async function engineStrength(page: Page, draft: DraftJson): Promise<number[]> {
  const save = await readSave(page);
  const strength = sheetStrength(
    save.game as unknown as GameState,
    save.career.clubId,
    draft.lineup as never,
  )!;
  return [strength.overall, strength.def, strength.mid, strength.atk].map(Math.round);
}

/** Item 4: the reserve in the slot, the starter on the bench, the numbers of the engine. */
async function expectSwapped(
  page: Page,
  reserve: Player,
  benchIndex: number,
  starter: Player,
  slotIndex: number,
): Promise<DraftJson> {
  await expect(slot(page, slotIndex)).toHaveAttribute('aria-label', new RegExp(reserve.name.full));
  await expect(place(page, `bench-${benchIndex}`)).toHaveAttribute(
    'aria-label',
    new RegExp(starter.name.full),
  );
  const draft = await expectStored(
    page,
    (d) => d.lineup.starters[slotIndex] === reserve.id && d.lineup.bench[benchIndex] === starter.id,
  );
  expect(await shown(page)).toEqual(await engineStrength(page, draft));
  return draft;
}

const box = async (locator: Locator) => (await locator.boundingBox())!;

/** Touch events through CDP (Chromium only), with the points in CSS pixels. */
async function touchScreen(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  return (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number }[]) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    });
}

test.describe('Escalação (escalacao.md; US-017)', () => {
  test('seletor de 44 px; o campo em 4-4-2 com 11 vagas na ordem do motor; sem entrada no histórico (medida 1)', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    const options = main(page).locator('fieldset').first().locator('label');
    await expect(options).toHaveCount(3);
    for (const option of await options.all()) {
      expect((await box(option)).height).toBeGreaterThanOrEqual(44);
    }
    await expect(pitch(page)).toHaveAccessibleName('Campo, formação 4-4-2');
    // The slots in the engine's order, read by the position of each slot (its accessible name).
    expect(await slotPositions(page)).toEqual([
      'Goleiro',
      'Zagueiro',
      'Zagueiro',
      'Lateral',
      'Lateral',
      'Volante',
      'Volante',
      'Meia',
      'Meia',
      'Atacante',
      'Atacante',
    ]);
    // The tag of each chip is the player's natural position, painted by his sector (escalacao.md,
    // "Cor de setor no LineupChip"): the centre-back on the striker's slot keeps ZAG, in blue.
    const codes = await pitch(page).locator('button[data-slot] .code').allInnerTexts();
    expect(codes.map((c) => c.trim())).toEqual(fixture.starters.map((p) => SHORT[p.position]));
    const tag = slot(page, 9).locator('.code .tag');
    await expect(tag).toHaveText('ZAG');
    await expect(tag).toHaveClass(/\bsector-def\b/);
    // Changing the view adds no entry to the history; the view is kept while the career is open.
    const length = await page.evaluate(() => history.length);
    await main(page).locator('fieldset label', { hasText: 'Tática' }).click();
    await main(page).locator('fieldset label', { hasText: 'Escalação' }).click();
    expect(await page.evaluate(() => history.length)).toBe(length);
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Clube' })
      .click();
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Elenco' })
      .click();
    await expect(pitch(page)).toBeVisible();
  });

  test('alvos: vagas de 44 px sem sobreposição nas 6 formações, linhas e ações da barra; sem rolagem lateral (medidas 2 e 3)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const fixture = await withFixture(page);
    for (const formation of FORMATIONS) {
      if (formation !== '4-4-2') {
        await patchSave(page, (save) => {
          (save.career as Record<string, unknown>).draft = {
            ...fixture.draft,
            lineup: { ...fixture.draft.lineup, formation },
          };
        });
        await openLineup(page);
      }
      await expect(pitch(page)).toHaveAccessibleName(`Campo, formação ${formation}`);
      for (const size of sizesOf(page)) {
        await page.setViewportSize(size);
        await noPageScroll(page);
        const boxes = await pitch(page)
          .locator('button[data-slot]')
          .evaluateAll((els) =>
            els.map((el) => {
              const r = el.getBoundingClientRect();
              return { x: r.x, y: r.y, w: r.width, h: r.height };
            }),
          );
        expect(boxes).toHaveLength(11);
        // The sector tag, the "C" and the overall fit the top line, and the chip its content.
        const spill = await pitch(page)
          .locator('button[data-slot]')
          .evaluateAll((els) =>
            els.flatMap((el, i) => {
              const top = el.querySelector('.top')!;
              const wide = top.scrollWidth > top.clientWidth + 1;
              const tall = el.scrollHeight > el.clientHeight + 1;
              return wide || tall ? [`vaga ${i}${wide ? ' larga' : ''}${tall ? ' alta' : ''}`] : [];
            }),
          );
        expect(spill, `${formation} ${size.width}`).toEqual([]);
        for (const [i, b] of boxes.entries()) {
          // escalacao.md, "Ao alcance do polegar": each slot at least 75 × 52px.
          expect(b.w, `${formation} ${size.width}: vaga ${i}`).toBeGreaterThanOrEqual(75);
          expect(b.h, `${formation} ${size.width}: vaga ${i}`).toBeGreaterThanOrEqual(52);
          for (const [j, o] of boxes.entries()) {
            if (j <= i) continue;
            const apart =
              b.x + b.w <= o.x + 0.5 ||
              o.x + o.w <= b.x + 0.5 ||
              b.y + b.h <= o.y + 0.5 ||
              o.y + o.h <= b.y + 0.5;
            expect(apart, `${formation} ${size.width}: vagas ${i} e ${j} se sobrepõem`).toBe(true);
          }
        }
        if (formation === '4-4-2') {
          const rows = await main(page)
            .locator('[data-place]')
            .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
          expect(rows.length).toBe(16); // 7 bench places, "Deixar de fora" and 8 left out
          for (const h of rows) expect(h).toBeGreaterThanOrEqual(44);
          // The bar's actions (with a player picked).
          await place(page, 'bench-0').click();
          for (const action of await bar(page).locator('button').all()) {
            const b = await box(action);
            expect(b.width).toBeGreaterThanOrEqual(44);
            expect(b.height).toBeGreaterThanOrEqual(44);
          }
          await page.keyboard.press('Escape');
          await expect(place(page, 'bench-0')).toHaveAttribute('aria-pressed', 'false');
        }
      }
    }
  });

  test('dois toques: reserva e titular trocam; a força é a leitura do motor da ficha nova (medida 4)', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    const reserve = fixture.bench[4]!; // ST
    const starter = fixture.starters[10]!; // ST
    await place(page, 'bench-4').click();
    await expect(place(page, 'bench-4')).toHaveAttribute('aria-pressed', 'true');
    await expect(bar(page)).toContainText(`${reserve.name.full} selecionado`);
    await slot(page, 10).click();
    await expect(place(page, 'bench-4')).toHaveAttribute('aria-pressed', 'false');
    await expectSwapped(page, reserve, 4, starter, 10);
    await expect(bar(page)).toContainText(`${reserve.name.full} e ${starter.name.full} trocaram`);
    // The focus stays where the player arrived (the second tap).
    await expect(slot(page, 10)).toBeFocused();
  });

  test('teclado: Enter no reserva e Enter na vaga dão a mesma escalação; Esc desfaz a seleção (medida 5)', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    const before = await places(page);
    await place(page, 'bench-4').focus();
    await page.keyboard.press('Enter');
    await expect(place(page, 'bench-4')).toHaveAttribute('aria-pressed', 'true');
    // While picked, every place points to the hint of the bar.
    const hint = await slot(page, 0).getAttribute('aria-describedby');
    expect(hint).toBeTruthy();
    await expect(page.locator(`[id="${hint}"]`)).toHaveText('Selecione outro lugar para trocar.');
    await page.keyboard.press('Escape');
    await expect(place(page, 'bench-4')).toHaveAttribute('aria-pressed', 'false');
    expect(await places(page)).toEqual(before);

    await place(page, 'bench-4').focus();
    await page.keyboard.press('Enter');
    // Tab from the picked reserve walks the places; Shift+Tab back to the pitch is long, so
    // the slot gets the focus directly, as a screen reader's jump would.
    await slot(page, 10).focus();
    await page.keyboard.press('Enter');
    await expectSwapped(page, fixture.bench[4]!, 4, fixture.starters[10]!, 10);
  });

  test('arrastar: mouse no desktop, segurar 400 ms no toque; deslizar sem segurar rola a página (medida 6)', async ({
    page,
    browserName,
  }) => {
    const mobile = page.viewportSize()!.width < SIDE_FROM;
    // The touch branch drives real touch events through CDP, which only Chromium has; the
    // measure 6 of escalacao.md asks the hold on the "Chromium celular" only. The mouse branch
    // runs on every desktop project.
    test.skip(
      mobile && browserName !== 'chromium',
      'toque segurado e deslizado só pelo CDP (Chromium)',
    );
    const fixture = await withFixture(page);
    if (!mobile) {
      const from = await box(place(page, 'bench-4'));
      const to = await box(slot(page, 10));
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
      // The target shows the swap mark while hovered.
      await expect(slot(page, 10)).toHaveClass(/target/);
      await page.mouse.up();
      await expectSwapped(page, fixture.bench[4]!, 4, fixture.starters[10]!, 10);
      return;
    }
    // Phone: the goalkeeper's slot and the first reserve (GOL) in the window, above the dock.
    const touch = await touchScreen(page);
    await slot(page, 0).scrollIntoViewIfNeeded();
    const gk = await box(slot(page, 0));
    await page.evaluate((y) => window.scrollBy(0, y - 120), gk.y);
    const from = await box(place(page, 'bench-0'));
    const to = await box(slot(page, 0));
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };

    // A swipe on the reserve without holding scrolls the page and changes nothing.
    const before = await places(page);
    const scrollY = await page.evaluate(() => window.scrollY);
    await touch('touchStart', [start]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: start.x, y: start.y - i * 15 }]);
    await touch('touchEnd', []);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollY);
    await page.waitForTimeout(400);
    expect(await places(page)).toEqual(before);
    await expect(place(page, 'bench-0')).toHaveAttribute('aria-pressed', 'false');
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);

    // Hold 400 ms, then move to the slot and lift.
    await touch('touchStart', [start]);
    await page.waitForTimeout(400);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      await touch('touchMove', [
        {
          x: start.x + ((end.x - start.x) * i) / steps,
          y: start.y + ((end.y - start.y) * i) / steps,
        },
      ]);
    }
    await expect(slot(page, 0)).toHaveClass(/target/);
    await touch('touchEnd', []);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    await expectSwapped(page, fixture.bench[0]!, 0, fixture.starters[0]!, 0);
  });

  test('arrastar outro jogador desfaz a seleção, e soltar fora deixa a barra limpa', async ({
    page,
  }) => {
    await withFixture(page);
    const before = await places(page);
    await place(page, 'bench-0').click();
    await expect(bar(page)).toContainText('selecionado');
    // A mouse drag of another reserve, dropped on the strength strip (no place there).
    const from = await box(place(page, 'bench-4'));
    const outside = await box(main(page).locator('section.strength'));
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 - 20, {
      steps: 4,
    });
    await expect(place(page, 'bench-0')).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.move(outside.x + outside.width / 2, outside.y + outside.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(bar(page)).toHaveText('');
    await expect(bar(page)).toHaveClass(/hidden/);
    expect(await places(page)).toEqual(before);
    await expect(main(page).locator('[aria-pressed="true"]')).toHaveCount(0);
  });

  test('o voltar do navegador fecha o card aberto na Escalação e fica na Escalação', async ({
    page,
  }) => {
    await withFixture(page);
    await slot(page, 3).click();
    await bar(page).getByRole('button', { name: 'Ver card' }).click();
    const card = page.getByRole('dialog');
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Próximo' }).click();
    await page.goBack();
    await expect(card).toBeHidden();
    await expect(page).toHaveURL(/#\/squad$/);
    await expect(pitch(page)).toBeVisible();
    expect(await page.evaluate(() => history.state?.sheet)).toBeUndefined();
  });

  test('fora de posição: ícone e texto na vaga; o aviso diz "(ZAG) jogando de ATA" (medida 7)', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    expect(fitLevel(fixture.misplaced, FORMATION_SLOTS['4-4-2'][9]!)).toBe('outOfPosition');
    const mark = slot(page, 9).locator('.mark');
    await expect(mark).toHaveText('Fora de posição');
    await expect(mark.locator('svg')).toHaveCount(1);
    await expect(slot(page, 9)).toHaveAttribute('aria-label', /fora de posição/);
    await expect(slot(page, 6).locator('.mark')).toHaveText('Improvisado');
    const issues = main(page).locator('section.issues');
    await expect(issues).toContainText(`${fixture.misplaced.name.full} (ZAG) jogando de ATA`);
  });

  test('recusa: lesionado e suspenso não entram no campo nem no banco (medida 8)', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    const before = await places(page);
    const rowOf = (player: Player) =>
      main(page).locator('li', {
        has: page.getByRole('button', { name: new RegExp(`^${player.name.full},`) }),
      });
    for (const [player, words, short] of [
      [
        fixture.injured,
        'está lesionado e não pode ser escalado',
        'Lesionado: não pode ser escalado.',
      ],
      [
        fixture.suspended,
        'está suspenso e não pode ser escalado',
        'Suspenso: não pode ser escalado.',
      ],
    ] as const) {
      for (const target of [slot(page, 5), place(page, 'bench-1')]) {
        await rowOf(player).getByRole('button').click();
        await target.click();
        await expect(bar(page)).toContainText(`${player.name.full} ${words}`);
        await expect(rowOf(player).locator('.message')).toHaveText(short);
        await expect(target).toBeFocused();
        expect(await places(page)).toEqual(before);
      }
    }
    expect(await readDraft(page)).toBeUndefined();
  });

  test('incompleta: vaga livre e Banner; "Jogar rodada" abre a folha; "Completar e jogar" joga com 11 aptos (medida 9)', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    await slot(page, 1).click();
    await place(page, 'out-free').click();
    await expect(slot(page, 1)).toContainText('Vaga livre');
    await expect(main(page).locator('.banner.warning')).toContainText('Falta 1 titular.');
    await expect(main(page).locator('section.issues')).toContainText('Vaga de ZAG sem jogador');
    await expect(bar(page)).toContainText(
      `${fixture.starters[1]!.name.full} foi para os não relacionados.`,
    );
    await expect(playButton(page)).toContainText('Escalação incompleta');

    await playButton(page).click();
    const sheet = page.getByRole('dialog', { name: 'Escalação incompleta' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Vaga de ZAG sem jogador');
    await sheet.getByRole('button', { name: 'Completar e jogar' }).click();
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await readSave(page)).game.round).toBe(2);
    const save = await readSave(page);
    const draft = (save.career as Record<string, unknown>).draft as DraftJson;
    const starters = draft.lineup.starters.filter((id) => id !== null);
    expect(starters).toHaveLength(11);
    // The free slot got someone who could play; the injured and the suspended stayed out.
    expect(starters).not.toContain(fixture.injured.id);
    expect(starters).not.toContain(fixture.suspended.id);
    for (const id of starters) expect(save.game.squads[save.career.clubId]).toContain(id);
  });

  test('sugerir e desfazer: mantém a formação; "Desfazer" volta exatamente à anterior (medida 10)', async ({
    page,
  }) => {
    await withFixture(page);
    const before = await places(page);
    await main(page).getByRole('button', { name: 'Sugerir escalação' }).click();
    await expect(pitch(page)).toHaveAccessibleName('Campo, formação 4-4-2');
    await expect(bar(page)).toContainText('Escalação sugerida.');
    const undo = bar(page).getByRole('button', { name: 'Desfazer' });
    await expect(undo).toBeVisible();
    expect(await places(page)).not.toEqual(before);
    await undo.click();
    await expect(bar(page)).toContainText('A escalação anterior voltou.');
    expect(await places(page)).toEqual(before);
    await expect(bar(page).getByRole('button', { name: 'Desfazer' })).toHaveCount(0);
  });

  test('sugerir com desfalques (T-082): cada titular na posição natural; a vaga sem natural fica com o melhor que sobrou', async ({
    page,
  }) => {
    const fixture = await withFixture(page, (save) => {
      // Same condition and morale for the whole squad, so the value is overall x fit alone.
      for (const p of squadOf(save)) {
        changePlayer(save, p.id, { condition: 100, morale: 50 });
      }
      // Only one AM left available: the second AM slot has no natural.
      const ams = squadOf(save)
        .filter((p) => p.position === 'AM' && isAvailable(p))
        .sort((a, b) => b.overall - a.overall);
      expect(ams.length).toBeGreaterThanOrEqual(2);
      for (const am of ams.slice(1)) changePlayer(save, am.id, { injuryRounds: 2 });
    });
    // The fixture starts with a CB at striker and an AM at DM: the suggestion must move them.
    expect(fixture.misplaced.position).toBe('CB');
    await main(page).getByRole('button', { name: 'Sugerir escalação' }).click();
    await expect(bar(page)).toContainText('Escalação sugerida.');
    const draft = await expectStored(page, (d) =>
      d.lineup.starters.some((id, i) => id !== fixture.draft.lineup.starters[i]),
    );
    const save = await readSave(page);
    const squad = squadOf(save);
    const byId = new Map(squad.map((p) => [p.id, p]));
    const slots = FORMATION_SLOTS['4-4-2'];
    const starters = draft!.lineup.starters.map((id) => byId.get(id!)!);
    expect(new Set(starters.map((p) => p.id)).size).toBe(11);
    expect(starters.every(isAvailable)).toBe(true);

    const off = starters.filter((p, i) => p.position !== slots[i]);
    // AM is short by one: exactly one starter is off his natural position, and it is on an AM slot.
    expect(off).toHaveLength(1);
    const offIndex = starters.indexOf(off[0]!);
    expect(slots[offIndex]).toBe('AM');
    // Everyone else is natural, and no available natural of any other position was left out for it.
    for (const position of ['GK', 'CB', 'FB', 'DM', 'ST'] as const) {
      const needed = slots.filter((s) => s === position).length;
      const playing = starters.filter(
        (p, i) => p.position === position && slots[i] === position,
      ).length;
      const available = squad.filter((p) => p.position === position && isAvailable(p)).length;
      expect(playing, position).toBe(Math.min(needed, available));
    }
    // The vacancy got the best of those left (value: overall x fit x morale x condition, equal here).
    const rating = (p: Player) => effectiveRating(p, 'AM');
    const leftovers = squad.filter(
      (p) => isAvailable(p) && !starters.some((s) => s.id === p.id) && p.position !== 'GK',
    );
    for (const other of leftovers) {
      expect(rating(off[0]!)).toBeGreaterThanOrEqual(rating(other));
    }
    // And the screen shows it: each slot names the player stored for it.
    for (const [i, p] of starters.entries()) {
      await expect(slot(page, i)).toHaveAttribute('aria-label', new RegExp(p.name.full));
    }
  });

  test('recarregar a página mantém a ficha (medida 11)', async ({ page }) => {
    const fixture = await withFixture(page);
    await place(page, 'bench-4').click();
    await slot(page, 10).click();
    await expectSwapped(page, fixture.bench[4]!, 4, fixture.starters[10]!, 10);
    const after = await places(page);
    await page.reload();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(playButton(page)).toBeVisible();
    await openLineup(page);
    expect(await places(page)).toEqual(after);
  });

  test('movimento reduzido: a barra da força sem transição (medida 13)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await withFixture(page);
    const bars = main(page).locator('section.strength dd.bar span');
    await expect(bars).toHaveCount(4);
    for (const b of await bars.all()) {
      expect(await b.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
    }
  });

  test('capitão: a vaga tem o "C" e o nome acessível diz "capitão" (medida 14)', async ({
    page,
  }) => {
    await withFixture(page);
    const captain = pitch(page).locator('button[data-slot]', { has: page.locator('.captain') });
    await expect(captain).toHaveCount(1);
    await expect(captain.locator('.captain')).toHaveText('C');
    await expect(captain).toHaveAttribute('aria-label', /capitão/);
  });

  test('força: cansado avisado; tirar um titular não aumenta nenhum número; a explicação abre (medida 15)', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    await expect(main(page).locator('section.issues')).toContainText(
      `${fixture.tired.name.full} está cansado (condição 79)`,
    );
    const before = await shown(page);
    await slot(page, 7).click();
    await place(page, 'bench-6').click();
    await expect(slot(page, 7)).toContainText('Vaga livre');
    const after = await shown(page);
    after.forEach((n, i) => expect(n).toBeLessThanOrEqual(before[i]!));
    // The arrows compare the rounded numbers.
    await expect(main(page).locator('section.strength .delta').first()).toBeVisible();

    const details = main(page).locator('section.strength details');
    expect(await details.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    await details.locator('summary').click();
    expect(await details.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
    await expect(details.locator('p')).toContainText('cansaço');
  });

  test('toque duplo: "Completar e jogar" joga uma rodada só; o X do card fecha e fica na Escalação', async ({
    page,
  }) => {
    await withFixture(page);
    // The card: "Ver card" from the bar; two taps on the X in the same instant.
    await slot(page, 2).click();
    await bar(page).getByRole('button', { name: 'Ver card' }).click();
    const card = page.getByRole('dialog');
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Fechar' }).evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });
    await expect(card).toBeHidden();
    await expect(page).toHaveURL(/#\/squad$/);
    await expect(pitch(page)).toBeVisible();
    expect(await page.evaluate(() => history.state?.sheet)).toBeUndefined();
    // The focus returns to "Ver card" (the selection is still on).
    await expect(bar(page).getByRole('button', { name: 'Ver card' })).toBeFocused();
    await page.keyboard.press('Escape');

    // "Completar e jogar" tapped twice in the same instant: one round.
    await slot(page, 1).click();
    await place(page, 'bench-6').click();
    await playButton(page).click();
    const sheet = page.getByRole('dialog', { name: 'Escalação incompleta' });
    await sheet
      .getByRole('button', { name: 'Completar e jogar' })
      .evaluate((button: HTMLElement) => {
        button.click();
        button.click();
      });
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await readSave(page)).game.round).toBe(2);
    await expect(playButton(page)).toBeEnabled();
    expect((await readSave(page)).game.round).toBe(2);
  });

  test('"Ajustar a escalação" de outra aba fecha a folha e mostra a Escalação', async ({
    page,
  }) => {
    await withFixture(page);
    await slot(page, 1).click();
    await place(page, 'bench-6').click();
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Clube' })
      .click();
    await expect(page).toHaveURL(/#\/club$/);
    await playButton(page).click();
    const sheet = page.getByRole('dialog', { name: 'Escalação incompleta' });
    await sheet.getByRole('button', { name: 'Ajustar a escalação' }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/#\/squad$/);
    await expect(slot(page, 1)).toContainText('Vaga livre');
  });
});

test.describe('Mudar sem troca: "Deixar de fora" e a vaga livre (medida 16)', () => {
  const outRowsOf = (page: Page) =>
    main(page).locator('[data-place^="out-"]:not([data-place="out-free"])');
  const freeOut = (page: Page) => place(page, 'out-free');

  test('(a) dois toques e (d) de volta pela vaga livre; (e) sem seleção nada muda', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    // The first line of the players left out, at least 44px, free (no aria-pressed).
    const group = main(page).locator('section.group', { hasText: 'Não relacionados' });
    await expect(group.locator('[data-place]').first()).toHaveAttribute('data-place', 'out-free');
    expect((await box(freeOut(page))).height).toBeGreaterThanOrEqual(44);
    await expect(freeOut(page)).not.toHaveAttribute('aria-pressed', /.*/);
    await expect(freeOut(page)).toHaveAccessibleName(
      'Deixar de fora. Tira o jogador do campo ou do banco, sem trocar.',
    );

    // (e) A tap on it with nobody picked: nothing changes, the bar says what to do.
    const before = await places(page);
    await freeOut(page).click();
    await expect(bar(page)).toContainText('Selecione antes um jogador');
    expect(await places(page)).toEqual(before);

    // (a) A starter, then "Deixar de fora".
    const leaving = fixture.starters[7]!;
    const outBefore = await outRowsOf(page).count();
    await slot(page, 7).click();
    await freeOut(page).click();
    await expect(slot(page, 7)).toContainText('Vaga livre');
    await expect(bar(page)).toContainText(`${leaving.name.full} foi para os não relacionados.`);
    await expect(outRowsOf(page)).toHaveCount(outBefore + 1);
    await expect(
      group.getByRole('button', { name: new RegExp(`^${leaving.name.full},`) }),
    ).toHaveCount(1);
    await expect(freeOut(page)).toBeFocused();
    await expectStored(page, (d) => d.lineup.starters[7] === null);

    // (d) A player left out (keyboard) to that free slot: the pitch has 11 again.
    await place(page, 'out-0').focus();
    await page.keyboard.press('Enter');
    await slot(page, 7).focus();
    await page.keyboard.press('Enter');
    await expect(bar(page)).toContainText('foi para a vaga de MEI.');
    await expect(pitch(page).locator('button[data-slot].empty')).toHaveCount(0);
    await expectStored(page, (d) => d.lineup.starters.every((id) => id !== null));
  });

  test('(b) teclado: um reserva, Enter, Tab até "Deixar de fora", Enter', async ({ page }) => {
    const fixture = await withFixture(page);
    const reserve = fixture.bench[2]!;
    const benchGroup = main(page).locator('section.group', { hasText: 'Banco' });
    await expect(benchGroup.locator('h2, h3').first()).toContainText('6 de 7');
    await place(page, 'bench-2').focus();
    await page.keyboard.press('Enter');
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      if (await freeOut(page).evaluate((el) => el === document.activeElement)) break;
    }
    await expect(freeOut(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(bar(page)).toContainText(`${reserve.name.full} foi para os não relacionados.`);
    await expect(benchGroup.locator('h2, h3').first()).toContainText('5 de 7');
    await expect(benchGroup.getByText('Vaga no banco')).toHaveCount(2);
  });

  test('(c) arrasto de um titular até "Deixar de fora": mouse; no celular, segurar 400 ms', async ({
    page,
    browserName,
  }) => {
    const mobile = page.viewportSize()!.width < SIDE_FROM;
    // The touch hold goes through CDP, which only Chromium has (as in measure 6).
    test.skip(mobile && browserName !== 'chromium', 'toque segurado só pelo CDP (Chromium)');
    const fixture = await withFixture(page);
    // Desktop: a striker, high on the pitch, so the mouse never crosses the bottom band where
    // the page scrolls by itself. Phone: the goalkeeper, and the page does scroll.
    const index = mobile ? 0 : 10;
    const leaving = fixture.starters[index]!;
    const center = (b: { x: number; y: number; width: number; height: number }) => ({
      x: b.x + b.width / 2,
      y: b.y + b.height / 2,
    });
    if (!mobile) {
      const from = center(await box(slot(page, index)));
      const to = center(await box(freeOut(page)));
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 12 });
      await expect(freeOut(page)).toHaveClass(/target/);
      await page.mouse.up();
    } else {
      // The free place is far below the pitch: the drag scrolls the page near the bottom edge.
      const touch = await touchScreen(page);
      await slot(page, 0).scrollIntoViewIfNeeded();
      const gk = await box(slot(page, 0));
      await page.evaluate((y) => window.scrollBy(0, y - 120), gk.y);
      const from = center(await box(slot(page, 0)));
      await touch('touchStart', [from]);
      await page.waitForTimeout(400);
      // Above the dock (the bar's sticky offset) and inside the band where the page scrolls.
      const inset = await main(page)
        .locator('.bar-slot')
        .evaluate((el) => parseFloat(getComputedStyle(el).bottom) || 0);
      const height = page.viewportSize()!.height;
      const band = height - inset - 20;
      for (let i = 1; i <= 8; i++) {
        await touch('touchMove', [{ x: from.x, y: from.y + ((band - from.y) * i) / 8 }]);
      }
      // Wait until the free place comes up above the band, then go there.
      await expect
        .poll(async () => center(await box(freeOut(page))).y, { timeout: 15_000 })
        .toBeLessThan(height - inset - 80);
      const to = center(await box(freeOut(page)));
      for (let i = 1; i <= 6; i++) {
        await touch('touchMove', [
          { x: from.x + ((to.x - from.x) * i) / 6, y: band + ((to.y - band) * i) / 6 },
        ]);
      }
      const target = center(await box(freeOut(page)));
      await touch('touchMove', [target]);
      await expect(freeOut(page)).toHaveClass(/target/);
      await touch('touchEnd', []);
    }
    await expect(slot(page, index)).toContainText('Vaga livre');
    await expect(bar(page)).toContainText(`${leaving.name.full} foi para os não relacionados.`);
    await expectStored(page, (d) => d.lineup.starters[index] === null);
  });

  test('(f) os reservas todos a "Deixar de fora": 7 "Vaga no banco", "0 de 7" e nenhum bloqueio', async ({
    page,
  }) => {
    await withFixture(page);
    for (let i = 0; i < 6; i++) {
      await place(page, `bench-${i}`).click();
      await freeOut(page).click();
      await expect(bar(page)).toContainText('foi para os não relacionados.');
    }
    const benchGroup = main(page).locator('section.group', { hasText: 'Banco' });
    await expect(benchGroup.getByText('Vaga no banco')).toHaveCount(7);
    await expect(benchGroup.locator('h2, h3').first()).toContainText('0 de 7');
    await expect(main(page).locator('.banner.warning')).toHaveCount(0);
    await expect(playButton(page)).not.toContainText('Escalação incompleta');
    await expectStored(page, (d) => d.lineup.bench.every((id) => id === null));
  });
});

test.describe('Escalação no Simplificado (medida 12)', () => {
  test('sem "Cond.", sem barra de condição, sem selo de lesão ou suspensão; a explicação sem cansaço', async ({
    page,
  }) => {
    await startCareer(page, { realism: 'simplified' });
    await openLineup(page);
    await expect(main(page).locator('section.group', { hasText: 'Banco' })).not.toContainText(
      'Cond.',
    );
    await expect(pitch(page).locator('.cond')).toHaveCount(0);
    // Without the condition bar the slot keeps its 75 × 52px (escalacao.md).
    for (const size of sizesOf(page)) {
      await page.setViewportSize(size);
      const boxes = await pitch(page)
        .locator('button[data-slot]')
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { width: r.width, height: r.height };
          }),
        );
      expect(boxes).toHaveLength(11);
      for (const b of boxes) {
        expect(b.width, `${size.width}`).toBeGreaterThanOrEqual(75);
        expect(b.height, `${size.width}`).toBeGreaterThanOrEqual(52);
      }
    }
    await expect(main(page).locator('.badge.injured, .badge.suspended')).toHaveCount(0);
    await expect(main(page).locator('section.strength details p')).not.toContainText('cansaço');
    const save = await readSave(page);
    for (const id of save.game.squads[save.career.clubId]!) {
      expect(isAvailable(save.game.players[id] as unknown as Player)).toBe(true);
    }
  });
});

/** The texts of the secondary position's measures, per language (content/<idioma>/ui.json). */
const IN_LANG = {
  'pt-BR': { secondary: 'Posição secundária', tab: 'Elenco', view: 'Escalação' },
  es: { secondary: 'Posición secundaria', tab: 'Plantel', view: 'Alineación' },
  en: { secondary: 'Secondary position', tab: 'Squad', view: 'Lineup' },
} as const;

/**
 * The Escalação through the tab bar and the view selector, with the game in `lang` (the slots by
 * their data attribute: the pitch's name is in the language too).
 */
async function openLineupIn(page: Page, lang: keyof typeof IN_LANG): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: IN_LANG[lang].tab }).first().click();
  await main(page).locator('fieldset label', { hasText: IN_LANG[lang].view }).click();
  await expect(main(page).locator('button[data-slot]')).toHaveCount(11);
}

test.describe('Posição secundária na Escalação (escalacao.md, "Posição secundária"; T-079)', () => {
  // The cases of the fixture (lineup-fixture.ts, addSecondaryCases): (a) the DM with secondary
  // CB in slot 1; (b) the FB with secondary CB on bench 2; (c) the AM without one on bench 4;
  // (d) the AM with secondary DM in slot 6, injured; (e) the CB in the striker's slot 9.
  const candidate = (page: Page) => place(page, 'bench-2').locator('.badge.secondary');
  /** The top of a place on the page (not in the window, which a tap may scroll). */
  const pageY = (locator: Locator) =>
    locator.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

  test('marca: ícone e texto na vaga de (a), a sigla VOL em violeta; nome acessível; gravidade em (d) (medidas 1 e 3)', async ({
    page,
  }) => {
    const { cases } = await withSecondaryFixture(page);
    const a = slot(page, 1);
    const mark = a.locator('.mark');
    await expect(mark).toHaveCount(1);
    await expect(mark).toHaveText('Posição secundária');
    await expect(mark.locator('svg')).toHaveCount(1);
    await expect(a).not.toContainText('Improvisado');
    await expect(a).not.toContainText('Fora de posição');
    const tag = a.locator('.code .tag');
    await expect(tag).toHaveText('VOL');
    await expect(tag).toHaveClass(/\bsector-mid\b/);
    await expect(a).toHaveAttribute('aria-label', /, posição secundária$/);
    await expect(a).toHaveAttribute(
      'aria-label',
      new RegExp(`^Zagueiro: ${cases.onSecondary.name.full}`),
    );
    // (d): only the injury is seen; the name says both.
    const d = slot(page, 6);
    await expect(d.locator('.mark')).toHaveCount(1);
    await expect(d.locator('.mark')).toHaveText('Lesionado, 2 rodadas');
    await expect(d).toHaveAttribute('aria-label', /lesionado, 2 rodadas, posição secundária$/);
  });

  test('cores nos dois temas: a marca neutra de (a); a de (e) continua a de fora de posição (medida 2)', async ({
    page,
  }) => {
    await withSecondaryFixture(page);
    const a = slot(page, 1).locator('.mark');
    const e = slot(page, 9).locator('.mark');
    for (const theme of ['noite', 'dia'] as const) {
      await setTheme(page, theme);
      await expect(a).toHaveCSS('background-color', await tokenColor(page, 'surface-2'));
      await expect(a).toHaveCSS('border-top-color', await tokenColor(page, 'draw'));
      await expect(a).toHaveCSS('color', await tokenColor(page, 'ink'));
      await expect(a.locator('svg')).toHaveCSS('color', await tokenColor(page, 'ink'));
      await expect(e).toHaveCSS('background-color', await tokenColor(page, 'danger-soft'));
      await expect(e).toHaveCSS('border-top-color', await tokenColor(page, 'danger'));
      await expect(e).toHaveCSS('color', await tokenColor(page, 'ink'));
      await expect(e.locator('svg')).toHaveCSS('color', await tokenColor(page, 'danger'));
    }
  });

  test('fora dos avisos: "Atenção na escalação" não tem (a) e tem (e) (medida 4)', async ({
    page,
  }) => {
    const { cases } = await withSecondaryFixture(page);
    const issues = main(page).locator('section.issues');
    await expect(issues).toContainText(`${cases.misplaced.name.full} (ZAG) jogando de ATA`);
    await expect(issues).not.toContainText(cases.onSecondary.name.full);
  });

  test('candidato: tocar a vaga de um zagueiro natural marca (b) e não (c); Esc tira; a vaga não se mexe (medida 5)', async ({
    page,
  }) => {
    const { cases } = await withSecondaryFixture(page);
    await expect(slot(page, 2)).toHaveAttribute(
      'aria-label',
      new RegExp(cases.naturalCb.name.full),
    );
    await expect(candidate(page)).toHaveCount(0);
    const before = await pageY(slot(page, 2));
    await slot(page, 2).click();
    await expect(slot(page, 2)).toHaveAttribute('aria-pressed', 'true');
    await expect(candidate(page)).toHaveCount(1);
    await expect(candidate(page)).toHaveText('Posição secundária');
    await expect(candidate(page).locator('svg')).toHaveCount(1);
    await expect(place(page, 'bench-2')).toHaveAttribute('aria-label', /, posição secundária$/);
    await expect(place(page, 'bench-2')).toHaveAttribute(
      'aria-label',
      new RegExp(`^${cases.benchSecondary.name.full}`),
    );
    await expect(place(page, 'bench-4')).toHaveAttribute(
      'aria-label',
      new RegExp(`^${cases.benchPlain.name.full}`),
    );
    await expect(place(page, 'bench-4').locator('.badge.secondary')).toHaveCount(0);
    expect(Math.abs((await pageY(slot(page, 2))) - before)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(slot(page, 2)).toHaveAttribute('aria-pressed', 'false');
    await expect(candidate(page)).toHaveCount(0);
  });

  test('candidato no arrasto: segurar 400 ms a vaga no celular marca (b); a vaga não se mexe (medida 5)', async ({
    page,
    browserName,
  }) => {
    const mobile = page.viewportSize()!.width < SIDE_FROM;
    test.skip(
      !mobile || browserName !== 'chromium',
      'toque segurado só pelo CDP (Chromium celular)',
    );
    await withSecondaryFixture(page);
    const touch = await touchScreen(page);
    // The slot in the window, above the dock, as in the drag of measure 6.
    await slot(page, 2).scrollIntoViewIfNeeded();
    await page.evaluate((y) => window.scrollBy(0, y - 160), (await box(slot(page, 2))).y);
    const before = await pageY(slot(page, 2));
    const b = await box(slot(page, 2));
    const at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await touch('touchStart', [at]);
    await page.waitForTimeout(400);
    await touch('touchMove', [{ x: at.x + 4, y: at.y + 4 }]);
    await expect(slot(page, 2)).toHaveClass(/origin/);
    await expect(candidate(page)).toHaveCount(1);
    await expect(candidate(page)).toHaveText('Posição secundária');
    expect(Math.abs((await pageY(slot(page, 2))) - before)).toBeLessThanOrEqual(1);
    await expect(place(page, 'bench-4').locator('.badge.secondary')).toHaveCount(0);
    // Dropped where it started: a tap, the slot picked; Esc ends it and the badge goes.
    await touch('touchEnd', []);
    await page.keyboard.press('Escape');
    await expect(candidate(page)).toHaveCount(0);
  });

  for (const lang of ['pt-BR', 'es', 'en'] as const) {
    test(`${lang}: alvos de 44 px nas 6 formações com (a) na vaga de ZAG mais à esquerda; a marca em até 2 linhas; sem rolagem lateral (medida 7)`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      const { fixture } = await withSecondaryFixture(page);
      if (lang !== 'pt-BR') {
        await reopenIn(page, lang);
        await openLineupIn(page, lang);
      }
      for (const formation of FORMATIONS) {
        if (formation !== '4-4-2') {
          await patchSave(
            page,
            (save) => {
              (save.career as Record<string, unknown>).draft = {
                ...fixture.draft,
                lineup: { ...fixture.draft.lineup, formation },
              };
            },
            lang === 'pt-BR'
              ? undefined
              : async (p) => {
                  await p.goto('/jogo/');
                  await continueIn(p, lang);
                },
          );
          await openLineupIn(page, lang);
        }
        await expect(slot(page, 1).locator('.mark')).toHaveText(IN_LANG[lang].secondary);
        for (const size of sizesOf(page)) {
          await page.setViewportSize(size);
          await noPageScroll(page);
          if (size.width !== 360) continue;
          const at = `${lang} ${formation}`;
          const boxes = await main(page)
            .locator('button[data-slot]')
            .evaluateAll((els) =>
              els.map((el) => {
                const r = el.getBoundingClientRect();
                return { x: r.x, y: r.y, w: r.width, h: r.height };
              }),
            );
          expect(boxes).toHaveLength(11);
          for (const [i, b] of boxes.entries()) {
            expect(b.w, `${at}: vaga ${i}`).toBeGreaterThanOrEqual(44);
            expect(b.h, `${at}: vaga ${i}`).toBeGreaterThanOrEqual(44);
            for (const [j, o] of boxes.entries()) {
              if (j <= i) continue;
              const apart =
                b.x + b.w <= o.x + 0.5 ||
                o.x + o.w <= b.x + 0.5 ||
                b.y + b.h <= o.y + 0.5 ||
                o.y + o.h <= b.y + 0.5;
              expect(apart, `${at}: vagas ${i} e ${j} se sobrepõem`).toBe(true);
            }
          }
          // (a) sits in the leftmost centre-back slot.
          const cbs = FORMATION_SLOTS[formation].flatMap((p, i) => (p === 'CB' ? [i] : []));
          expect(Math.min(...cbs.map((i) => boxes[i]!.x)), at).toBe(boxes[1]!.x);
          const mark = await slot(page, 1)
            .locator('.mark')
            .evaluate((el) => {
              const css = getComputedStyle(el);
              const px = (v: string) => parseFloat(v) || 0;
              return {
                height: el.getBoundingClientRect().height,
                line: px(css.lineHeight),
                extra:
                  px(css.paddingTop) +
                  px(css.paddingBottom) +
                  px(css.borderTopWidth) +
                  px(css.borderBottomWidth),
              };
            });
          expect(mark.line, `${at}: altura de linha do rótulo`).toBeGreaterThan(0);
          expect(mark.height, `${at}: a marca em até 2 linhas`).toBeLessThanOrEqual(
            2 * mark.line + mark.extra + 1,
          );
          expect(boxes[1]!.h, `${at}: a vaga de (a)`).toBeLessThanOrEqual(88);
        }
      }
    });
  }

  test('movimento reduzido: selecionar a vaga e ver o selo do candidato não cria animação (medida 8)', async ({
    page,
  }) => {
    await withSecondaryFixture(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await slot(page, 2).click();
    await expect(candidate(page)).toHaveCount(1);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});
