import type { Page } from '@playwright/test';
import { matchSheet, type MatchEvent } from '../../app/src/engine/index.ts';
import { matchSteps } from '../../app/src/ui/match/steps.ts';
import { MATCH_TIMING } from '../../app/src/ui/match/timing.ts';
import {
  closeSummary,
  continueCareer,
  nextRound,
  playUntil,
  reopenIn,
  roundHeading,
} from './career.ts';
import { setTheme } from './css.ts';
import { expect, playButton, test } from './fixtures.ts';
import {
  board,
  careerWith,
  control,
  freezeClock,
  goalsOf,
  line,
  lines,
  liveRegion,
  lively,
  matchScreen,
  minuteText,
  onPhone,
  openMatch,
  playToEnd,
  runToMinute,
  runUntil,
  shownScore,
  timeTo,
  ui,
} from './match-helpers.ts';
import { readHeadRecord, readMatchSheets, readSave } from './save.ts';

/*
 * A partida narrada (T-032; docs/design/telas/partida.md, "Medidas para o E2E", T-032; US-020 e
 * US-019, cenários 2 e 4). Cada teste diz as medidas que cobre. O relógio da partida corre pelo
 * relógio falso do Playwright (`page.clock`), sem nenhuma velocidade especial de teste no jogo. A
 * carreira de teste é a do Novo jogo (Completo, rodada 1) com o tipo de partida e a semente
 * ajustados no save: a semente é escolhida no Node, pelo próprio motor, para a partida do técnico
 * ter o lance que o teste precisa (um gol, um pênalti...). A partida esperada é calculada no Node
 * como o `CareerService.liveMatch` a calcula (o auxiliar no comando, `'result'`, sem ficha na
 * rodada 1), e os passos do relógio são os da própria tela (`ui/match/steps.ts`).
 */

/**
 * Estraga o snapshot da cabeça da carreira mais recente (o SHA-256 deixa de bater): ao abrir, a
 * carreira volta ao snapshot anterior, a rodada 1 ainda por jogar (US-032).
 */
async function corruptHead(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('prancheta-test');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    const ask = <T>(request: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const careers = (await ask(db.transaction('careers').objectStore('careers').getAll())) as {
      id: string;
      headSeq: number;
      updatedAt: string;
    }[];
    const newest = careers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
    const key = [newest.id, newest.headSeq];
    const record = (await ask(
      db.transaction('snapshots').objectStore('snapshots').get(key),
    )) as Record<string, unknown>;
    const tx = db.transaction('snapshots', 'readwrite');
    await ask(tx.objectStore('snapshots').put({ ...record, sha256: '0'.repeat(64) }));
    db.close();
  });
}

