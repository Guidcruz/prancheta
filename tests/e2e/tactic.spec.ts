import type { Locator, Page } from '@playwright/test';
import {
  FORMATION_SLOTS,
  sheetStrength,
  type GameState,
  type Player,
  type Position,
} from '../../app/src/engine/index.ts';
import { reopenInSpanish, startCareer } from './career.ts';
import { expect, playButton, test } from './fixtures.ts';
import {
  SIDE_FROM,
  main,
  noPageScroll,
  openLineup,
  pitch,
  sizesOf,
  withFixture,
  withSecondaryFixture,
  type Fixture,
} from './lineup-fixture.ts';
import { changePlayer, readDraft, readSave, type DraftJson, type SaveJson } from './save.ts';

/*
 * Tática e Funções (T-077; US-018): as "Medidas para o E2E" de docs/design/telas/tatica.md e
 * funcoes.md, o que é toque, teclado, foco, CSS, histórico e gravação de verdade. Os textos por
 * idioma e os estados estão no Vitest (app/src/ui/tactic-screens.test.ts); o que o motor recebe na
 * rodada, no teste de integração (app/src/ui/tactic.test.ts). Sem arrasto nestas telas: tudo roda
 * também no WebKit. A fixture é a da Escalação (lineup-fixture.ts): 4-4-2, listas vazias.
 */

const view = (page: Page, name: string) =>
  main(page).locator('fieldset').first().locator('label', { hasText: name });
const group = (page: Page, legend: string) => main(page).getByRole('group', { name: legend });
const formations = (page: Page) => group(page, 'Formação');
const postures = (page: Page) => group(page, 'Postura');
const pressures = (page: Page) => group(page, 'Pressão');
/** The card (the whole label) of an option, by the start of its name. */
const radio = (fieldset: Locator, name: string) =>
  fieldset.getByRole('radio', { name: new RegExp(`^${name}`) });
const card = (fieldset: Locator, name: string) =>
  radio(fieldset, name).locator('xpath=ancestor::label');
const live = (page: Page) => main(page).locator('.tactic > [role="status"]');
const roleLine = (page: Page, role: 'captain' | 'penalty' | 'freeKick') =>
  main(page).locator(`[data-role="${role}"] button`);
const sheet = (page: Page) => page.getByRole('dialog');

/** The position of each slot in full, as the accessible names say it (pt-BR). */
const FULL: Readonly<Record<Position, string>> = {
  GK: 'Goleiro',
  CB: 'Zagueiro',
  FB: 'Lateral',
  DM: 'Volante',
  AM: 'Meia',
  ST: 'Atacante',
};

async function openTactic(page: Page): Promise<void> {
  await view(page, 'Tática').click();
  await expect(formations(page).getByRole('radio')).toHaveCount(6);
}

/** The fixture with the coach's lists in its draft (by the starters' ids), opened on the Tática. */
async function withLists(
  page: Page,
  lists: (starters: readonly string[]) => Partial<DraftJson['lineup']>,
): Promise<Fixture> {
  const fixture = await withFixture(page, (save: SaveJson) => {
    // withFixture builds the fixture before calling this: its 11 are the draft's starters.
    const draft = (save.career as unknown as { draft: DraftJson }).draft;
    Object.assign(draft.lineup, lists(draft.lineup.starters as string[]));
  });
  await openTactic(page);
  return fixture;
}

/** The draft stored once `check` holds. */
async function stored(page: Page, check: (draft: DraftJson) => boolean): Promise<DraftJson> {
  await expect
    .poll(async () => {
      const draft = await readDraft(page);
      return draft !== undefined && check(draft);
    })
    .toBe(true);
  return (await readDraft(page))!;
}

/** The pitch: the position of each slot and the name of who is there, from the accessible names. */
async function pitchOf(page: Page): Promise<{ positions: string[]; names: string[] }> {
  const labels = await pitch(page)
    .locator('button[data-slot]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  return {
    positions: labels.map((l) => l.split(':')[0]!),
    names: labels.map((l) => l.split(': ')[1]!.split(', nota')[0]!),
  };
}

