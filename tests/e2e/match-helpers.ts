import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import {
  prepareRound,
  simulateMatch,
  type GameState,
  type MatchEvent,
  type MatchResult,
} from '../../app/src/engine/index.ts';
import type { MatchStep } from '../../app/src/ui/match/steps.ts';
import { timingOf } from '../../app/src/ui/match/timing.ts';
import { startCareer } from './career.ts';
import { gameParams, patchSave, readSave, type SaveJson } from './save.ts';

/*
 * Peças comuns dos E2E da partida assistida (T-032 em match.spec.ts, T-085 em pitch.spec.ts): os
 * textos de `ui.json`, a carreira de teste com o tipo de partida e a semente ajustados no save (a
 * semente é escolhida no Node, pelo próprio motor, para a partida do técnico ter o lance que o
 * teste precisa), a partida esperada calculada como o `CareerService.liveMatch` a calcula (o
 * auxiliar no comando, `'result'`, sem ficha na rodada 1) e o relógio falso do Playwright.
 */

export type Lang = 'pt-BR' | 'es' | 'en';
export const UI: Record<Lang, Record<string, string | undefined>> = Object.fromEntries(
  (['pt-BR', 'es', 'en'] as const).map((lang) => [
    lang,
    JSON.parse(
      readFileSync(new URL(`../../app/src/content/${lang}/ui.json`, import.meta.url), 'utf8'),
    ) as Record<string, string>,
  ]),
) as Record<Lang, Record<string, string | undefined>>;

/** Um texto de `ui.json` em `lang` (o teste falha se a chave não existe). */
export function ui(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const text = UI[lang][key];
  if (text === undefined) throw new Error(`no ${key} in ${lang}`);
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export const onPhone = (page: Page) => page.viewportSize()!.width < 900;
export const params = gameParams();

/** A partida do técnico na próxima rodada, como o `liveMatch` a calcula. */
export interface Expected {
  fixtureId: string;
  homeId: string;
  awayId: string;
  side: 'home' | 'away';
  result: MatchResult;
}

export function expectedMatch(save: SaveJson): Expected {
  const game = save.game as unknown as GameState;
  const clubId = save.career.clubId;
  const plan = prepareRound(game, params, { coaches: { [clubId]: 'result' } });
  if (!plan.ok) throw new Error(plan.error);
  const match = plan.value.matches.find(
    (m) => m.home.clubId === clubId || m.away.clubId === clubId,
  )!;
  return {
    fixtureId: match.fixtureId,
    homeId: match.home.clubId,
    awayId: match.away.clubId,
    side: match.home.clubId === clubId ? 'home' : 'away',
    result: simulateMatch(match, params),
  };
}

/** A semente cuja partida do técnico na rodada 1 satisfaz `wanted` (procurada no motor). */
export function seedFor(save: SaveJson, wanted: (result: MatchResult) => boolean): number {
  for (let seed = 1; seed < 5_000; seed++) {
    const tried = { ...save, game: { ...save.game, seed } } as SaveJson;
    if (wanted(expectedMatch(tried).result)) return seed;
  }
  throw new Error('nenhuma semente com a partida pedida');
}

export const goalsOf = (r: MatchResult) =>
  r.events.filter((e): e is Extract<MatchEvent, { type: 'goal' }> => e.type === 'goal');

/** Uma partida com um gol de jogada e uma chance clara. */
export const lively = (r: MatchResult) =>
  goalsOf(r).some((g) => g.kind === 'open') &&
  r.events.some((e) => e.type === 'chance' && e.importance === 2) &&
  r.events.some((e) => e.type === 'yellow') &&
  r.events.some((e) => e.type === 'substitution');

/**
 * Cria a carreira (Completo, o clube mais forte, ou `club`), põe no save o tipo de partida e a
 * semente pedida, e reabre. Devolve o save ajustado e a partida esperada da rodada 1.
 */
export async function careerWith(
  page: Page,
  mode: 'full' | 'highlights' | 'result',
  wanted: (result: MatchResult) => boolean = lively,
  club?: string,
): Promise<{ save: SaveJson; expected: Expected }> {
  await startCareer(page, club === undefined ? {} : { club });
  const base = await readSave(page);
  const seed = seedFor(base, wanted);
  const save = await patchSave(page, (s) => {
    s.game.seed = seed;
    (s.career as unknown as { matchMode: string }).matchMode = mode;
  });
  return { save, expected: expectedMatch(save) };
}

// ------------------------------------------------------------------------------- the clock

/** Para o relógio da página (a partida só anda com `runFor`), um pouco à frente do de agora. */
export async function freezeClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1_000);
}