test.describe('Partida narrada (T-032)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
  });

  test('seletor no "Jogar rodada": o tipo atual, a folha com 3 cartas, a escolha só vale ao jogar (medida 1; T-085: "Animada completa" primeiro)', async ({
    page,
  }) => {
    await careerWith(page, 'highlights');
    const segment = page.getByRole('button', {
      name: ui('pt-BR', 'play.mode.open', { mode: ui('pt-BR', 'newGame.match.highlights') }),
    });
    await expect(segment).toHaveCount(1);
    await expect(segment).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(playButton(page)).toContainText(ui('pt-BR', 'newGame.match.highlights'));

    // Fechar a folha sem jogar não muda nada.
    await segment.click();
    const sheet = page.getByRole('dialog', { name: ui('pt-BR', 'play.mode.title') });
    await expect(sheet).toBeVisible();
    // Since T-085 the three modes, "Animada completa" first (partida.md, "Tipos oferecidos").
    await expect(sheet.getByRole('radio')).toHaveCount(3);
    await expect(sheet.getByRole('radio').first()).toHaveAccessibleName(
      new RegExp(`^${ui('pt-BR', 'newGame.match.full')}`),
    );
    await expect(sheet.getByRole('radio', { name: /Só lances principais/ })).toBeChecked();
    await expect(sheet.getByText(ui('pt-BR', 'play.mode.note'))).toBeVisible();
    await sheet.getByRole('radio', { name: /Só resultado/ }).check();
    await sheet.getByRole('button', { name: ui('pt-BR', 'nav.close') }).click();
    await expect(sheet).toHaveCount(0);
    await expect(playButton(page)).toContainText(ui('pt-BR', 'newGame.match.highlights'));
    expect((await readSave(page)).career).toMatchObject({ matchMode: 'highlights' });

    // Escolher "Só resultado" e jogar na folha: o resumo direto, e o tipo gravado com a rodada.
    await segment.click();
    await sheet.getByRole('radio', { name: /Só resultado/ }).check();
    await freezeClock(page);
    await sheet.getByRole('button', { name: ui('pt-BR', 'play.label') }).click();
    await runUntil(page, async () => (await roundHeading(page).count()) === 1);
    await expect(matchScreen(page)).toHaveCount(0);
    await page.clock.resume();
    await closeSummary(page);
    await expect(playButton(page)).toContainText(ui('pt-BR', 'newGame.match.result'));
    expect((await readSave(page)).career).toMatchObject({ matchMode: 'result' });
    expect(await nextRound(page)).toBe(2);
  });

  test('abre a partida: #/match, "Rodada 1", sem navegação nem "Jogar rodada", 0 × 0 no 0\' (medida 2)', async ({
    page,
  }) => {
    await careerWith(page, 'highlights');
    await freezeClock(page);
    await openMatch(page);
    await expect(page).toHaveURL(/#\/match$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Rodada 1' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Rodada 1' })).toBeFocused();
    await expect(page.getByRole('navigation', { name: ui('pt-BR', 'nav.label') })).toHaveCount(0);
    await expect(playButton(page)).toHaveCount(0);
    expect(await shownScore(page)).toEqual([0, 0]);
    expect(await minuteText(page)).toBe("0'");
    await expect(board(page).locator('.live .phase')).toHaveText(ui('pt-BR', 'match.phase.first'));
    await expect(lines(page)).toHaveCount(1);
    await expect(lines(page).first()).toContainText(ui('pt-BR', 'match.live.kickoff'));
  });

  test('a narração reflete os eventos e o placar final é o do motor, na "Animada completa" (medida 3)', async ({
    page,
  }) => {
    const { save, expected } = await careerWith(
      page,
      'full',
      (r) =>
        lively(r) &&
        r.events.some((e) => e.type === 'injury' || e.type === 'red' || e.type === 'penaltyMissed'),
    );
    await freezeClock(page);
    await openMatch(page);
    await playToEnd(page);
    const name = (id: string) =>
      (save.game.players[id] as { name: { display: string } }).name.display;
    const minuteOf = (e: { minute: number; added?: number }) =>
      e.added === undefined ? `${e.minute}'` : `${e.minute}+${e.added}'`;
    // The stored sheet is the engine's for this match: the screen showed what was recorded.
    const sheets = await readMatchSheets(page, 1);
    expect(sheets[expected.fixtureId]).toEqual(
      JSON.parse(JSON.stringify(matchSheet(expected.result))),
    );
    const sheetEvents = expected.result.events.filter((e) =>
      ['goal', 'penaltyMissed', 'yellow', 'red', 'injury', 'substitution'].includes(e.type),
    );
    expect(sheetEvents.length).toBeGreaterThan(3);
    for (const event of sheetEvents) {
      const index = expected.result.events.indexOf(event);
      const id =
        event.type === 'goal' && event.kind === 'penalty'
          ? `e${index - 1}`
          : event.type === 'penaltyMissed'
            ? `e${index - 1}`
            : `e${index}`;
      const row = line(page, id);
      await expect(row.locator('.minute'), `${event.type} ${id}`).toHaveText(minuteOf(event));
      const who =
        event.type === 'goal'
          ? event.scorer
          : event.type === 'penaltyMissed'
            ? event.taker
            : event.type === 'substitution'
              ? event.in
              : 'player' in event
                ? event.player
                : undefined;
      if (who !== undefined) await expect(row).toContainText(name(who));
    }
    expect(await shownScore(page)).toEqual(expected.result.score);
    const stored = (await readSave(page)).game.fixtures as unknown as {
      id: string;
      result?: { score: [number, number] };
    }[];
    expect(stored.find((f) => f.id === expected.fixtureId)!.result!.score).toEqual(
      expected.result.score,
    );
  });

  test('"Só lances principais": só gol, chance clara, pênalti, vermelho, lesão e as fases (medida 4)', async ({
    page,
  }) => {
    const { expected } = await careerWith(page, 'highlights');
    await freezeClock(page);
    await openMatch(page);
    await playToEnd(page);
    const allowed = new Set(
      [
        'report.event.goal',
        'report.event.penaltyMissed',
        'report.event.red',
        'report.event.redSecondYellow',
        'report.event.injury',
        'match.live.shot',
        'match.live.freeKick',
        'match.live.penalty',
        'match.live.kickoff',
        'match.live.halftime',
        'match.live.secondHalf',
        'match.live.fulltime',
        'match.live.stoppage.none',
      ].map((key) => ui('pt-BR', key)),
    );
    const kinds = await lines(page).locator('.kind').allInnerTexts();
    for (const kind of kinds) {
      expect(allowed.has(kind) || /^Acréscimo: \d+ minutos?$/.test(kind), kind).toBe(true);
    }
    for (const word of ['report.event.yellow', 'report.event.sub', 'match.live.tactic']) {
      expect(kinds).not.toContain(ui('pt-BR', word));
    }
    const strong = expected.result.events.filter(
      (e) =>
        e.type !== 'halftimeTalk' &&
        (e.importance >= 2 || ['kickoff', 'stoppage'].includes(e.type)),
    );
    // A penalty and its outcome share a line; the 2nd half has one of its own.
    const paired = expected.result.events.filter((e) => e.type === 'penaltyAwarded').length;
    expect(kinds).toHaveLength(strong.length - paired + 1);
  });

  test('a mesma partida em "Animada completa", "Só lances principais" e "Só resultado" grava a mesma súmula (medida 5)', async ({
    page,
  }) => {
    const { expected } = await careerWith(page, 'full');
    const sheets: unknown[] = [];
    const scores: unknown[] = [];
    for (const mode of ['full', 'highlights', 'result'] as const) {
      if (mode !== 'full') {
        // Back to the same round 1 (the snapshot before it), and the other mode in the selector.
        await page.clock.resume();
        await corruptHead(page);
        await continueCareer(page);
        expect(await nextRound(page)).toBe(1);
        await page.getByRole('button', { name: /^Mudar o tipo de partida/ }).click();
        const sheet = page.getByRole('dialog', { name: ui('pt-BR', 'play.mode.title') });
        await sheet
          .getByRole('radio', { name: new RegExp(ui('pt-BR', `newGame.match.${mode}`)) })
          .check();
        await freezeClock(page);
        await sheet.getByRole('button', { name: ui('pt-BR', 'play.label') }).click();
      } else {
        await freezeClock(page);
        await playButton(page).click();
      }
      if (mode !== 'result') {
        await runUntil(page, async () => (await matchScreen(page).count()) === 1, { step: 20 });
        await expect(matchScreen(page)).toHaveAttribute('data-mode', mode);
        await control(page, 'match.skip').click();
      }
      await runUntil(page, async () => (await roundHeading(page).count()) === 1);
      const stored = await readSave(page);
      const fixture = (stored.game.fixtures as unknown as { id: string; result?: unknown }[]).find(
        (f) => f.id === expected.fixtureId,
      )!;
      scores.push(fixture.result);
      sheets.push((await readMatchSheets(page, 1))[expected.fixtureId]);
      await page.clock.resume();
      await closeSummary(page);
    }
    expect(sheets[1]).toEqual(sheets[0]);
    expect(sheets[2]).toEqual(sheets[0]);
    expect(scores[1]).toEqual(scores[0]);
    expect(scores[2]).toEqual(scores[0]);
    expect(sheets[0]).toEqual(JSON.parse(JSON.stringify(matchSheet(expected.result))));
  });

  test('pausa dramática: o começo do gol sem "Gol" nem placar; depois da pausa, "Gol", o placar e o anúncio (medida 6)', async ({
    page,
  }) => {
    const { expected } = await careerWith(page, 'highlights');
    const steps = matchSteps(expected.result.events, 'highlights');
    const goal = goalsOf(expected.result).find((g) => g.kind === 'open')!;
    const id = `e${expected.result.events.indexOf(goal)}`;
    const build = steps.findIndex((s) => s.line?.id === id && s.line.stage === 'build');
    const before: [number, number] =
      goal.side === 'home'
        ? [goal.score[0] - 1, goal.score[1]]
        : [goal.score[0], goal.score[1] - 1];
    await freezeClock(page);
    await openMatch(page);
    await page.clock.runFor(Math.max(0, timeTo(steps, build) - 600));
    await runUntil(page, async () => (await line(page, id).count()) === 1, {
      step: 50,
      max: 2_000,
    });
    const word = ui('pt-BR', 'report.event.goal');
    await expect(line(page, id).locator('.kind')).not.toHaveText(word);
    await expect(line(page, id)).toContainText('...');
    expect(await shownScore(page)).toEqual(before);
    const sentence = await liveRegion(page).textContent();
    await page.clock.runFor(MATCH_TIMING.normal.drama - 200);
    await expect(line(page, id).locator('.kind')).not.toHaveText(word);
    expect(await shownScore(page)).toEqual(before);
    expect(await liveRegion(page).textContent()).toBe(sentence);
    await page.clock.runFor(400);
    await expect(line(page, id).locator('.kind')).toHaveText(word);
    expect(await shownScore(page)).toEqual([...goal.score]);
    await expect(liveRegion(page)).toContainText(word);
    await expect(line(page, id)).toHaveClass(/goal/);
  });

  test('Pausar para entre dois minutos; a página escondida pausa e continua pausada (medida 7)', async ({
    page,
  }) => {
    await careerWith(page, 'highlights');
    await freezeClock(page);
    await openMatch(page);
    await runToMinute(page, 5);
    await control(page, 'match.pause').click();
    await expect(control(page, 'match.resume')).toBeVisible();
    const paused = board(page)
      .getByText(ui('pt-BR', 'match.paused'), { exact: true })
      .filter({ visible: true });
    await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });
    const minute = await minuteText(page);
    await page.clock.runFor(10_000);
    expect(await minuteText(page)).toBe(minute);
    await expect(paused).toBeVisible();
    await control(page, 'match.resume').click();
    await expect(paused).toHaveCount(0);
    // A goal holds the minute still (drama + afterGoal), so wait for it to move.
    await runUntil(page, async () => (await minuteText(page)) !== minute, {
      step: 100,
      max: 8_000,
    });
    expect(await minuteText(page)).not.toBe(minute);

    // The page hidden (another app, the screen off): paused; back, still paused.
    const visibility = (state: 'hidden' | 'visible') =>
      page.evaluate((value) => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => value,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await visibility('hidden');
    await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });
    await visibility('visible');
    const still = await minuteText(page);
    await page.clock.runFor(10_000);
    expect(await minuteText(page)).toBe(still);
    await expect(control(page, 'match.resume')).toBeVisible();
  });

  test("Pular no 10': o resumo com o placar do save; o voltar leva à aba, nunca à partida (medida 8)", async ({
    page,
  }) => {
    const { expected } = await careerWith(page, 'highlights');
    await freezeClock(page);
    await openMatch(page);
    await runToMinute(page, 10);
    await control(page, 'match.skip').click();
    await runUntil(page, async () => (await roundHeading(page).count()) === 1);
    await expect(page).toHaveURL(/#\/round$/);
    const stored = (await readSave(page)).game.fixtures as unknown as {
      id: string;
      result?: { score: [number, number] };
    }[];
    expect(stored.find((f) => f.id === expected.fixtureId)!.result!.score).toEqual(
      expected.result.score,
    );
    await expect(roundHeading(page)).toHaveAccessibleName(
      new RegExp(`${expected.result.score[0]}.*${expected.result.score[1]}`),
    );
    await page.goBack();
    await expect(page).toHaveURL(/#\/club$/);
    await expect(matchScreen(page)).toHaveCount(0);
    await expect(roundHeading(page)).toHaveCount(0);
    await expect(playButton(page)).toBeVisible();
  });

  test('fim de jogo: a gravação começa sozinha; a rodada 2 já gravada antes do "Ver resumo" (medida 9)', async ({
    page,
  }) => {
    await careerWith(page, 'highlights');
    await freezeClock(page);
    await openMatch(page);
    await playToEnd(page);
    await expect(board(page).locator('.live .phase')).toHaveText(ui('pt-BR', 'match.phase.end'));
    await expect(matchScreen(page).getByText(ui('pt-BR', 'round.saved'))).toBeVisible();
    await expect(control(page, 'match.pause')).toHaveCount(0);
    expect((await readHeadRecord(page)).round).toBe(2);
    await control(page, 'match.toSummary').click();
    await expect(roundHeading(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/round$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/club$/);
    await expect(matchScreen(page)).toHaveCount(0);
    await expect(playButton(page)).toBeVisible();
  });

  test("voltar do celular no 20': pausa e pergunta; continuar volta à partida; pular abre o resumo (medida 10)", async ({
    page,
  }) => {
    await careerWith(page, 'highlights');
    await freezeClock(page);
    await openMatch(page);
    await runToMinute(page, 20);
    await page.goBack();
    const sheet = page.getByRole('dialog', { name: ui('pt-BR', 'match.leave.title') });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(ui('pt-BR', 'match.leave.body'))).toBeVisible();
    await expect(page).toHaveURL(/#\/match$/);
    const paused = board(page)
      .getByText(ui('pt-BR', 'match.paused'), { exact: true })
      .filter({ visible: true });
    await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });
    // No "sair sem jogar": only the two ways of the spec.
    await expect(sheet.getByRole('button')).toHaveText(
      [
        ui('pt-BR', 'nav.close'),
        ui('pt-BR', 'match.leave.skip'),
        ui('pt-BR', 'match.leave.stay'),
      ].map((text) => (text === ui('pt-BR', 'nav.close') ? '' : text)),
    );
    await sheet.getByRole('button', { name: ui('pt-BR', 'match.leave.stay') }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/match$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Rodada 1' })).toBeFocused();
    const minute = await minuteText(page);
    // A goal holds the minute still (drama + afterGoal), so wait for it to move.
    await runUntil(page, async () => (await minuteText(page)) !== minute, {
      step: 100,
      max: 8_000,
    });
    expect(await minuteText(page)).not.toBe(minute);

    // Back again, then the back of the sheet itself: the sheet closes, the match stays paused.
    await page.goBack();
    await expect(sheet).toBeVisible();
    await page.goBack();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/match$/);
    await runUntil(page, async () => (await paused.count()) === 1, { step: 100, max: 8_000 });

    await page.goBack();
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: ui('pt-BR', 'match.leave.skip') }).click();
    await runUntil(page, async () => (await roundHeading(page).count()) === 1);
    await expect(page).toHaveURL(/#\/round$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/club$/);
    await expect(playButton(page)).toBeVisible();
  });

  test("fechar no 30' e reabrir: nada aplicado, e jogar de novo dá o mesmo placar (medida 11)", async ({
    page,
    context,
  }) => {
    const { expected } = await careerWith(page, 'highlights');
    await freezeClock(page);
    await openMatch(page);
    await runToMinute(page, 30);
    await page.clock.resume();
    await page.close();
    const again = await context.newPage();
    await continueCareer(again);
    await expect(again).toHaveURL(/#\/club$/);
    const stored = await readSave(again);
    expect(stored.game.round).toBe(1);
    const round1 = (
      stored.game.fixtures as unknown as { round: number; result?: unknown }[]
    ).filter((f) => f.round === 1);
    expect(round1.filter((f) => f.result != null)).toEqual([]);
    expect(await readMatchSheets(again, 1)).toEqual({});
    expect(await nextRound(again)).toBe(1);
    await freezeClock(again);
    await openMatch(again);
    await playToEnd(again);
    expect(await shownScore(again)).toEqual(expected.result.score);
  });

  test('leitor de tela: uma frase por gol, pênalti, pênalti perdido, vermelho, intervalo e fim; nada mais (medida 12)', async ({
    page,
  }) => {
    const { save, expected } = await careerWith(
      page,
      'highlights',
      (r) => lively(r) && r.events.some((e) => e.type === 'penaltyAwarded'),
    );
    await freezeClock(page);
    await openMatch(page);
    await page.evaluate(() => {
      const region = document.querySelector('main.match [aria-live="polite"]')!;
      const heard: string[] = [];
      (window as unknown as { heard: string[] }).heard = heard;
      let last = region.textContent ?? '';
      new MutationObserver(() => {
        const text = region.textContent ?? '';
        if (text !== '' && text !== last) heard.push(text);
        last = text;
      }).observe(region, { childList: true, characterData: true, subtree: true });
    });
    const summaryButton = control(page, 'match.toSummary');
    await runUntil(page, async () => (await summaryButton.count()) === 1, { step: 100 });
    const heard = await page.evaluate(() => (window as unknown as { heard: string[] }).heard);

    const short = (id: string) => save.game.clubs[id]!.def.shortName;
    const club = (side: 'home' | 'away') =>
      short(side === 'home' ? expected.homeId : expected.awayId);
    const name = (id: string) =>
      (save.game.players[id] as { name: { display: string } }).name.display;
    const scoreVars = (score: readonly [number, number]) => ({
      home: short(expected.homeId),
      homeGoals: score[0],
      away: short(expected.awayId),
      awayGoals: score[1],
    });
    const words = (e: { minute: number; added?: number }) =>
      e.added === undefined
        ? ui('pt-BR', 'match.minute.a11y', { minute: e.minute })
        : ui('pt-BR', 'match.minuteAdded.a11y', { minute: e.minute, added: e.added });
    const sentences = expected.result.events.flatMap((e): string[] => {
      switch (e.type) {
        case 'goal':
          return [
            ui('pt-BR', 'match.live.goal.a11y', {
              club: club(e.side),
              player: name(e.scorer),
              minute: words(e),
              ...scoreVars(e.score),
            }),
          ];
        case 'penaltyAwarded':
          return [
            ui('pt-BR', 'match.live.penalty.a11y', { club: club(e.side), player: name(e.taker) }),
          ];
        case 'penaltyMissed':
          return [
            ui('pt-BR', 'match.live.penaltyMissed.a11y', {
              club: club(e.side),
              player: name(e.taker),
            }),
          ];
        case 'red':
          return [
            ui('pt-BR', 'match.live.red.a11y', { club: club(e.side), player: name(e.player) }),
          ];
        case 'halftime':
          return [ui('pt-BR', 'match.live.halftime.a11y', scoreVars(e.score))];
        case 'fulltime':
          return [ui('pt-BR', 'match.live.fulltime.a11y', scoreVars(e.score))];
        default:
          return [];
      }
    });
    expect(heard).toEqual(sentences);
  });

  test('movimento reduzido: nenhuma animação, e a pausa dramática continua (medida 13)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { expected } = await careerWith(page, 'highlights');
    const steps = matchSteps(expected.result.events, 'highlights');
    const goal = goalsOf(expected.result).find((g) => g.kind === 'open')!;
    const id = `e${expected.result.events.indexOf(goal)}`;
    const build = steps.findIndex((s) => s.line?.id === id && s.line.stage === 'build');
    await freezeClock(page);
    await openMatch(page);
    const animations = () => page.evaluate(() => document.getAnimations().length);
    expect(await animations()).toBe(0);
    await page.clock.runFor(Math.max(0, timeTo(steps, build) - 600));
    expect(await animations()).toBe(0);
    await runUntil(page, async () => (await line(page, id).count()) === 1, {
      step: 50,
      max: 2_000,
    });
    const before = await shownScore(page);
    await page.clock.runFor(MATCH_TIMING.normal.drama - 200);
    expect(await shownScore(page)).toEqual(before);
    expect(await animations()).toBe(0);
    await page.clock.runFor(400);
    expect(await shownScore(page)).toEqual([...goal.score]);
    expect(await animations()).toBe(0);
    await control(page, 'match.pause').click();
    expect(await animations()).toBe(0);
  });

  test('alvos de 44px e a barra numa linha a 360×740 em pt, es e en, nos quatro estados; nome longo inteiro (medida 14)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await page.setViewportSize({ width: 360, height: 740 });
    await careerWith(page, 'highlights', lively, 'Inter-Regional');
    for (const lang of ['pt-BR', 'es', 'en'] as const) {
      if (lang !== 'pt-BR') {
        await page.clock.resume();
        await reopenIn(page, lang);
      }
      const segment = page.getByRole('button', {
        name: ui(lang, 'play.mode.open', { mode: ui(lang, 'newGame.match.highlights') }),
      });
      const seg = (await segment.boundingBox())!;
      expect(seg.width, `${lang} segment`).toBeGreaterThanOrEqual(44);
      expect(seg.height, `${lang} segment`).toBeGreaterThanOrEqual(44);
      await freezeClock(page);
      await openMatch(page, lang);
      const toggleOf = (resumed: boolean) =>
        control(page, resumed ? 'match.resume' : 'match.pause', lang);
      const fast = control(page, 'match.fast', lang);
      const skip = control(page, 'match.skip', lang);
      const widths: { toggle: number[]; fast: number[] } = { toggle: [], fast: [] };
      const measure = async (resumed: boolean, label: string) => {
        const boxes = await Promise.all(
          [toggleOf(resumed), fast, skip].map((b) => b.boundingBox()),
        );
        for (const box of boxes) {
          expect(box!.width, `${lang} ${label}`).toBeGreaterThanOrEqual(44);
          expect(box!.height, `${lang} ${label}`).toBeGreaterThanOrEqual(44);
          expect(box!.x + box!.width, `${lang} ${label}: inside the window`).toBeLessThanOrEqual(
            360,
          );
          expect(Math.abs(box!.y - boxes[0]!.y), `${lang} ${label}: one line`).toBeLessThanOrEqual(
            1,
          );
          expect(Math.abs(box!.height - boxes[0]!.height), `${lang} ${label}`).toBeLessThanOrEqual(
            1,
          );
        }
        widths.toggle.push(boxes[0]!.width);
        widths.fast.push(boxes[1]!.width);
        const scroll = await page.evaluate(() => ({
          h: document.documentElement.scrollHeight - document.documentElement.clientHeight,
          w: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
        expect(scroll, `${lang} ${label}: no scroll`).toEqual({ h: 0, w: 0 });
      };
      await measure(false, 'running, normal');
      await fast.click();
      await expect(fast).toHaveAttribute('aria-pressed', 'true');
      await measure(false, 'running, fast');
      await toggleOf(false).click();
      await measure(true, 'paused, fast');
      await fast.click();
      await expect(fast).toHaveAttribute('aria-pressed', 'false');
      await measure(true, 'paused, normal');
      expect(new Set(widths.toggle.map(Math.round)).size, `${lang}: Pausar = Retomar`).toBe(1);
      expect(new Set(widths.fast.map(Math.round)).size, `${lang}: Rápido on = off`).toBe(1);
      // The names of the board break, never cut (the longest short name of the clubs).
      const cut = await board(page)
        .locator('.name')
        .evaluateAll((names) => names.filter((n) => n.scrollWidth > n.clientWidth).length);
      expect(cut, `${lang}: a name cut on the board`).toBe(0);
      await expect(board(page)).toContainText('Inter-Regional');

      await toggleOf(true).click();
      await playToEnd(page, lang);
      const summary = (await control(page, 'match.toSummary', lang).boundingBox())!;
      expect(summary.height, `${lang}: "Ver resumo" in one line`).toBeLessThanOrEqual(50);
      expect(summary.width).toBeGreaterThanOrEqual(44);
      expect(summary.x + summary.width).toBeLessThanOrEqual(360);
      await control(page, 'match.toSummary', lang).click();
      await page.clock.resume();
      await closeSummary(page, ui(lang, 'round.continue'));
    }
  });

  test('sem rolagem lateral em 360, 390, 844 e 1280, com a partida e com a folha do seletor, em pt-BR, es e en (medida 15)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await careerWith(page, 'highlights');
    const sizes = [
      [360, 740],
      [390, 844],
      [844, 390],
      [1280, 800],
    ] as const;
    const noSideScroll = async (label: string) => {
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        // The pitch measure arrives in a real task after the resize: poll, do not read once.
        await expect
          .poll(
            () =>
              page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
              ),
            { message: `${label} ${width}` },
          )
          .toBeLessThanOrEqual(0);
      }
      await page.setViewportSize({ width: 390, height: 844 });
    };
    for (const lang of ['pt-BR', 'es', 'en'] as const) {
      if (lang !== 'pt-BR') {
        await page.clock.resume();
        await reopenIn(page, lang);
      }
      await page
        .getByRole('button', { name: new RegExp(ui(lang, 'play.mode.open').split(' (')[0]!) })
        .click();
      const sheet = page.getByRole('dialog', { name: ui(lang, 'play.mode.title') });
      await expect(sheet).toBeVisible();
      await noSideScroll(`${lang} selector`);
      await sheet.getByRole('button', { name: ui(lang, 'nav.close') }).click();
      await expect(sheet).toHaveCount(0);
      await freezeClock(page);
      await openMatch(page, lang);
      await page.clock.runFor(5_000);
      for (const theme of ['noite', 'dia'] as const) {
        await setTheme(page, theme);
        await noSideScroll(`${lang} ${theme} match`);
      }
      await setTheme(page, 'noite');
      await control(page, 'match.skip', lang).click();
      await runUntil(page, async () => (await roundHeading(page).count()) === 1);
      await page.clock.resume();
      await closeSummary(page, ui(lang, 'round.continue'));
    }
  });

  test('desktop (1280×800): sem barra lateral, a coluna até layout-content-max, o seletor abre o diálogo de 540px (medida 16)', async ({
    page,
  }) => {
    test.skip(onPhone(page), 'o desktop é o caso do teste');
    await careerWith(page, 'highlights');
    const segment = page.locator('aside').getByRole('button', { name: /^Mudar o tipo de partida/ });
    await expect(segment).toBeVisible();
    await segment.click();
    const sheet = page.getByRole('dialog', { name: ui('pt-BR', 'play.mode.title') });
    await expect(sheet).toBeVisible();
    expect(Math.round((await sheet.boundingBox())!.width)).toBe(540);
    await sheet.getByRole('button', { name: ui('pt-BR', 'nav.close') }).click();
    await freezeClock(page);
    await openMatch(page);
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const { column, max } = await page.evaluate(() => {
      const main = document.querySelector('main.match')!;
      const style = getComputedStyle(main);
      const probe = document.createElement('div');
      probe.style.width = 'var(--layout-content-max)';
      document.body.append(probe);
      const max = probe.getBoundingClientRect().width;
      probe.remove();
      const inner =
        main.getBoundingClientRect().width -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      return { column: inner, max };
    });
    expect(column).toBeLessThanOrEqual(max + 1);
    // The bar at the foot of the column, inside it.
    const bar = (await matchScreen(page).locator('.bar').boundingBox())!;
    const main = (await matchScreen(page).boundingBox())!;
    expect(bar.x).toBeGreaterThanOrEqual(main.x - 1);
    expect(bar.x + bar.width).toBeLessThanOrEqual(main.x + main.width + 1);
    expect(bar.y + bar.height).toBeLessThanOrEqual(800 + 1);
  });

  test('o playUntil dos outros specs joga rodadas de uma carreira assistida, tocando "Pular"', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    await careerWith(page, 'highlights');
    await playUntil(page, 3);
    expect(await nextRound(page)).toBe(3);
    expect((await readSave(page)).career).toMatchObject({ matchMode: 'highlights' });
  });

  test('o voltar do celular depois de "Rodada salva" abre o resumo; voltar de novo leva à aba', async ({
    page,
  }) => {
    await careerWith(page, 'highlights');
    await freezeClock(page);
    await openMatch(page);
    await playToEnd(page);
    await expect(matchScreen(page).getByText(ui('pt-BR', 'round.saved'))).toBeVisible();
    await page.goBack();
    await expect(roundHeading(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/round$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/club$/);
    await expect(roundHeading(page)).toHaveCount(0);
    await expect(playButton(page)).toBeVisible();
  });

  test.describe('gravação recusada no apito final', () => {
    test.beforeEach(async ({ page }) => {
      // O `put` de um snapshot falha por falta de espaço, só depois de ligado.
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

    test('a barra mostra "Rodada não salva" e "Ver resumo" fica ativo; o resumo abre com o aviso', async ({
      page,
    }) => {
      await careerWith(page, 'highlights');
      await page.evaluate(() => ((globalThis as { failSnapshots?: boolean }).failSnapshots = true));
      await freezeClock(page);
      await openMatch(page);
      await playToEnd(page);
      await expect(matchScreen(page).getByText(ui('pt-BR', 'round.unsaved'))).toBeVisible();
      await expect(control(page, 'match.toSummary')).toBeEnabled();
      expect((await readHeadRecord(page)).round).toBe(1);
      await control(page, 'match.toSummary').click();
      await expect(roundHeading(page)).toBeVisible();
      await expect(page.locator('main.round #round-bar-state')).toHaveText(
        ui('pt-BR', 'round.unsaved'),
      );
      await expect(page.locator('main.round .banner.danger')).toBeVisible();
    });
  });

  test('erro ao desenhar a partida com "Sair da partida?" aberta: "Ir direto ao resultado" grava e abre o resumo', async ({
    page,
  }) => {
    // The sheet fails to open (its `showModal`, in an effect of the match screen): the boundary
    // of the match shows its error with the sheet's entry left on top of the history.
    await page.addInitScript(() => {
      const showModal = HTMLDialogElement.prototype.showModal;
      HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
        if ((globalThis as { failSheet?: boolean }).failSheet) {
          throw new Error('sheet draw failed (test)');
        }
        return showModal.call(this);
      };
    });
    const { expected } = await careerWith(page, 'highlights');
    await freezeClock(page);
    await openMatch(page);
    await runToMinute(page, 10);
    await page.evaluate(() => ((globalThis as { failSheet?: boolean }).failSheet = true));
    await page.goBack();
    const error = page.getByRole('alert');
    await expect(error).toBeVisible();
    await expect(error).toContainText(ui('pt-BR', 'error.unexpected.title'));
    await expect(error).toContainText(ui('pt-BR', 'match.error.body'));
    await expect(matchScreen(page)).toHaveCount(0);
    expect(await page.evaluate(() => (history.state as { sheet?: string } | null)?.sheet)).toBe(
      'match-leave',
    );
    await page.evaluate(() => ((globalThis as { failSheet?: boolean }).failSheet = false));
    await error.getByRole('button', { name: ui('pt-BR', 'match.error.skip') }).click();
    await runUntil(page, async () => (await roundHeading(page).count()) === 1);
    await expect(page).toHaveURL(/#\/round$/);
    expect((await readHeadRecord(page)).round).toBe(2);
    const stored = (await readSave(page)).game.fixtures as unknown as {
      id: string;
      result?: { score: [number, number] };
    }[];
    expect(stored.find((f) => f.id === expected.fixtureId)!.result!.score).toEqual(
      expected.result.score,
    );
    // No entry of the match nor of its sheet left behind: back is the tab.
    await page.goBack();
    await expect(page).toHaveURL(/#\/club$/);
    await expect(roundHeading(page)).toHaveCount(0);
    await expect(playButton(page)).toBeVisible();
  });

  test('erro ao desenhar a partida com "Sair da partida?" aberta e depois erro ao jogar no fim: o endereço volta à aba, sem entrada sobrando', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const showModal = HTMLDialogElement.prototype.showModal;
      HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
        if ((globalThis as { failSheet?: boolean }).failSheet) {
          throw new Error('sheet draw failed (test)');
        }
        return showModal.call(this);
      };
    });
    await careerWith(page, 'highlights');
    await freezeClock(page);
    await openMatch(page);
    await runToMinute(page, 10);
    await page.evaluate(() => ((globalThis as { failSheet?: boolean }).failSheet = true));
    await page.goBack();
    const error = page.getByRole('alert');
    await expect(error).toBeVisible();
    await page.evaluate(() => {
      (globalThis as { failSheet?: boolean }).failSheet = false;
      const original = window.setTimeout;
      let armed = true;
      window.setTimeout = ((run: TimerHandler, ms?: number, ...rest: unknown[]) => {
        if (armed && ms === 0) {
          armed = false;
          throw new Error('play failed (test)');
        }
        return original(run, ms, ...rest);
      }) as typeof window.setTimeout;
    });
    await error.getByRole('button', { name: ui('pt-BR', 'match.error.skip') }).click();
    await runUntil(page, async () => (await playButton(page).count()) === 1, { step: 100 });
    // The round was not played; the content area shows the unexpected error.
    expect((await readHeadRecord(page)).round).toBe(1);
    await expect(matchScreen(page)).toHaveCount(0);
    await expect(playButton(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/club$/);
    // Neither the match's entry nor its sheet's is left under the tab.
    expect(
      await page.evaluate(() => {
        const state = history.state as { match?: boolean; sheet?: string } | null;
        return { match: state?.match, sheet: state?.sheet };
      }),
    ).toEqual({ match: undefined, sheet: undefined });
  });

  test.describe('erro ao jogar no fim (o playRound lança antes de gravar)', () => {
    /**
     * Na próxima espera de 0 ms (a do `playRound`, que deixa a tela desenhar antes do motor), um
     * erro: a rodada não é aplicada e a carreira continua na anterior.
     */
    const failNextPlay = (page: Page) =>
      page.evaluate(() => {
        const original = window.setTimeout;
        let armed = true;
        window.setTimeout = ((run: TimerHandler, ms?: number, ...rest: unknown[]) => {
          if (armed && ms === 0) {
            armed = false;
            throw new Error('play failed (test)');
          }
          return original(run, ms, ...rest);
        }) as typeof window.setTimeout;
      });

    test('o ErrorState com "Tentar de novo": joga e grava, sem repetir a partida, e abre o resumo', async ({
      page,
    }) => {
      const { expected } = await careerWith(page, 'highlights');
      await freezeClock(page);
      await openMatch(page);
      await failNextPlay(page);
      const error = page.getByRole('alert');
      await runUntil(page, async () => (await error.count()) === 1, { step: 500 });
      await expect(error).toContainText(ui('pt-BR', 'error.unexpected.title'));
      await expect(error).toContainText(ui('pt-BR', 'match.error.body'));
      await expect(matchScreen(page)).toHaveCount(0);
      expect((await readHeadRecord(page)).round).toBe(1);
      await error.getByRole('button', { name: ui('pt-BR', 'action.retry') }).click();
      await runUntil(page, async () => (await roundHeading(page).count()) === 1);
      expect((await readHeadRecord(page)).round).toBe(2);
      const stored = (await readSave(page)).game as unknown as {
        round: number;
        fixtures: { id: string; round: number; result?: { score: [number, number] } }[];
      };
      // Round 1 only, once: the score the match showed.
      expect(stored.round).toBe(2);
      expect(stored.fixtures.find((f) => f.id === expected.fixtureId)!.result!.score).toEqual(
        expected.result.score,
      );
      expect(stored.fixtures.filter((f) => f.round === 2 && f.result != null)).toEqual([]);
    });

    test('"Voltar sem jogar" leva à aba de origem, com a rodada ainda por jogar', async ({
      page,
    }) => {
      await careerWith(page, 'highlights');
      await freezeClock(page);
      await openMatch(page);
      await failNextPlay(page);
      const error = page.getByRole('alert');
      await runUntil(page, async () => (await error.count()) === 1, { step: 500 });
      await error.getByRole('button', { name: ui('pt-BR', 'match.error.leave') }).click();
      await expect(page).toHaveURL(/#\/club$/);
      await expect(page.getByRole('alert')).toHaveCount(0);
      expect(await nextRound(page)).toBe(1);
      expect((await readHeadRecord(page)).round).toBe(1);
      await expect(playButton(page)).not.toHaveAttribute('aria-busy', 'true');
      await expect(playButton(page)).toContainText(ui('pt-BR', 'newGame.match.highlights'));
    });
  });

  test('duração: do apito inicial ao final no tempo da tabela de "Relógio da partida", ±5% (medida 17, a duração)', async ({
    page,
  }) => {
    test.skip(!onPhone(page), 'uma vez por navegador');
    const { expected } = await careerWith(page, 'highlights');
    const steps = matchSteps(expected.result.events, 'highlights');
    const total = timeTo(steps, steps.length - 1);
    await freezeClock(page);
    await openMatch(page);
    const start = await page.evaluate(() => Date.now());
    const end = board(page).locator('.live .phase');
    await runUntil(page, async () => (await end.innerText()) === ui('pt-BR', 'match.phase.end'), {
      step: 50,
    });
    const took = (await page.evaluate(() => Date.now())) - start;
    expect(Math.abs(took - total)).toBeLessThanOrEqual(total * 0.05);
  });
});