const benchLabels = (page: Page) =>
  main(page)
    .locator('[data-place^="bench-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));

const numbers = (page: Page) =>
  main(page)
    .locator('section.strength dd.value .numero')
    .allInnerTexts()
    .then((all) => all.map(Number));

async function reopen(page: Page): Promise<void> {
  await page.reload();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(playButton(page)).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Elenco' })
    .click();
  await openTactic(page);
}

const box = async (locator: Locator) => (await locator.boundingBox())!;

test.describe('Tática (tatica.md; US-018)', () => {
  test('trocar a formação reposiciona os mesmos 11 pela posição; o banco não muda; a força e a região viva contam (medida 1)', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    const before = await pitchOf(page);
    const bench = await benchLabels(page);
    await openTactic(page);
    await expect(radio(formations(page), '4-4-2')).toBeChecked();
    const was = await numbers(page);
    await card(formations(page), '4-3-3').click();
    await expect(radio(formations(page), '4-3-3')).toBeChecked();
    await expect(radio(formations(page), '4-4-2')).not.toBeChecked();
    await expect(live(page)).toHaveText(/^Formação 4-3-3\./);
    const draft = await stored(page, (d) => d.lineup.formation === '4-3-3');
    expect(new Set(draft.lineup.starters)).toEqual(new Set(fixture.draft.lineup.starters));
    expect(draft.lineup.bench).toEqual(fixture.draft.lineup.bench);
    // The strength is the engine's reading of the new sheet; what changed has its arrow.
    const save = await readSave(page);
    const s = sheetStrength(
      save.game as unknown as GameState,
      save.career.clubId,
      draft.lineup as never,
    )!;
    const now = [s.overall, s.def, s.mid, s.atk].map(Math.round);
    expect(await numbers(page)).toEqual(now);
    const changed = now.filter((n, i) => n !== was[i]).length;
    await expect(main(page).locator('section.strength .delta')).toHaveCount(changed);
    // On the Escalação: "Campo, formação 4-3-3", the same 11 names in the 4-3-3 slots.
    await view(page, 'Escalação').click();
    await expect(pitch(page)).toHaveAccessibleName('Campo, formação 4-3-3');
    const after = await pitchOf(page);
    expect(after.positions).toEqual(FORMATION_SLOTS['4-3-3'].map((p) => FULL[p]));
    expect([...after.names].sort()).toEqual([...before.names].sort());
    expect(await benchLabels(page)).toEqual(bench);
    // The same formation again changes nothing.
    await openTactic(page);
    await card(formations(page), '4-3-3').click();
    await expect(radio(formations(page), '4-3-3')).toBeChecked();
  });

  test('postura e pressão ficam depois de recarregar; a postura tem só 3 opções (medidas 2 e 3)', async ({
    page,
  }) => {
    await withFixture(page);
    await openTactic(page);
    await expect(postures(page).getByRole('radio')).toHaveCount(3);
    await expect(pressures(page).getByRole('radio')).toHaveCount(3);
    await expect(postures(page)).not.toContainText('Tudo no ataque');
    await card(postures(page), 'Ofensiva').click();
    await card(pressures(page), 'Alta').click();
    await expect(radio(postures(page), 'Ofensiva')).toBeChecked();
    await expect(radio(pressures(page), 'Alta')).toBeChecked();
    await stored(page, (d) => d.tactic.posture === 'attacking' && d.tactic.pressure === 'high');
    await reopen(page);
    await expect(radio(postures(page), 'Ofensiva')).toBeChecked();
    await expect(radio(pressures(page), 'Alta')).toBeChecked();
  });

  test('alvos de 44 px; a formação em 2 colunas no celular em pé e 3 no desktop e deitado; sem rolagem lateral (medidas 4 e 6)', async ({
    page,
  }) => {
    await withFixture(page);
    await openTactic(page);
    for (const size of sizesOf(page)) {
      await page.setViewportSize(size);
      await noPageScroll(page);
      for (const fieldset of [formations(page), postures(page), pressures(page)]) {
        for (const label of await fieldset.locator('label').all()) {
          expect((await box(label)).height, `${size.width}`).toBeGreaterThanOrEqual(44);
        }
      }
      for (const role of ['captain', 'penalty', 'freeKick'] as const) {
        expect((await box(roleLine(page, role))).height).toBeGreaterThanOrEqual(44);
      }
      const xs = await formations(page)
        .locator('label')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)));
      const columns = new Set(xs).size;
      // Two columns on the phone standing; three once the group has 480px (lying down, desktop).
      expect(columns, `${size.width}`).toBe(size.width < 480 ? 2 : 3);
    }
  });

  test('posição secundária: "Nesta formação" não tem o volante na vaga de ZAG e tem o zagueiro no ataque (T-079)', async ({
    page,
  }) => {
    // tatica.md, "Posição secundária": the fixture of the Escalação with (a), the DM with
    // secondary CB in the CB slot, and (e), the CB in the striker's slot.
    const { cases } = await withSecondaryFixture(page);
    await openTactic(page);
    const issues = main(page).locator('section.issues');
    await expect(issues).toContainText(cases.misplaced.name.full);
    await expect(issues).not.toContainText(cases.onSecondary.name.full);
  });

  test('teclado: seta para baixo na Postura marca a opção seguinte (medida 5)', async ({
    page,
  }) => {
    await withFixture(page);
    await openTactic(page);
    await radio(postures(page), 'Equilibrada').focus();
    await page.keyboard.press('ArrowDown');
    await expect(radio(postures(page), 'Ofensiva')).toBeChecked();
    await expect(radio(postures(page), 'Ofensiva')).toBeFocused();
    await stored(page, (d) => d.tactic.posture === 'attacking');
  });

  test('funções com as listas vazias: as três linhas dizem "Automático:" e um nome, também na primeira vez (medida 7)', async ({
    page,
  }) => {
    await withFixture(page);
    await openTactic(page);
    for (const role of ['captain', 'penalty', 'freeKick'] as const) {
      await expect(roleLine(page, role)).toContainText(/Automático: \S+/);
    }
    // A new career, the coach never touched the sheet (CEO decision 5): the lists start empty.
    await startCareer(page);
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Elenco' })
      .click();
    await openTactic(page);
    for (const role of ['captain', 'penalty', 'freeKick'] as const) {
      await expect(roleLine(page, role)).toContainText(/Automático: \S+/);
    }
  });

  test('em es a 360 px, "Tiros libres" fica numa linha e a lista longa é cortada com reticências', async ({
    page,
  }) => {
    test.skip(page.viewportSize()!.width >= SIDE_FROM, 'medida do celular');
    await withFixture(page, (save: SaveJson) => {
      const draft = (save.career as unknown as { draft: DraftJson }).draft;
      const s = draft.lineup.starters as string[];
      draft.lineup.freeKickTakers = [s[10]!, s[8]!, s[7]!];
      // The names are drawn with the squad: long ones, so the cut does not depend on the draw.
      for (const [i, id] of draft.lineup.freeKickTakers.entries()) {
        const long = ['Wellington', 'Maximiliano', 'Bartolomeu'][i]!;
        const name = {
          display: `${long} Albuquerque`,
          full: `${long} Albuquerque`,
          family: 'Albuquerque',
        };
        changePlayer(save, id, { name });
      }
    });
    await reopenInSpanish(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Plantel' })
      .click();
    await view(page, 'Táctica').click();
    const line = roleLine(page, 'freeKick');
    await expect(line.locator('.label')).toHaveText('Tiros libres');
    const box = await line.evaluate((row) => {
      const label = row.querySelector('.label') as HTMLElement;
      const value = row.querySelector('.value') as HTMLElement;
      return {
        labelHeight: label.getBoundingClientRect().height,
        lineHeight: parseFloat(getComputedStyle(label).lineHeight),
        labelFits: label.scrollWidth <= label.clientWidth,
        valueCut: value.scrollWidth > value.clientWidth,
        spill: row.scrollWidth > row.clientWidth + 1,
      };
    });
    expect(box.labelHeight, 'rótulo em uma linha').toBeLessThan(box.lineHeight * 1.5);
    expect(box.labelFits).toBe(true);
    expect(box.valueCut, 'valor cortado').toBe(true);
    expect(box.spill).toBe(false);
    await noPageScroll(page);
  });
});

