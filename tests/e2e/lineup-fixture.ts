import type { Page } from '@playwright/test';
import type { Player, Position } from '../../app/src/engine/index.ts';
import { startCareer } from './career.ts';
import { expect } from './fixtures.ts';
import { changePlayer, patchSave, type DraftJson, type SaveJson } from './save.ts';

/*
 * A fixture da Escalação e da Tática (T-029, T-077): montada sobre o elenco sorteado da carreira,
 * sempre pela mesma regra (a composição do elenco é fixa, 3/5/4/4/4/5): 4-4-2 com um zagueiro na
 * vaga de atacante e um meia na de volante, um lateral titular cansado (condição 79), 6 reservas e
 * uma vaga livre no banco, e entre os não relacionados um lesionado (3 rodadas) e um suspenso. Ela
 * entra como a ficha do snapshot (`career.draft`), que a abertura usa enquanto o registro não tem
 * ficha. Mais os passos e as medidas que os dois specs dividem.
 */

/** Largura a partir da qual a moldura tem a barra lateral (desktop). */
export const SIDE_FROM = 900;
export const main = (page: Page) => page.locator('main');
export const pitch = (page: Page) => main(page).getByRole('group', { name: /^Campo, formação/ });

export interface Fixture {
  readonly starters: Player[];
  /** 6 reserves; the 7th bench place is free. */
  readonly bench: Player[];
  readonly injured: Player;
  readonly suspended: Player;
  /** The centre-back on the striker's slot (index 9). */
  readonly misplaced: Player;
  readonly tired: Player;
  readonly draft: DraftJson;
}

export function squadOf(save: SaveJson): Player[] {
  return save.game.squads[save.career.clubId]!.map(
    (id) => save.game.players[id] as unknown as Player,
  );
}

/** Builds the fixture on `save` (changes it) and returns who is where. */
export function buildFixture(save: SaveJson): Fixture {
  const left = [...squadOf(save)].sort((a, b) => b.overall - a.overall);
  const take = (position: Position): Player => {
    const at = left.findIndex((p) => p.position === position);
    if (at < 0) throw new Error(`fixture: sem ${position} no elenco`);
    return left.splice(at, 1)[0]!;
  };
  const gk = take('GK');
  const [cb1, cb2, misplaced] = [take('CB'), take('CB'), take('CB')];
  const [fb1, tired] = [take('FB'), take('FB')];
  const dm = take('DM');
  const [improvised, am1, am2] = [take('AM'), take('AM'), take('AM')];
  const st = take('ST');
  const starters = [gk, cb1, cb2, tired, fb1, dm, improvised, am1, am2, misplaced, st];
  const bench = [take('GK'), take('CB'), take('FB'), take('DM'), take('ST'), take('ST')];
  const injured = take('DM');
  const suspended = take('ST');
  for (const p of [...starters, ...bench, ...left]) {
    changePlayer(save, p.id, { injuryRounds: 0, suspendedGames: 0 });
  }
  changePlayer(save, tired.id, { condition: 79 });
  changePlayer(save, injured.id, { injuryRounds: 3, suspendedGames: 0 });
  changePlayer(save, suspended.id, { injuryRounds: 0, suspendedGames: 1 });
  const draft: DraftJson = {
    lineup: {
      formation: '4-4-2',
      starters: starters.map((p) => p.id),
      bench: [...bench.map((p) => p.id), null],
      captains: [],
      penaltyTakers: [],
      freeKickTakers: [],
    },
    tactic: { posture: 'balanced', pressure: 'medium' },
  };
  (save.career as Record<string, unknown>).draft = draft;
  const fresh = (p: Player) => save.game.players[p.id] as unknown as Player;
  return {
    starters: starters.map(fresh),
    bench: bench.map(fresh),
    injured: fresh(injured),
    suspended: fresh(suspended),
    misplaced: fresh(misplaced),
    tired: fresh(tired),
    draft,
  };
}

/** A new career in Realismo completo with the fixture, opened on the Escalação. */
export async function withFixture(page: Page, change?: (save: SaveJson) => void): Promise<Fixture> {
  await startCareer(page);
  let fixture: Fixture | undefined;
  await patchSave(page, (save) => {
    fixture = buildFixture(save);
    change?.(save);
  });
  await openLineup(page);
  return fixture!;
}

export async function openLineup(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Elenco' })
    .click();
  await expect(page).toHaveURL(/#\/squad$/);
  await main(page).locator('fieldset label', { hasText: 'Escalação' }).click();
  await expect(pitch(page).locator('button[data-slot]')).toHaveCount(11);
}

export async function noPageScroll(page: Page): Promise<void> {
  const box = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(box.scroll, 'rolagem lateral da página').toBeLessThanOrEqual(box.client);
}

/** As larguras de cada medida: celular em pé, em pé estreito e deitado; ou o desktop. */
export function sizesOf(page: Page) {
  return page.viewportSize()!.width >= SIDE_FROM
    ? [{ width: 1280, height: 800 }]
    : [
        { width: 360, height: 740 },
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ];
}
