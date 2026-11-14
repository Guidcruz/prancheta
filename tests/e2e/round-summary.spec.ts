import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import {
  getStandings,
  playRound as playEngineRound,
  validateParams,
  type GameParams,
  type GameState,
} from '../../app/src/engine/index.ts';
import {
  PLAY_GUARD_MS,
  closeSummary,
  continueCareer,
  nextRound,
  playRound,
  playUntil,
  reopenIn,
  roundHeading,
  saveSettled,
  startCareer,
} from './career.ts';
import { setTheme } from './css.ts';
import { expect, playButton, test } from './fixtures.ts';
import {
  countSnapshots,
  readHeadRecord,
  readSave,
  readSheetFixtures,
  type SaveJson,
} from './save.ts';

/*
 * O resumo da rodada no modo "só resultado" (T-030; docs/design/telas/resumo-rodada.md, "Medidas
 * para o E2E", T-030; US-019 e US-032). Cada teste diz as medidas que cobre. O que depende de
 * largura roda uma vez por navegador (no projeto de celular) com a janela que a medida pede; o
 * desktop (1280×800) roda no projeto de desktop.
 */

type Lang = 'pt-BR' | 'es' | 'en';
const UI: Record<Lang, Record<string, string | undefined>> = Object.fromEntries(
  (['pt-BR', 'es', 'en'] as const).map((lang) => [
    lang,
    JSON.parse(
      readFileSync(new URL(`../../app/src/content/${lang}/ui.json`, import.meta.url), 'utf8'),
    ) as Record<string, string>,
  ]),
) as Record<Lang, Record<string, string | undefined>>;
const ERRORS_PT = JSON.parse(
  readFileSync(new URL('../../app/src/content/pt-BR/errors.json', import.meta.url), 'utf8'),
) as Record<string, string>;

/** A text of `ui.json` in `lang` (the test fails on a key that does not exist). */
function ui(lang: Lang, key: string): string {
  const text = UI[lang][key];
  if (text === undefined) throw new Error(`no ${key} in ${lang}`);
  return text;
}

const onPhone = (page: Page) => page.viewportSize()!.width < 900;

interface Played {
  id: string;
  round: number;
  homeId: string;
  awayId: string;
  result?: {
    score: [number, number];
    abandoned: boolean;
    goals: { side: 'home' | 'away'; scorer: string; minute: number; added?: number }[];
  };
}
const fixturesOf = (save: SaveJson) => save.game.fixtures as unknown as Played[];
const mineIn = (save: SaveJson, round: number) =>
  fixturesOf(save).find(
    (f) =>
      f.round === round && (f.homeId === save.career.clubId || f.awayId === save.career.clubId),
  )!;
const displayName = (save: SaveJson, id: string) =>
  (save.game.players[id] as { name: { display: string } }).name.display;

const summary = (page: Page) => page.locator('main.round');
const mineSection = (page: Page) => summary(page).locator('section.mine');
const othersList = (page: Page) => summary(page).locator('ul.others');
const continueButton = (page: Page, lang: Lang = 'pt-BR') =>
  page.getByRole('button', { name: ui(lang, 'round.continue'), exact: true });
const playIn = (page: Page, lang: Lang) =>
  page.getByRole('button', { name: ui(lang, 'play.label') });

/** O placar visível do Scoreboard do meu jogo, como números. */
async function boardScore(page: Page): Promise<[number, number]> {
  const goals = mineSection(page).locator('.scoreboard .goals');
  return [Number(await goals.nth(0).innerText()), Number(await goals.nth(1).innerText())];
}

/** O texto de variação esperado em pt-BR (round.table.*). */
function changeText(change: number): string {
  if (change === 0) return 'Mesma posição';
  const n = Math.abs(change);
  const word = n === 1 ? 'posição' : 'posições';
  return change > 0 ? `Subiu ${n} ${word}` : `Caiu ${n} ${word}`;
}

/** Os parâmetros do jogo como o app os carrega (app/src/params/, validados pelo motor). */
function gameParams(): GameParams {
  const read = (name: string) =>
    JSON.parse(
      readFileSync(new URL(`../../app/src/params/${name}.json`, import.meta.url), 'utf8'),
    ) as unknown;
  const checked = validateParams({
    match: read('match'),
    players: read('players'),
    generation: read('generation'),
    ai: read('ai'),
    season: read('season'),
    fans: read('fans'),
  });
  if (!checked.ok) throw new Error(`params: ${JSON.stringify(checked)}`);
  return checked.value;
}