test.describe('Funções (funcoes.md; US-018)', () => {
  test('abrir e voltar: "Pênaltis" abre a folha; o voltar, Esc, o X e "Pronto" fecham e o foco volta à linha (medida 1)', async ({
    page,
  }) => {
    await withFixture(page);
    await openTactic(page);
    const line = roleLine(page, 'penalty');
    await line.click();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page)).toHaveAccessibleName('Cobrador de pênalti');
    expect(await page.evaluate(() => history.state?.sheet)).toBe('role');
    await page.goBack();
    await expect(sheet(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/squad$/);
    await expect(line).toBeFocused();
    await expect(formations(page)).toBeVisible();
    // Esc, the X and "Pronto" close it too, and the focus goes back to the line that opened it.
    const closers: ((p: Page) => Promise<void>)[] = [
      (p) => p.keyboard.press('Escape'),
      (p) => sheet(p).getByRole('button', { name: 'Fechar' }).click(),
      (p) => sheet(p).getByRole('button', { name: 'Pronto' }).click(),
    ];
    for (const close of closers) {
      await roleLine(page, 'captain').click();
      await expect(sheet(page)).toHaveAccessibleName('Capitão');
      await close(page);
      await expect(sheet(page)).toBeHidden();
      await expect(roleLine(page, 'captain')).toBeFocused();
      expect(await page.evaluate(() => history.state?.sheet)).toBeUndefined();
    }
    await expect(page).toHaveURL(/#\/squad$/);
  });

  test('montar a lista: pôr A e B, descer A, tirar B; o foco segue o jogador; a linha mostra A (medida 2)', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    await openTactic(page);
    await roleLine(page, 'penalty').click();
    const adds = sheet(page).locator('[data-role-add]');
    await expect(adds).toHaveCount(11);
    const nameOf = async (locator: Locator) =>
      (await locator.getAttribute('aria-label'))!.replace(/^Pôr /, '').replace(/ na lista$/, '');
    const a = await nameOf(adds.nth(0));
    const b = await nameOf(adds.nth(1));
    const list = () =>
      sheet(page)
        .locator('ol [data-role-entry]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-role-entry')));
    const idOf = (full: string) => fixture.starters.find((p) => p.name.full === full)!.id;
    const said = sheet(page).locator('[role="status"]');

    await sheet(page)
      .getByRole('button', { name: `Pôr ${a} na lista` })
      .click();
    await expect(sheet(page).getByRole('button', { name: `Tirar ${a} da lista` })).toBeFocused();
    await expect(said).toHaveText(`Pênaltis: 1 ${a}.`);
    await sheet(page)
      .getByRole('button', { name: `Pôr ${b} na lista` })
      .click();
    await expect(sheet(page).getByRole('button', { name: `Tirar ${b} da lista` })).toBeFocused();
    expect(await list()).toEqual([idOf(a), idOf(b)]);
    await expect(said).toHaveText(`Pênaltis: 1 ${a}, 2 ${b}.`);
    // Subir on the first and Descer on the last are disabled, and stay in place.
    await expect(sheet(page).getByRole('button', { name: `Subir ${a}` })).toBeDisabled();
    await expect(sheet(page).getByRole('button', { name: `Descer ${b}` })).toBeDisabled();

    await sheet(page)
      .getByRole('button', { name: `Descer ${a}` })
      .click();
    expect(await list()).toEqual([idOf(b), idOf(a)]);
    // Descer is now disabled for A (the last): the focus goes to his other order button.
    await expect(sheet(page).getByRole('button', { name: `Subir ${a}` })).toBeFocused();
    await expect(said).toHaveText(`Pênaltis: 1 ${b}, 2 ${a}.`);

    await sheet(page)
      .getByRole('button', { name: `Tirar ${b} da lista` })
      .click();
    expect(await list()).toEqual([idOf(a)]);
    await expect(sheet(page).getByRole('button', { name: `Pôr ${b} na lista` })).toBeFocused();
    await stored(page, (d) => d.lineup.penaltyTakers.join() === idOf(a));

    await sheet(page).getByRole('button', { name: 'Pronto' }).click();
    const display = fixture.starters.find((p) => p.id === idOf(a))!.name.display;
    await expect(roleLine(page, 'penalty')).toContainText(display);
    await expect(roleLine(page, 'penalty')).not.toContainText('Automático');
  });

  test('limite: com 3 na lista, as linhas de "Outros titulares" ficam desabilitadas com o motivo (medida 3)', async ({
    page,
  }) => {
    await withLists(page, (s) => ({
      freeKickTakers: [s[10]!, s[8]!, s[0]!],
    }));
    await roleLine(page, 'freeKick').click();
    await expect(sheet(page)).toHaveAccessibleName('Cobrador de falta');
    await expect(sheet(page).locator('ol [data-role-entry]')).toHaveCount(3);
    const adds = sheet(page).locator('[data-role-add]');
    await expect(adds).toHaveCount(8);
    for (const add of await adds.all()) await expect(add).toBeDisabled();
    await expect(sheet(page).getByText('no máximo 3')).toBeVisible();
  });

  test('alvos: Subir, Descer, Tirar e as linhas de "Pôr" medem 44 × 44 px; a folha sem rolagem lateral (medida 4)', async ({
    page,
  }) => {
    await withLists(page, (s) => ({ captains: [s[10]!, s[8]!] }));
    const sizes =
      page.viewportSize()!.width >= SIDE_FROM
        ? [{ width: 1280, height: 800 }]
        : [
            { width: 360, height: 740 },
            { width: 390, height: 844 },
            { width: 844, height: 390 },
          ];
    for (const size of sizes) {
      await page.setViewportSize(size);
      await roleLine(page, 'captain').click();
      await expect(sheet(page)).toBeVisible();
      const targets = sheet(page).locator('[data-role-tool], [data-role-add]');
      await expect(targets).toHaveCount(6 + 9);
      for (const target of await targets.all()) {
        const b = await box(target);
        expect(b.width, `${size.width}`).toBeGreaterThanOrEqual(44);
        expect(b.height, `${size.width}`).toBeGreaterThanOrEqual(44);
      }
      // Nothing wider than the sheet: the page, the sheet and every line of it.
      await noPageScroll(page);
      const wide = await sheet(page)
        .locator('.panel, .body, .entry')
        .evaluateAll((els) =>
          els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.className),
        );
      expect(wide, `${size.width}`).toEqual([]);
      const dialog = await box(sheet(page));
      for (const target of await targets.all()) {
        const b = await box(target);
        expect(b.x + b.width, `${size.width}`).toBeLessThanOrEqual(dialog.x + dialog.width + 0.5);
      }
      await sheet(page).getByRole('button', { name: 'Pronto' }).click();
      await expect(sheet(page)).toBeHidden();
    }
  });

  test('a troca na Escalação tira da lista; a barra diz "saiu da lista de pênaltis" (medida 5)', async ({
    page,
  }) => {
    const fixture = await withLists(page, (s) => ({ penaltyTakers: [s[10]!] }));
    const a = fixture.starters[10]!;
    await expect(roleLine(page, 'penalty')).toContainText(a.name.display);
    await openLineup(page);
    await main(page).locator('[data-slot="10"]').click();
    await main(page).locator('[data-place="bench-4"]').click();
    await expect(main(page).locator('.bar-slot > [role="status"]')).toContainText(
      `${a.name.full} saiu da lista de pênaltis.`,
    );
    await stored(page, (d) => d.lineup.penaltyTakers.length === 0);
    await openTactic(page);
    await expect(roleLine(page, 'penalty')).toContainText(/Automático: \S+/);
  });

  test('recarregar a página mantém as três listas (medida 7)', async ({ page }) => {
    const fixture = await withFixture(page);
    await openTactic(page);
    const s = fixture.starters;
    const put = async (role: 'captain' | 'penalty' | 'freeKick', players: Player[]) => {
      await roleLine(page, role).click();
      for (const p of players) {
        await sheet(page)
          .getByRole('button', { name: `Pôr ${p.name.full} na lista` })
          .click();
      }
      await sheet(page).getByRole('button', { name: 'Pronto' }).click();
      await expect(sheet(page)).toBeHidden();
    };
    await put('captain', [s[0]!]);
    await put('penalty', [s[10]!, s[8]!]);
    await put('freeKick', [s[7]!, s[10]!, s[3]!]);
    const ids = (players: Player[]) => players.map((p) => p.id).join();
    await stored(
      page,
      (d) =>
        d.lineup.captains.join() === ids([s[0]!]) &&
        d.lineup.penaltyTakers.join() === ids([s[10]!, s[8]!]) &&
        d.lineup.freeKickTakers.join() === ids([s[7]!, s[10]!, s[3]!]),
    );
    await reopen(page);
    await expect(roleLine(page, 'captain')).toContainText(s[0]!.name.display);
    await expect(roleLine(page, 'penalty')).toContainText(
      `${s[10]!.name.display}, ${s[8]!.name.display}`,
    );
    await expect(roleLine(page, 'freeKick')).toContainText(
      `${s[7]!.name.display}, ${s[10]!.name.display}, ${s[3]!.name.display}`,
    );
  });
});
