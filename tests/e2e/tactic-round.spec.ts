import type { Locator, Page } from '@playwright/test';
import { takerValue, type MatchEvent, type Player } from '../../app/src/engine/index.ts';
import { expect, playButton, test } from './fixtures.ts';
import { main, withFixture } from './lineup-fixture.ts';
import { readDraft, readSave, type DraftJson } from './save.ts';

/*
 * Tática e Funções, a parte de QA da T-077 (US-018): o que sai da tela chega à rodada jogada, e o
 * goleiro aparece com número nas folhas de cobrador. Sem arrasto, roda também no WebKit. O
 * Vitest (app/src/ui/tactic-round.test.ts) prova, com 40 sementes, que o cobrador da lista é o
 * que bate; aqui a rodada é jogada de verdade pela interface e a ficha lida do save.
 */

const sheet = (page: Page) => page.getByRole('dialog');
const group = (page: Page, legend: string) => main(page).getByRole('group', { name: legend });
const roleLine = (page: Page, role: 'captain' | 'penalty' | 'freeKick') =>
  main(page).locator(`[data-role="${role}"] button`);
const radio = (fieldset: Locator, name: string) =>
  fieldset.getByRole('radio', { name: new RegExp(`^${name}`) });

async function openTactic(page: Page): Promise<void> {
  await main(page).locator('fieldset').first().locator('label', { hasText: 'Tática' }).click();
  await expect(group(page, 'Formação').getByRole('radio')).toHaveCount(6);
}

async function putInList(
  page: Page,
  role: 'captain' | 'penalty' | 'freeKick',
  players: Player[],
): Promise<void> {
  await roleLine(page, role).click();
  for (const p of players) {
    await sheet(page)
      .getByRole('button', { name: `Pôr ${p.name.full} na lista` })
      .click();
  }
  await sheet(page).getByRole('button', { name: 'Pronto' }).click();
  await expect(sheet(page)).toBeHidden();
}

test.describe('Tática e Funções: a rodada e o goleiro (US-018)', () => {
  test('o goleiro aparece com número nas folhas de pênaltis e de faltas, o mesmo valor do motor', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    await openTactic(page);
    const keeper = fixture.starters[0]!;
    expect(keeper.position).toBe('GK');
    for (const [role, label, title] of [
      ['penalty', 'Finalização', 'Cobrador de pênalti'],
      ['freeKick', 'Técnica', 'Cobrador de falta'],
    ] as const) {
      await roleLine(page, role).click();
      await expect(sheet(page)).toHaveAccessibleName(title);
      const row = sheet(page).getByRole('button', { name: `Pôr ${keeper.name.full} na lista` });
      const value = takerValue(keeper, role);
      expect(value).toBeGreaterThan(0);
      await expect(row).toContainText(`${label} ${value}`);
      await expect(row).not.toContainText('—');
      // Every other starter shows a number too: no dash in the whole list.
      await expect(sheet(page).locator('[data-role-add]')).toHaveCount(11);
      expect(await sheet(page).locator('[data-role-add]').allInnerTexts()).not.toContain('—');
      await sheet(page).getByRole('button', { name: 'Pronto' }).click();
      await expect(sheet(page)).toBeHidden();
    }
  });

  test('a rodada jogada usa a ficha da tela: formação, postura, pressão, capitão e cobradores ficam e valem na súmula', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    const s = fixture.starters;
    await openTactic(page);
    await group(page, 'Formação').locator('label', { hasText: '4-3-3' }).first().click();
    await group(page, 'Postura').locator('label', { hasText: 'Ofensiva' }).first().click();
    await group(page, 'Pressão').locator('label', { hasText: 'Alta' }).first().click();
    // The goalkeeper heads both lists: the engine never picks him, so a kick of his proves the list.
    await putInList(page, 'captain', [s[8]!]);
    await putInList(page, 'penalty', [s[0]!, s[10]!]);
    await putInList(page, 'freeKick', [s[0]!, s[7]!, s[10]!]);
    const ids = (players: Player[]) => players.map((p) => p.id).join();
    await expect
      .poll(async () => {
        const d = await readDraft(page);
        return d?.lineup.freeKickTakers.join() === ids([s[0]!, s[7]!, s[10]!]);
      })
      .toBe(true);

    await playButton(page).click();
    await expect.poll(async () => (await readSave(page)).game.round).toBe(2);
    const save = await readSave(page);
    const draft = (save.career as Record<string, unknown>).draft as DraftJson;
    expect(draft.lineup.formation).toBe('4-3-3');
    expect(draft.tactic).toEqual({ posture: 'attacking', pressure: 'high' });
    expect(draft.lineup.captains.join()).toBe(ids([s[8]!]));
    expect(draft.lineup.penaltyTakers.join()).toBe(ids([s[0]!, s[10]!]));
    expect(draft.lineup.freeKickTakers.join()).toBe(ids([s[0]!, s[7]!, s[10]!]));

    // The report of the round: the coach's match, from the side he played.
    const recap = (
      save.career as unknown as {
        lastRound: { results: { fixtureId: string; events: MatchEvent[] }[] };
      }
    ).lastRound;
    const fixtureOfClub = save.game.fixtures.find(
      (f) => f.round === 1 && (f.homeId === save.career.clubId || f.awayId === save.career.clubId),
    )!;
    const side = fixtureOfClub.homeId === save.career.clubId ? 'home' : 'away';
    const events = recap.results.find(
      (r) => r.fixtureId === (fixtureOfClub as unknown as { id: string }).id,
    )!.events;
    const keeperGone = new Set<string>();
    for (const e of events) {
      if ('side' in e && e.side !== side) continue;
      if (e.type === 'red') keeperGone.add(e.player);
      if (e.type === 'injury') keeperGone.add(e.player);
      if (e.type === 'substitution') keeperGone.add(e.out);
      if (keeperGone.has(s[0]!.id)) break;
      // One round may have no set piece for him: when it has, the first of the list took it.
      if (e.type === 'penaltyAwarded') expect(e.taker).toBe(s[0]!.id);
      if (e.type === 'chance' && e.kind === 'freeKick') expect(e.shooter).toBe(s[0]!.id);
      if (e.type === 'goal') expect([...s, ...fixture.bench].map((p) => p.id)).toContain(e.scorer);
    }
  });

  test('o que a tela mostrou antes da rodada é o que ela mostra depois de jogar e recarregar', async ({
    page,
  }) => {
    const fixture = await withFixture(page);
    await openTactic(page);
    await group(page, 'Pressão').locator('label', { hasText: 'Alta' }).first().click();
    await putInList(page, 'penalty', [fixture.starters[10]!]);
    await playButton(page).click();
    await expect.poll(async () => (await readSave(page)).game.round).toBe(2);
    await expect(playButton(page)).not.toHaveAttribute('aria-busy', 'true');
    await page.reload();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(playButton(page)).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Elenco' })
      .click();
    await openTactic(page);
    await expect(radio(group(page, 'Pressão'), 'Alta')).toBeChecked();
    await expect(roleLine(page, 'penalty')).toContainText(fixture.starters[10]!.name.display);
  });
});