/** Cria uma carreira com o clube de nome curto `club` (Novo jogo, opções padrão). */
async function startWith(page: Page, club: string): Promise<void> {
  await page.goto('/jogo/');
  await page.getByRole('button', { name: 'Nova carreira' }).click();
  await page.getByRole('radio', { name: new RegExp(club) }).check();
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(playButton(page)).toBeVisible();
}

test.describe('Resumo da rodada (T-030)', () => {
  test('rodada em um toque: placar, gols e os 9 outros do save; rodada 2 e as 10 súmulas; tela cheia (medidas 1 a 4 e 7)', async ({
    page,
  }) => {
    await startCareer(page);
    await playButton(page).click();
    const heading = roundHeading(page);
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('Rodada 1');
    await expect(heading).toBeFocused();
    await expect(page).toHaveURL(/#\/round$/);

    // (7) Salvamento automático: a cabeça já está na rodada 2 com o resumo aberto.
    expect((await readHeadRecord(page)).round).toBe(2);
    await expect(summary(page).locator('#round-bar-state')).toHaveText(ui('pt-BR', 'round.saved'));
    const save = await readSave(page);
    expect(save.game.round).toBe(2);
    const round1 = fixturesOf(save).filter((f) => f.round === 1);
    expect(round1).toHaveLength(10);
    expect((await readSheetFixtures(page, 1)).sort()).toEqual(round1.map((f) => f.id).sort());

    // (1) O placar é o do save; os gols, um por item, com o minuto e o nome do autor.
    const mine = mineIn(save, 1);
    expect(await boardScore(page)).toEqual(mine.result!.score);
    const items = mineSection(page).locator('ul.column li');
    await expect(items).toHaveCount(mine.result!.goals.length);
    for (const side of ['home', 'away'] as const) {
      const goals = mine
        .result!.goals.filter((g) => g.side === side)
        .sort((a, b) => a.minute - b.minute || (a.added ?? 0) - (b.added ?? 0));
      const list = mineSection(page)
        .locator('ul.column')
        .nth(side === 'home' ? 0 : 1);
      for (const [i, goal] of goals.entries()) {
        const minute = goal.added ? `${goal.minute}+${goal.added}'` : `${goal.minute}'`;
        await expect(list.locator('li').nth(i)).toContainText(minute);
        await expect(list.locator('li').nth(i)).toContainText(displayName(save, goal.scorer));
      }
    }
    if (mine.result!.goals.length === 0) {
      await expect(mineSection(page)).toContainText(ui('pt-BR', 'round.goals.none'));
    }
    // Os 9 outros, na ordem do calendário, com os placares do save.
    const others = round1.filter((f) => f !== mine);
    const cards = othersList(page).locator('li');
    await expect(cards).toHaveCount(9);
    for (const [i, fixture] of others.entries()) {
      await expect(cards.nth(i)).toHaveAttribute('data-fixture', fixture.id);
      const goals = await cards.nth(i).locator('.goals').allInnerTexts();
      expect(goals.map(Number), fixture.id).toEqual(fixture.result!.score);
    }

    // (2) O selo diz o resultado em palavra, coerente com o placar do lado do meu clube, e o
    // nome do h1 tem a mesma palavra.
    const side = mine.homeId === save.career.clubId ? 0 : 1;
    const [home, away] = mine.result!.score;
    const [a, b] = side === 0 ? [home, away] : [away, home];
    const word = a > b ? 'Vitória' : a < b ? 'Derrota' : 'Empate';
    await expect(mineSection(page).locator('.badge')).toHaveText(word);
    await expect(heading).toHaveAccessibleName(new RegExp(`^Rodada 1\\. ${word}\\. `));

    // (3) Tela cheia: nada de navegação nem "Jogar rodada"; a única ação primária é "Continuar".
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0);
    await expect(playButton(page)).toHaveCount(0);
    const primaries = page.locator('.btn.primary:visible');
    await expect(primaries).toHaveCount(1);
    await expect(primaries).toHaveText('Continuar');

    // O placar não é lido de novo (o h1 já diz), mas a linha de mando e estádio é.
    const meta = mineSection(page).locator('.meta');
    await expect(meta).toBeVisible();
    expect(await meta.evaluate((el) => el.closest('[aria-hidden="true"]') === null)).toBe(true);
    expect(
      await mineSection(page)
        .locator('.scoreboard .row')
        .evaluate((el) => el.getAttribute('aria-hidden')),
    ).toBe('true');
    await expect(mineSection(page)).toMatchAriaSnapshot(`
      - region "Meu jogo":
        - heading "Meu jogo" [level=2]
        - paragraph: /(Em casa|Fora de casa) · .+/
    `);

    // (4) Ordem no DOM, alvo de "Continuar" e cards só de leitura.
    const order = await page.evaluate(() => {
      const at = (selector: string) => document.querySelector(selector)!;
      const mineEl = at('section.mine');
      const regions = [...document.querySelectorAll('main.round section.card')];
      const follows = (x: Element, y: Element) =>
        (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      return {
        titles: regions.map((r) => r.querySelector('h2')!.textContent!.trim()),
        tableAfterMine: follows(mineEl, regions[0]!),
        othersAfterTable: follows(regions[0]!, regions[1]!),
      };
    });
    expect(order).toEqual({
      titles: ['Classificação', 'Outros resultados'],
      tableAfterMine: true,
      othersAfterTable: true,
    });
    const box = (await continueButton(page).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(othersList(page).locator('a, button')).toHaveCount(0);
  });

  test('"Continuar" e o voltar devolvem à aba de origem, com o foco no "Jogar rodada"; toque duplo não joga outra (medida 5)', async ({
    page,
  }) => {
    // The page's clock runs as usual until it is paused for the double tap below.
    await page.clock.install();
    await startCareer(page);
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await nav.getByRole('link', { name: 'Elenco' }).click();
    await expect(page).toHaveURL(/#\/squad$/);

    // "Continuar": de volta ao Elenco, com o foco no "Jogar rodada".
    await playButton(page).click();
    await expect(roundHeading(page)).toBeVisible();
    await continueButton(page).click();
    await expect(page).toHaveURL(/#\/squad$/);
    await expect(roundHeading(page)).toHaveCount(0);
    await expect(playButton(page)).toBeFocused();
    await nav.getByRole('link', { name: 'Clube' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Clube' })).toBeVisible();
    expect(await nextRound(page)).toBe(2);

    // O voltar do celular faz o mesmo.
    await nav.getByRole('link', { name: 'Elenco' }).click();
    await page.waitForTimeout(PLAY_GUARD_MS + 50);
    await playButton(page).click();
    await expect(roundHeading(page)).toHaveAccessibleName(/^Rodada 2\. /);
    await page.goBack();
    await expect(page).toHaveURL(/#\/squad$/);
    await expect(roundHeading(page)).toHaveCount(0);
    await expect(playButton(page)).toBeFocused();
    await nav.getByRole('link', { name: 'Clube' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Clube' })).toBeVisible();
    expect(await nextRound(page)).toBe(3);

    // Toque duplo em "Continuar" e um toque logo em seguida no "Jogar rodada": nenhuma rodada nova.
    // O relógio da página fica parado: o toque chega "no mesmo instante", por mais lento que seja
    // o CI, e só o `runFor` faz a janela passar.
    await page.waitForTimeout(PLAY_GUARD_MS + 50);
    await playButton(page).click();
    await expect(roundHeading(page)).toHaveAccessibleName(/^Rodada 3\. /);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
    await continueButton(page).evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });
    await expect(page).toHaveURL(/#\/club$/);
    await expect(playButton(page)).toBeFocused();
    await playButton(page).click();
    // Ignored: a round started would leave the button busy (its timers wait for the clock).
    await expect(playButton(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(roundHeading(page)).toHaveCount(0);
    expect((await readSave(page)).game.round).toBe(4);
    expect(await nextRound(page)).toBe(4);
    // Um instante antes do fim da janela, ainda não joga; passada a janela, o toque joga.
    await page.clock.runFor(PLAY_GUARD_MS - 1);
    await playButton(page).click();
    await expect(playButton(page)).not.toHaveAttribute('aria-busy', 'true');
    expect((await readSave(page)).game.round).toBe(4);
    await page.clock.runFor(1);
    await page.clock.resume();
    await playButton(page).click();
    await expect(roundHeading(page)).toHaveAccessibleName(/^Rodada 4\. /);
  });

  test('uma folha aberta durante o cálculo fecha com o resumo, sem deixar entrada no histórico', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'o menu "Mais opções" só existe no celular');
    // The gzip of the round's sheets waits for a gate: the round stays "computing" meanwhile.
    await page.addInitScript(() => {
      const scope = globalThis as unknown as {
        holdGzip?: Promise<void>;
        CompressionStream: typeof CompressionStream;
      };
      const Original = scope.CompressionStream;
      scope.CompressionStream = function (format: CompressionFormat) {
        const gate = scope.holdGzip;
        const inner = new Original(format);
        if (gate === undefined) return inner;
        const writer = inner.writable.getWriter();
        // A plain writable (a TransformStream nobody reads would never take the input).
        const held = new WritableStream<Uint8Array>({
          async write(chunk) {
            await gate;
            await writer.write(chunk as Uint8Array<ArrayBuffer>);
          },
          async close() {
            await gate;
            await writer.close();
          },
        });
        return { writable: held, readable: inner.readable };
      } as unknown as typeof CompressionStream;
    });
    await startCareer(page);
    const before = await page.evaluate(() => history.length);
    await page.evaluate(() => {
      const scope = globalThis as unknown as { holdGzip?: Promise<void>; release?: () => void };
      scope.holdGzip = new Promise<void>((resolve) => (scope.release = resolve));
    });
    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute('aria-busy', 'true');
    // The "Mais" sheet, opened while the round is computed.
    await page.getByRole('button', { name: 'Mais opções' }).click();
    const sheet = page.getByRole('dialog', { name: 'Mais opções' });
    await expect(sheet).toBeVisible();
    await page.evaluate(() => (globalThis as unknown as { release: () => void }).release());

    // The summary opens alone: the sheet is closed and its entry became the summary's.
    await expect(roundHeading(page)).toBeVisible();
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
    expect(await page.evaluate(() => history.state)).toEqual({ round: true });
    await closeSummary(page);
    await expect(page).toHaveURL(/#\/club$/);
    expect(await page.evaluate(() => history.state?.sheet)).toBeUndefined();
    await expect(sheet).toBeHidden();
    // Back on the tab itself, with the round played.
    expect(await nextRound(page)).toBe(2);
  });

  test('classificação: posição do getStandings; sem variação na rodada 1, e a variação do motor depois (medida 6)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await startCareer(page);
    const position = summary(page).locator('.position');
    const change = summary(page).locator('.change');

    await playButton(page).click();
    await expect(roundHeading(page)).toBeVisible();
    let save = await readSave(page);
    let game = save.game as unknown as GameState;
    const first = getStandings(game, 1).find((r) => r.clubId === save.career.clubId)!;
    await expect(position).toHaveText(`${first.position}º`);
    await expect(change).toHaveCount(0);
    await expect(summary(page).locator('section.card').first().locator('svg')).toHaveCount(0);
    await expect(summary(page)).not.toContainText(/Subiu|Caiu|Mesma posição/);
    await closeSummary(page);

    for (const round of [2, 3]) {
      await playButton(page).click();
      await expect(roundHeading(page)).toHaveAccessibleName(new RegExp(`^Rodada ${round}\\. `));
      save = await readSave(page);
      game = save.game as unknown as GameState;
      const before = getStandings(game, round - 1).find((r) => r.clubId === save.career.clubId)!;
      const after = getStandings(game, round).find((r) => r.clubId === save.career.clubId)!;
      await expect(position).toHaveText(`${after.position}º`);
      await expect(change).toHaveText(changeText(before.position - after.position));
      await expect(change.locator('svg')).toHaveCount(before.position === after.position ? 0 : 1);
      await closeSummary(page);
    }
  });

  test('salvamento automático: depois de 4 rodadas, no máximo 3 versões (medida 7, US-032)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await startCareer(page);
    await playUntil(page, 5);
    expect((await readHeadRecord(page)).round).toBe(5);
    expect(await countSnapshots(page)).toBeLessThanOrEqual(3);
  });

  test.describe('gravação recusada (medida 8)', () => {
    test.beforeEach(async ({ page }) => {
      // The `put` of a snapshot fails with no room, only once switched on (the career is created).
      await page.addInitScript(() => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args) {
          if (
            (globalThis as { failSnapshots?: boolean }).failSnapshots &&
            this.name === 'snapshots'
          ) {
            throw new DOMException('no room', 'QuotaExceededError');
          }
          return put.apply(this, args as Parameters<IDBObjectStore['put']>);
        } as IDBObjectStore['put'];
      });
    });

    test('o resumo abre com o aviso e "Rodada não salva"; "Continuar" volta e o "Jogar rodada" fica bloqueado', async ({
      page,
    }) => {
      await startCareer(page);
      await page.evaluate(() => ((globalThis as { failSnapshots?: boolean }).failSnapshots = true));
      await playButton(page).click();
      await expect(roundHeading(page)).toBeVisible();
      const banner = summary(page).locator('.banner.danger');
      await expect(banner).toContainText(
        ERRORS_PT['save.quota-exceeded.title'] ?? 'save.quota-exceeded.title',
      );
      await expect(banner.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      await expect(summary(page).locator('#round-bar-state')).toHaveText(
        ui('pt-BR', 'round.unsaved'),
      );
      // The head is still round 1: nothing was stored.
      expect((await readHeadRecord(page)).round).toBe(1);
      await continueButton(page).click();
      await expect(page).toHaveURL(/#\/club$/);
      await expect(playButton(page)).toContainText(ui('pt-BR', 'play.blocked.unsaved'));
    });

    test('"Tentar de novo" no resumo grava e a barra passa a "Rodada salva"', async ({ page }) => {
      test.skip(!onPhone(page), 'uma vez por navegador');
      await startCareer(page);
      await page.evaluate(() => ((globalThis as { failSnapshots?: boolean }).failSnapshots = true));
      await playButton(page).click();
      await expect(roundHeading(page)).toBeVisible();
      await page.evaluate(
        () => ((globalThis as { failSnapshots?: boolean }).failSnapshots = false),
      );
      await summary(page).getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(summary(page).locator('#round-bar-state')).toHaveText(
        ui('pt-BR', 'round.saved'),
      );
      await expect(summary(page).locator('.banner')).toHaveCount(0);
      expect((await readHeadRecord(page)).round).toBe(2);
    });
  });

  test('fechar no meio: antes da gravação, nada aplicado; depois, tudo aplicado e abre no Clube (medida 9)', async ({
    page,
    context,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    // The gzip of the round's sheets never ends once switched on: the write never reaches its
    // transaction.
    await context.addInitScript(() => {
      const Original = globalThis.CompressionStream;
      globalThis.CompressionStream = function (format: CompressionFormat) {
        if ((globalThis as { hangGzip?: boolean }).hangGzip) {
          return new TransformStream({ transform: () => new Promise<void>(() => undefined) });
        }
        return new Original(format);
      } as unknown as typeof CompressionStream;
    });
    await startCareer(page);
    const before = await readSave(page);
    expect(before.game.round).toBe(1);

    // (a) Closed before the write: round 1, nothing of it anywhere.
    await page.evaluate(() => ((globalThis as { hangGzip?: boolean }).hangGzip = true));
    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute('aria-busy', 'true');
    await page.close();
    const second = await context.newPage();
    await continueCareer(second);
    const reopened = await readSave(second);
    expect(reopened.game.round).toBe(1);
    expect(fixturesOf(reopened).filter((f) => f.result != null)).toEqual([]);
    expect(await readSheetFixtures(second, 1)).toEqual([]);
    expect(reopened.game).toEqual(before.game);
    expect(await nextRound(second)).toBe(1);

    // (b) Closed after the write, before "Continuar": opens on the Clube, round 2, all applied.
    await playButton(second).click();
    await expect(roundHeading(second)).toBeVisible();
    await expect.poll(async () => (await readHeadRecord(second)).round).toBe(2);
    const shownScore = await boardScore(second);
    await second.close();
    const third = await context.newPage();
    await continueCareer(third);
    await expect(third).toHaveURL(/#\/club$/);
    await expect(roundHeading(third)).toHaveCount(0);
    expect(await nextRound(third)).toBe(2);
    const stored = await readSave(third);
    expect(stored.game.round).toBe(2);
    const round1 = fixturesOf(stored).filter((f) => f.round === 1);
    expect(round1.filter((f) => f.result != null)).toHaveLength(10);
    expect((await readSheetFixtures(third, 1)).sort()).toEqual(round1.map((f) => f.id).sort());
    // Never an intermediate state: only round 1 has results.
    expect(fixturesOf(stored).filter((f) => f.result != null && f.round !== 1)).toEqual([]);

    // Playing again after (a) gave the score the engine gives that same state (deterministic).
    const replay = playEngineRound(before.game as unknown as GameState, gameParams(), {
      round: 1,
      sheets: {},
      commands: {},
      fanDecisions: {},
      coaches: {
        [before.career.clubId]: (before.career as unknown as { matchMode: 'result' }).matchMode,
      },
    });
    if (!replay.ok) throw new Error(replay.error);
    const expected = replay.value.state.fixtures.filter((f) => f.round === 1);
    for (const fixture of expected) {
      const got = round1.find((f) => f.id === fixture.id)!;
      expect(got.result!.score, fixture.id).toEqual(fixture.result!.score);
    }
    expect(shownScore).toEqual(mineIn(stored, 1).result!.score);
  });

  test('desempenho: do toque ao h1 do resumo, p90 de 10 rodadas ≤ 500 ms com CPU 4× (medida 10)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium' || !onPhone(page), 'CDP; uma vez');
    await startCareer(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      times.push(
        await page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              const button = [...document.querySelectorAll<HTMLElement>('button.play')].find(
                (b) => b.getClientRects().length > 0,
              )!;
              const start = performance.now();
              const check = () => {
                const title = document.getElementById('round-title');
                if (title !== null && title.getClientRects().length > 0) {
                  requestAnimationFrame(() => resolve(performance.now() - start));
                } else requestAnimationFrame(check);
              };
              button.click();
              requestAnimationFrame(check);
            }),
        ),
      );
      await closeSummary(page);
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const sorted = [...times].sort((a, b) => a - b);
    const p90 = sorted[Math.ceil(0.9 * sorted.length) - 1]!;
    console.log(
      `rodada até o resumo (ms, CPU 4×): ${sorted.map((t) => t.toFixed(0)).join(' ')}; p90 ${p90.toFixed(0)}`,
    );
    expect(p90).toBeLessThanOrEqual(500);
  });

  test('sem rolagem lateral em 360, 390, 844 e 1280, em pt-BR, es e en, nos temas noite e dia (medida 11)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await startCareer(page);
    for (const lang of ['pt-BR', 'es', 'en'] as const) {
      if (lang !== 'pt-BR') await reopenIn(page, lang);
      await playIn(page, lang).click();
      await expect(roundHeading(page)).toBeVisible();
      for (const theme of ['noite', 'dia'] as const) {
        await setTheme(page, theme);
        for (const [width, height] of [
          [360, 740],
          [390, 844],
          [844, 390],
          [1280, 800],
        ] as const) {
          await page.setViewportSize({ width, height });
          const scroll = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
          }));
          expect(scroll.scroll, `${lang} ${theme} ${width}`).toBeLessThanOrEqual(scroll.client);
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await closeSummary(page, ui(lang, 'round.continue'));
    }
  });

  test('textos cabem a 360×740 em es e en, com o clube de nome curto mais longo (medida 12)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await page.setViewportSize({ width: 360, height: 740 });
    await startWith(page, 'Inter-Regional');
    for (const lang of ['es', 'en'] as const) {
      await reopenIn(page, lang);
      await playIn(page, lang).click();
      await expect(roundHeading(page)).toBeVisible();
      await expect(mineSection(page)).toContainText('Inter-Regional');
      const lines = await page.evaluate(() => {
        const count = (el: Element) => {
          const style = getComputedStyle(el);
          return Math.round(el.getBoundingClientRect().height / parseFloat(style.lineHeight));
        };
        const names = [...document.querySelectorAll('main.round .name')];
        return {
          title: count(document.getElementById('round-title')!),
          continue: count(document.querySelector('main.round .btn.primary .label')!),
          state: count(document.querySelector('#round-bar-state .body')!),
          boardNames: Math.max(
            ...[...document.querySelectorAll('main.round .scoreboard .name')].map(count),
          ),
          cut: names
            .filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth)
            .map((el) => el.textContent),
        };
      });
      expect(lines.title, `${lang}: h1 em 1 linha`).toBe(1);
      expect(lines.continue, `${lang}: "Continuar" em 1 linha`).toBe(1);
      expect(lines.state, `${lang}: estado da barra em até 2 linhas`).toBeLessThanOrEqual(2);
      expect(lines.boardNames, `${lang}: nomes do placar em até 2 linhas`).toBeLessThanOrEqual(2);
      expect(lines.cut, `${lang}: nomes cortados`).toEqual([]);
      await closeSummary(page, ui(lang, 'round.continue'));
    }
  });

  test('deitado (844×390): "Continuar" inteiro na janela e o placar com no máximo ~100 px (medida 13)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await page.setViewportSize({ width: 844, height: 390 });
    await startCareer(page);
    await playButton(page).click();
    await expect(roundHeading(page)).toBeVisible();
    const button = (await continueButton(page).boundingBox())!;
    expect(button.x).toBeGreaterThanOrEqual(0);
    expect(button.y).toBeGreaterThanOrEqual(0);
    expect(button.x + button.width).toBeLessThanOrEqual(844);
    expect(button.y + button.height).toBeLessThanOrEqual(390);
    const board = (await mineSection(page).locator('.scoreboard').boundingBox())!;
    expect(board.height).toBeLessThanOrEqual(100);
    // "Outros resultados" em duas colunas (a lista passa de 480px).
    const xs = await othersList(page)
      .locator('li')
      .evaluateAll((items) => items.map((li) => Math.round(li.getBoundingClientRect().x)));
    expect(new Set(xs).size).toBe(2);
  });

  test('desktop (1280×800): sem barra lateral, coluna até layout-content-max, outros em duas colunas (medida 14)', async ({
    page,
  }) => {
    test.skip(onPhone(page), 'só no desktop');
    await startCareer(page);
    await playButton(page).click();
    await expect(roundHeading(page)).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const { column, max } = await page.evaluate(() => ({
      column: document.querySelector('main.round > .content')!.getBoundingClientRect().width,
      max: parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--layout-content-max'),
      ),
    }));
    expect(max).toBeGreaterThan(0);
    expect(column).toBeLessThanOrEqual(max);
    const xs = await othersList(page)
      .locator('li')
      .evaluateAll((items) => items.map((li) => Math.round(li.getBoundingClientRect().x)));
    expect(new Set(xs).size).toBe(2);
    // The bar at the foot of the column, inside it.
    const bar = (await page.locator('main.round .bar').boundingBox())!;
    const content = (await page.locator('main.round > .content').boundingBox())!;
    expect(bar.x).toBeGreaterThanOrEqual(content.x - 1);
    expect(bar.x + bar.width).toBeLessThanOrEqual(content.x + content.width + 1);
  });

  test('movimento: com movimento reduzido, nenhuma animação no resumo (medida 15)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startCareer(page);
    await playButton(page).click();
    await expect(roundHeading(page)).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('"avançar" até o resumo mostra a última rodada sem jogar outra; reabrir abre no Clube (decisão 3)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await startCareer(page);
    await playRound(page);
    // Forward to the summary's entry: the last round played, and nothing is played again.
    await page.goForward();
    await expect(roundHeading(page)).toHaveAccessibleName(/^Rodada 1\. /);
    expect((await readSave(page)).game.round).toBe(2);
    await closeSummary(page);
    expect(await nextRound(page)).toBe(2);
    await playRound(page);
    // Closed with the round stored: opens on the Clube, no summary again.
    await page.reload();
    await continueCareer(page);
    await expect(page).toHaveURL(/#\/club$/);
    await expect(roundHeading(page)).toHaveCount(0);
    expect(await nextRound(page)).toBe(3);
  });
});