test.describe('Partida narrada: desempenho (T-032)', () => {
  test('do toque à partida p90 ≤ 300 ms, de Pular ao resumo p90 ≤ 500 ms, sem tarefa longa na partida, CPU 4× (medida 17)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium' || !onPhone(page), 'CDP; uma vez');
    test.setTimeout(180_000);
    await careerWith(page, 'highlights');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    /** Clicks `selector` and resolves with the time until the element `id` is drawn. */
    const timed = (selector: string, id: string) =>
      page.evaluate(
        ({ selector, id }) =>
          new Promise<number>((resolve) => {
            const button = [...document.querySelectorAll<HTMLElement>(selector)].find(
              (b) => b.getClientRects().length > 0,
            )!;
            const start = performance.now();
            const check = () => {
              const title = document.getElementById(id);
              if (title !== null && title.getClientRects().length > 0) {
                requestAnimationFrame(() => resolve(performance.now() - start));
              } else requestAnimationFrame(check);
            };
            button.click();
            requestAnimationFrame(check);
          }),
        { selector, id },
      );
    const toMatch: number[] = [];
    const toSummary: number[] = [];
    for (let i = 0; i < 10; i++) {
      toMatch.push(await timed('button.play', 'match-title'));
      toSummary.push(await timed('main.match .bar .action button', 'round-title'));
      await closeSummary(page);
    }

    // One whole match, in Rápido: no long task between the kick-off and the final whistle (the
    // match is computed before the kick-off, inside the 300 ms above).
    await page.evaluate(() => {
      const w = window as unknown as { longTasks: { start: number; duration: number }[] };
      w.longTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.longTasks.push({ start: entry.startTime, duration: entry.duration });
        }
      }).observe({ type: 'longtask' });
    });
    await playButton(page).click();
    await expect(matchScreen(page)).toBeVisible();
    await page.evaluate(
      (word) => {
        const w = window as unknown as { kickoff: number; whistle?: number };
        w.kickoff = performance.now();
        const phase = document.querySelector('main.match .scoreboard .live .phase')!;
        new MutationObserver(() => {
          if (w.whistle === undefined && phase.textContent === word) w.whistle = performance.now();
        }).observe(phase, { childList: true, characterData: true, subtree: true });
      },
      ui('pt-BR', 'match.phase.end'),
    );
    await control(page, 'match.fast').click();
    await expect(control(page, 'match.toSummary')).toBeVisible({ timeout: 60_000 });
    const longTasks = await page.evaluate(() => {
      const w = window as unknown as {
        longTasks: { start: number; duration: number }[];
        kickoff: number;
        whistle?: number;
      };
      return w.longTasks
        .filter((t) => t.start >= w.kickoff && t.start < (w.whistle ?? Infinity))
        .map((t) => t.duration);
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const p90 = (list: number[]) =>
      [...list].sort((a, b) => a - b)[Math.ceil(0.9 * list.length) - 1]!;
    const show = (list: number[]) =>
      [...list]
        .sort((a, b) => a - b)
        .map((t) => t.toFixed(0))
        .join(' ');
    console.log(
      `toque até a partida (ms, CPU 4×): ${show(toMatch)}; p90 ${p90(toMatch).toFixed(0)}`,
    );
    console.log(
      `Pular até o resumo (ms, CPU 4×): ${show(toSummary)}; p90 ${p90(toSummary).toFixed(0)}`,
    );
    console.log(
      `tarefas longas na partida (ms, CPU 4×): [${longTasks.map((t) => t.toFixed(0)).join(' ')}]`,
    );
    expect(p90(toMatch)).toBeLessThanOrEqual(300);
    expect(p90(toSummary)).toBeLessThanOrEqual(500);
    expect(longTasks.filter((t) => t > 50)).toEqual([]);
  });
});