/** Avança o relógio em passos de `step` ms até `done` (no máximo `max` ms). */
export async function runUntil(
  page: Page,
  done: () => Promise<boolean>,
  { step = 50, max = 300_000 }: { step?: number; max?: number } = {},
): Promise<void> {
  for (let spent = 0; spent <= max; spent += step) {
    if (await done()) return;
    await page.clock.runFor(step);
  }
  throw new Error('o relógio correu e a condição não veio');
}

export const matchScreen = (page: Page) => page.locator('main.match');
export const board = (page: Page) => matchScreen(page).locator('.scoreboard');
export const minuteText = (page: Page) => board(page).locator('.live .minute').innerText();
export const lines = (page: Page) => matchScreen(page).locator('section.feed li');
export const line = (page: Page, id: string) => matchScreen(page).locator(`li[data-line="${id}"]`);
export const liveRegion = (page: Page) => board(page).locator('[aria-live="polite"]');
export const control = (page: Page, key: string, lang: Lang = 'pt-BR') =>
  matchScreen(page).getByRole('button', { name: ui(lang, key), exact: true });

/** O placar visível, como números. */
export async function shownScore(page: Page): Promise<[number, number]> {
  const goals = board(page).locator('.goals');
  return [Number(await goals.nth(0).innerText()), Number(await goals.nth(1).innerText())];
}

/** Toca "Jogar rodada" com o relógio parado e espera a partida abrir. */
export async function openMatch(page: Page, lang: Lang = 'pt-BR'): Promise<void> {
  await page.getByRole('button', { name: ui(lang, 'play.label') }).click();
  await runUntil(page, async () => (await matchScreen(page).count()) === 1, {
    step: 20,
    max: 5_000,
  });
}

/** O tempo de relógio de `steps[0..index)` (do apito inicial até o passo `index` aparecer). */
export const timeTo = (
  steps: readonly MatchStep[],
  index: number,
  speed: 'normal' | 'fast' = 'normal',
) => steps.slice(0, index).reduce((sum, s) => sum + timingOf(s.timing, speed), 0);

/** Corre a partida até o apito final e a gravação terminar (barra com "Ver resumo" ativo). */
export async function playToEnd(page: Page, lang: Lang = 'pt-BR'): Promise<void> {
  const summaryButton = control(page, 'match.toSummary', lang);
  await runUntil(
    page,
    async () =>
      (await summaryButton.count()) === 1 &&
      (await summaryButton.getAttribute('aria-busy')) === null,
    { step: 500 },
  );
}

/** Corre até o relógio mostrar `minute'` (ou passar dele). */
export async function runToMinute(page: Page, minute: number): Promise<void> {
  await runUntil(page, async () => {
    const text = await minuteText(page);
    return Number(/^(\d+)/.exec(text)?.[1] ?? 0) >= minute;
  });
}

/** Um resumo dos pixels do canvas (para ver se o campo foi desenhado e se ele mudou). */
export const pixels = (page: Page) =>
  matchScreen(page)
    .locator('canvas')
    .evaluate((element) => {
      const c = element as HTMLCanvasElement;
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let hash = 0;
      for (let i = 0; i < data.length; i++) hash = (Math.imul(hash, 31) + data[i]!) | 0;
      return hash;
    });

/**
 * Waits, in real time and with a ceiling, until the pitch has settled: every tag on screen has its
 * position (the measure of a pill is a ResizeObserver, outside the fake clock, and the pitch draws
 * one more frame when it arrives, for the thread) and the canvas gave the same pixels in two reads
 * in a row. Only then is a picture of the paused pitch taken; after it, nothing may change.
 */
export async function settled(page: Page): Promise<void> {
  let last: number | undefined;
  await expect
    .poll(
      async () => {
        const placed = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('main.match .place')].every(
            (place) => place.style.transform !== '',
          ),
        );
        const now = await pixels(page);
        const same = placed && now === last;
        last = now;
        return same;
      },
      { message: 'o campo não assentou', timeout: 10_000, intervals: [100, 200, 300, 500] },
    )
    .toBe(true);
}
