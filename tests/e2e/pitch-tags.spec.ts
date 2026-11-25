import type { Page } from '@playwright/test';
import { matchSteps, type MatchStep } from '../../app/src/ui/match/steps.ts';
import { timingOf } from '../../app/src/ui/match/timing.ts';
import { expect, test } from './fixtures.ts';
import {
  board,
  careerWith,
  freezeClock,
  goalsOf,
  lively,
  liveRegion,
  matchScreen,
  openMatch,
  timeTo,
  ui,
} from './match-helpers.ts';

/*
 * As etiquetas do campo v2 (PR B; docs/design/telas/partida-campo-v2.md, 9, 10 e 16 itens 10 a 14;
 * critérios E2E 4 e 5 do 13). O relógio é o falso do Playwright, parado: o teste anda o relógio até
 * o meio de cada passo da partida (`timeTo`) e lê o DOM das etiquetas (`.place`, `aria-hidden`).
 * O que cada passo deve mostrar vem de um modelo de referência escrito aqui só com a regra da
 * spec (a soma das durações dos passos desde a entrada, 1,6 s no Normal), não do `TagTracker`.
 * Nenhuma leitura de pixel: não há a corrida do primeiro desenho do fundo.
 */

const MIN_MS = 1600;

type Tone = 'play' | 'goal';
interface Planned {
  key: string;
  tone: Tone;
}

/** A etiqueta que o passo traz (a tabela do 9, só a existência, a chave e o tom). */
function planOf(step: MatchStep): Planned | undefined {
  const line = step.line;
  if (line === undefined || step.timing === undefined) return undefined;
  const type = line.source.type;
  if (!['chance', 'goal', 'penaltyAwarded', 'penaltyMissed', 'red'].includes(type))
    return undefined;
  const tone: Tone = type === 'goal' && line.stage === 'final' ? 'goal' : 'play';
  return { key: `${line.id}:${tone}`, tone };
}

/** O que o modelo espera depois de cada passo. */
interface Expect {
  held?: { key: string; tone: Tone; age: number };
  /** Uma etiqueta do lance pode estar saindo (opacidade) neste passo. */
  leaving: boolean;
}

function model(steps: readonly MatchStep[]): Expect[] {
  const out: Expect[] = [];
  let held: { key: string; tone: Tone; age: number } | undefined;
  let last = 0;
  for (const step of steps) {
    let leaving = false;
    if (held) held.age += last;
    last = timingOf(step.timing, 'normal');
    const plan = planOf(step);
    if (plan) {
      held = held?.key === plan.key ? held : { ...plan, age: 0 };
    } else if (held) {
      if (held.tone === 'goal') held = undefined;
      else if (held.age >= MIN_MS) {
        leaving = true;
        held = undefined;
      }
    }
    out.push({ ...(held ? { held: { ...held } } : {}), leaving });
  }
  return out;
}

/** Uma partida com gol de jogada e com uma etiqueta que o tempo mínimo segura num minuto vazio. */
const withHold = (r: Parameters<typeof lively>[0]) => {
  if (!lively(r) || !goalsOf(r).some((g) => g.kind === 'open')) return false;
  const steps = matchSteps(r.events, 'full');
  const expect = model(steps);
  return steps.some(
    (s, i) => s.timing === 'minuteFull' && expect[i]!.held !== undefined && planOf(s) === undefined,
  );
};

interface Snap {
  tone: 'play' | 'goal' | 'team';
  leaving: boolean;
  compact: boolean;
  ariaHidden: string | null;
  pointer: string;
  visibility: string;
  /** The pitch has written the position (the pill was measured; the measure runs in real time). */
  placed: boolean;
  text: string;
  hasKind: boolean;
  hasName: boolean;
  nameWrapped: boolean;
  textChildren: number;
  /** A caixa da `.place` (sem a escala de entrada) e o tamanho de layout da pílula. */
  left: number;
  top: number;
  pillW: number;
  pillH: number;
  tipBottom: number;
  circle: number;
  shirtMid: number;
  textMid: number;
}

/** As etiquetas da tela agora, e a caixa do canvas. */
function snapshot(page: Page): Promise<{ tags: Snap[]; box: DOMRect }> {
  return page.evaluate(() => {
    const screen = document.querySelector('main.match')!;
    const canvas = screen.querySelector('canvas')!.getBoundingClientRect();
    const tags = [...screen.querySelectorAll<HTMLElement>('.place')]
      .filter((place) => place.querySelector('.tag') !== null)
      .map((place) => {
        const pill = place.querySelector<HTMLElement>('.tag')!;
        const rect = place.getBoundingClientRect();
        const name = pill.querySelector<HTMLElement>('.name');
        const text = pill.querySelector<HTMLElement>('.text');
        const shirt = pill.querySelector<HTMLElement>('.shirt')!.getBoundingClientRect();
        const textRect = text?.getBoundingClientRect();
        const line = name ? parseFloat(getComputedStyle(name).lineHeight) : 0;
        return {
          tone: (['goal', 'team'] as const).find((t) => pill.classList.contains(t)) ?? 'play',
          leaving: pill.classList.contains('leaving'),
          compact: pill.classList.contains('compact'),
          ariaHidden: place.getAttribute('aria-hidden'),
          pointer: getComputedStyle(place).pointerEvents,
          visibility: getComputedStyle(place).visibility,
          placed: place.style.transform !== '',
          text: pill.textContent!.trim(),
          hasKind: pill.querySelector('.kind, .title') !== null,
          hasName: name !== null,
          nameWrapped: name !== null && name.getBoundingClientRect().height > line * 1.5,
          textChildren: text?.children.length ?? 0,
          left: rect.left,
          top: rect.top,
          pillW: pill.offsetWidth,
          pillH: pill.offsetHeight,
          tipBottom: rect.top + pill.offsetHeight + 7,
          circle: pill.querySelector<HTMLElement>('.shirt')!.offsetWidth,
          shirtMid: shirt.top + shirt.height / 2,
          textMid: textRect ? textRect.top + textRect.height / 2 : shirt.top + shirt.height / 2,
        } satisfies Snap;
      });
    return { tags, box: canvas.toJSON() as DOMRect };
  });
}

interface Sample {
  index: number;
  step: MatchStep;
  /** O ponto da amostra no passo, de 0 a 1. */
  at: number;
  tags: Snap[];
  box: DOMRect;
}

/**
 * Anda a partida passo a passo e chama `each` em cada fração `at` de cada passo (de `from` a
 * `to`). Os passos que `only` recusa são só atravessados.
 */
async function scan(
  page: Page,
  steps: readonly MatchStep[],
  at: readonly number[],
  each: (sample: Sample) => void,
  only: (i: number) => boolean = () => true,
): Promise<void> {
  let now = 0;
  for (let i = 0; i < steps.length - 1; i++) {
    if (!only(i)) continue;
    const start = timeTo(steps, i);
    const length = timingOf(steps[i]!.timing, 'normal');
    for (const fraction of at) {
      const target = start + fraction * length;
      if (target > now) await page.clock.runFor(target - now);
      now = Math.max(now, target);
      let { tags, box } = await snapshot(page);
      if (tags.some((t) => !t.placed)) {
        // The measure of a pill that just mounted (ResizeObserver) comes in real time, outside the
        // fake clock, and slower on a slow machine: wait for it by polling, never a fixed time.
        // Until then the tag is hidden because it is not placed, not because of the 12px rule.
        await expect
          .poll(async () => (await snapshot(page)).tags.every((t) => t.placed), {
            message: `passo ${i}: a etiqueta nunca foi medida`,
          })
          .toBe(true);
        ({ tags, box } = await snapshot(page));
      }
      each({ index: i, step: steps[i]!, at: fraction, tags, box });
    }
  }
}

const label = (s: Sample) =>
  `passo ${s.index} (${s.step.timing}, ${s.step.line?.source.type ?? 'minuto'}, ${s.at})`;

async function openWithHold(page: Page) {
  const { save, expected } = await careerWith(page, 'full', withHold);
  const steps = matchSteps(expected.result.events, 'full');
  await freezeClock(page);
  await openMatch(page);
  await expect(matchScreen(page).locator('canvas')).toHaveCount(1);
  // The box of the pitch is laid out (a tag before that has no place to be in): by polling, never
  // by waiting a fixed time.
  await expect
    .poll(async () => (await matchScreen(page).locator('canvas').boundingBox())?.width ?? 0)
    .toBeGreaterThan(100);
  return { save, expected, steps };
}

test.describe('Campo v2, PR B: as etiquetas (E2E 4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    test.setTimeout(120_000);
  });

  test('a etiqueta do lance e a de gol seguem os passos: o gol só no desfecho e some no passo seguinte; nenhuma etiqueta de lance num minuto cheio, a não ser a que cumpre os 1,6 s ou a que sai; tudo aria-hidden e sem toque', async ({
    page,
  }) => {
    const { expected, steps } = await openWithHold(page);
    const shouldBe = model(steps);
    const seen = { goal: 0, play: 0, heldInMinute: 0, leaving: 0 };
    const goalSteps = new Set(
      steps.map((s, i) => (planOf(s)?.tone === 'goal' ? i : -1)).filter((i) => i >= 0),
    );
    expect(goalSteps.size).toBeGreaterThan(0);

    await scan(page, steps, [0.4], (s) => {
      const want = shouldBe[s.index]!;
      const onScreen = s.tags.filter((t) => t.tone !== 'team' && !t.leaving);
      const going = s.tags.filter((t) => t.tone !== 'team' && t.leaving);
      for (const t of s.tags) {
        expect(t.ariaHidden, label(s)).toBe('true');
        expect(t.pointer, label(s)).toBe('none');
      }
      expect(onScreen.length, `${label(s)}: etiquetas paradas na tela`).toBe(want.held ? 1 : 0);
      expect(going.length, `${label(s)}: etiquetas saindo`).toBeLessThanOrEqual(
        want.leaving ? 1 : 0,
      );
      if (want.held) {
        expect(onScreen[0]!.tone, label(s)).toBe(want.held.tone);
        seen[want.held.tone]++;
        // The goal tag: only at the outcome of a goal, never at a minute.
        if (want.held.tone === 'goal') expect(goalSteps.has(s.index), label(s)).toBe(true);
        if (s.step.timing === 'minuteFull') {
          // A minute with nothing shown: only the tag the minimum time holds.
          expect(want.held.age, `${label(s)}: antes do tempo mínimo`).toBeLessThan(MIN_MS);
          seen.heldInMinute++;
        }
      }
      if (going.length === 1) seen.leaving++;
      // The goal tag is gone at the next step, with no fade.
      if (goalSteps.has(s.index - 1)) {
        expect(
          s.tags.filter((t) => t.tone === 'goal'),
          label(s),
        ).toHaveLength(0);
      }
    });
    // The match really had each case (the seed is chosen for it).
    expect(seen.goal).toBeGreaterThan(0);
    expect(seen.play).toBeGreaterThan(0);
    expect(seen.heldInMinute).toBeGreaterThan(0);
    expect(expected.result.events.length).toBeGreaterThan(0);
  });

  test('o tempo mínimo: uma etiqueta do lance fica pelo menos 1,6 s, pela soma das durações dos passos, mesmo que o disco saia antes; depois dele sai no primeiro passo sem etiqueta', async ({
    page,
  }) => {
    const { steps } = await openWithHold(page);
    const shouldBe = model(steps);
    const length = (from: number, to: number) =>
      steps.slice(from, to).reduce((sum, st) => sum + timingOf(st.timing, 'normal'), 0);
    // The stays of the model that end by leaving (not replaced by another play, not a goal).
    const stays: { key: string; from: number; to: number }[] = [];
    let open: { key: string; from: number } | undefined;
    shouldBe.forEach((e, i) => {
      if (open && e.held?.key !== open.key) {
        if (e.leaving) stays.push({ ...open, to: i });
        open = undefined;
      }
      if (e.held && open === undefined && e.held.tone === 'play') {
        open = { key: e.held.key, from: i };
      }
    });
    // The seed has a stay held through a minute with nothing shown, because the play was short.
    const held = stays.filter((s) =>
      steps.slice(s.from, s.to).some((st) => st.timing === 'minuteFull'),
    );
    expect(held.length).toBeGreaterThan(0);

    const seen = new Map<number, number>();
    await scan(page, steps, [0.4, 0.9], (s) => {
      const play = s.tags.filter((t) => t.tone === 'play').length;
      seen.set(s.index, Math.max(seen.get(s.index) ?? 0, play));
      // After the fade (the timer of 240 ms) the exit step has no tag of a play.
      if (s.at === 0.9 && stays.some((stay) => stay.to === s.index)) {
        expect(play, `${label(s)}: depois da saída`).toBe(0);
      }
    });
    for (const stay of stays) {
      for (let i = stay.from; i < stay.to; i++) {
        expect(seen.get(i), `passo ${i} da etiqueta ${stay.key}`).toBe(1);
      }
      expect(length(stay.from, stay.to), `a etiqueta ${stay.key}`).toBeGreaterThanOrEqual(MIN_MS);
    }
  });

  test('o anúncio do gol continua na região viva do placar, e nenhuma etiqueta entra nela', async ({
    page,
  }) => {
    const { expected, steps } = await openWithHold(page);
    const goal = goalsOf(expected.result).find((g) => g.kind === 'open')!;
    const id = `e${expected.result.events.indexOf(goal)}`;
    const outcome = steps.findIndex((s) => s.line?.id === id && s.line.stage === 'final');
    await page.clock.runFor(timeTo(steps, outcome) + 150);
    await expect(matchScreen(page).locator('.place:has(.tag.goal)')).toBeVisible();
    // The sentence of the goal is in the live region of the board; no tag is inside it.
    await expect(liveRegion(page)).toContainText(String(goal.minute));
    await expect(liveRegion(page)).not.toBeEmpty();
    await expect(board(page).locator('.place, .tag')).toHaveCount(0);
    await expect(
      matchScreen(page).locator('[aria-live] .place, [role="status"] .place, [role="log"] .place'),
    ).toHaveCount(0);
    // The goal tag says the title, not an announcement of its own.
    await expect(matchScreen(page).locator('.place:has(.tag.goal)')).toContainText(
      ui('pt-BR', 'match.celebration.title'),
    );
  });

  for (const [width, height] of [
    [360, 740],
    [844, 390],
    [1280, 800],
  ] as const) {
    test(`as etiquetas ficam inteiras dentro da caixa do campo a ${width}×${height}, até 60% de largura`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      const { steps } = await openWithHold(page);
      const shouldBe = model(steps);
      let checked = 0;
      await scan(
        page,
        steps,
        [0.5],
        (s) => {
          // A shirt over the ball hidden by the 12px rule (or not placed yet) is not on screen.
          for (const t of s.tags.filter((x) => x.visibility !== 'hidden')) {
            expect(t.left, `${label(s)}: esquerda`).toBeGreaterThanOrEqual(s.box.left - 0.5);
            expect(t.left + t.pillW, `${label(s)}: direita`).toBeLessThanOrEqual(s.box.right + 0.5);
            expect(t.top, `${label(s)}: topo`).toBeGreaterThanOrEqual(s.box.top - 0.5);
            expect(t.tipBottom, `${label(s)}: ponta`).toBeLessThanOrEqual(s.box.bottom + 0.5);
            if (t.tone !== 'team') {
              expect(t.pillW, `${label(s)}: largura`).toBeLessThanOrEqual(s.box.width * 0.6 + 1);
            }
            checked++;
          }
        },
        (i) => shouldBe[i]!.held !== undefined || steps[i]!.timing === 'minuteFull',
      );
      expect(checked).toBeGreaterThan(5);
    });
  }

  test('a 360×640 (caixa abaixo de 200 px) a etiqueta é de uma linha só: a camisa e o nome, sem o tipo; a de gol, a camisa e o título', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const { steps } = await openWithHold(page);
    const shouldBe = model(steps);
    const wrapped: number[] = [];
    let plays = 0;
    let goals = 0;
    await scan(
      page,
      steps,
      [0.5],
      (s) => {
        expect(s.box.height, label(s)).toBeLessThan(200);
        for (const t of s.tags.filter((x) => x.tone !== 'team')) {
          expect(t.compact, label(s)).toBe(true);
          // One row: the shirt and the text centred on the same line.
          expect(Math.abs(t.shirtMid - t.textMid), `${label(s)}: mesma linha`).toBeLessThanOrEqual(
            2,
          );
          if (t.tone === 'goal') {
            goals++;
            expect(t.hasName, `${label(s)}: gol compacto sem nome`).toBe(false);
            expect(t.hasKind, `${label(s)}: título`).toBe(true);
            expect(t.pillH).toBeLessThanOrEqual(41);
          } else {
            plays++;
            expect(t.hasKind, `${label(s)}: sem o tipo`).toBe(false);
            expect(t.hasName, `${label(s)}: nome`).toBe(true);
            expect(t.textChildren, `${label(s)}: só o nome`).toBe(1);
            // Decision 10: a long name may wrap and the pill grows; otherwise it is 40px.
            if (t.nameWrapped) wrapped.push(s.index);
            else expect(t.pillH).toBeLessThanOrEqual(41);
          }
        }
      },
      (i) => shouldBe[i]!.held !== undefined,
    );
    expect(plays).toBeGreaterThan(0);
    expect(goals).toBeGreaterThan(0);
  });
});

test.describe('Campo v2, PR B: a camisa sobre a bola (E2E 5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    test.setTimeout(120_000);
  });

  test('só em passos de minuto cheio, sem etiqueta de lance parada, escondida do leitor, sem número nem nome, e não some no meio do minuto', async ({
    page,
  }) => {
    const { steps } = await openWithHold(page);
    const shouldBe = model(steps);
    const perStep = new Map<number, { counts: number[]; visible: number; tags: Snap[] }>();
    await scan(page, steps, [0.2, 0.5, 0.85], (s) => {
      const team = s.tags.filter((t) => t.tone === 'team');
      expect(team.length, `${label(s)}: no máximo uma camisa`).toBeLessThanOrEqual(1);
      for (const t of team) {
        expect(s.step.timing, `${label(s)}: a camisa só em minuto cheio`).toBe('minuteFull');
        expect(
          shouldBe[s.index]!.held,
          `${label(s)}: sem etiqueta de lance parada`,
        ).toBeUndefined();
        expect(t.ariaHidden, label(s)).toBe('true');
        expect(t.pointer, label(s)).toBe('none');
        expect(t.text, `${label(s)}: sem número nem nome`).toBe('');
        expect(t.hasName || t.hasKind, label(s)).toBe(false);
        expect(Math.round(t.circle), label(s)).toBe(30);
        expect(Math.round(t.pillW), label(s)).toBe(32);
      }
      const entry = perStep.get(s.index) ?? { counts: [], visible: 0, tags: [] };
      entry.counts.push(team.length);
      entry.visible += team.filter((t) => t.visibility !== 'hidden').length;
      perStep.set(s.index, entry);
    });
    let withShirt = 0;
    let samples = 0;
    let visible = 0;
    for (const [index, entry] of perStep) {
      // BLOCKER 1 of the first review: the shirt does not go in the middle of the minute.
      expect(new Set(entry.counts).size, `passo ${index}: a camisa muda no meio do minuto`).toBe(1);
      if (entry.counts[0] === 1) {
        withShirt++;
        samples += entry.counts.length;
        visible += entry.visible;
      }
    }
    expect(withShirt, 'minutos com a camisa sobre a bola').toBeGreaterThan(20);
    // Hidden only by the 12px rule near a goal or the side (the samples are taken after the first
    // measure, so a pill not placed yet is not counted): the rare frame, never the rule.
    expect(visible / samples, 'amostras com a camisa visível').toBeGreaterThan(0.9);
  });

  test('nunca com movimento reduzido: nenhuma camisa em nenhum passo, e a etiqueta de gol e as do lance continuam', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { steps } = await openWithHold(page);
    let minutes = 0;
    let goals = 0;
    await scan(page, steps, [0.4, 0.85], (s) => {
      expect(
        s.tags.filter((t) => t.tone === 'team'),
        label(s),
      ).toHaveLength(0);
      if (s.step.timing === 'minuteFull') minutes++;
      goals += s.tags.filter((t) => t.tone === 'goal').length;
    });
    expect(minutes).toBeGreaterThan(20);
    expect(goals).toBeGreaterThan(0);
  });
  test('a etiqueta aparece já posicionada e visível no passo em que nasce, sem esperar o ResizeObserver: a medida é síncrona na montagem', async ({
    page,
  }) => {
    // O ResizeObserver da pílula nunca avisa (os outros, como o do tamanho do campo, são os de
    // sempre): se a etiqueta tem posição e não está escondida, foi a medida da montagem.
    await page.addInitScript(() => {
      const Real = window.ResizeObserver;
      window.ResizeObserver = class {
        private readonly real: ResizeObserver;
        constructor(callback: ResizeObserverCallback) {
          this.real = new Real(callback);
        }
        observe(element: Element, options?: ResizeObserverOptions) {
          if (element instanceof HTMLElement && element.classList.contains('tag')) return;
          this.real.observe(element, options);
        }
        unobserve(element: Element) {
          this.real.unobserve(element);
        }
        disconnect() {
          this.real.disconnect();
        }
      };
    });
    const { steps } = await openWithHold(page);
    const first = steps.findIndex((s) => planOf(s) !== undefined);
    expect(first).toBeGreaterThan(0);
    // No `runFor` além do que leva ao passo, e nenhuma espera em tempo real antes de ler.
    await page.clock.runFor(timeTo(steps, first) + 20);
    const placed = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('main.match .place')].map((place) => ({
        transform: place.style.transform,
        visibility: place.style.visibility,
      })),
    );
    expect(placed.length).toBeGreaterThan(0);
    for (const tag of placed) {
      expect(tag.transform).toMatch(/^translate3d\(/);
      expect(tag.visibility).not.toBe('hidden');
    }
  });
});

test.describe('Campo v2, PR C: a etiqueta de um disco que já saiu acompanha a âncora reprojetada (revisão do PR C)', () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    test.setTimeout(120_000);
  });

  /** The tip of the pill (where the thread would start) in the page, and the box of the canvas. */
  const tipOf = (page: Page) =>
    page.evaluate(() => {
      const screen = document.querySelector('main.match')!;
      const box = screen.querySelector('canvas')!.getBoundingClientRect();
      const places = [...screen.querySelectorAll<HTMLElement>('.place')].filter(
        (p) => p.querySelector('.tag:not(.team)') !== null,
      );
      const place = places[0];
      if (place === undefined) return undefined;
      const pill = place.querySelector<HTMLElement>('.tag')!;
      const shift = parseFloat(pill.style.getPropertyValue('--tip-shift') || '0');
      const rect = place.getBoundingClientRect();
      return {
        count: places.length,
        leaving: pill.classList.contains('leaving'),
        text: pill.textContent!.trim(),
        // The pill's left edge in the page, so the tip x is the middle of the pill plus the shift.
        x: rect.left + pill.offsetWidth / 2 + shift - box.left,
        y: rect.top + pill.offsetHeight + 7 - box.top,
        width: box.width,
        height: box.height,
      };
    });

  test('o disco já saiu (minuto cheio, etiqueta segurada pelo tempo mínimo): ao redimensionar, a ponta da pílula fica na mesma fração do campo (a âncora é reprojetada, não fica no pixel antigo)', async ({
    page,
  }) => {
    const { steps } = await openWithHold(page);
    const shouldBe = model(steps);
    // A minute with nothing shown where a play tag is held only by the minimum time: its disc is gone.
    const held = steps.findIndex(
      (s, i) =>
        s.timing === 'minuteFull' &&
        planOf(s) === undefined &&
        shouldBe[i]!.held?.tone === 'play' &&
        !shouldBe[i]!.leaving,
    );
    expect(held).toBeGreaterThan(0);
    await page.clock.runFor(timeTo(steps, held) + 0.4 * timingOf(steps[held]!.timing, 'normal'));
    await expect.poll(async () => (await tipOf(page))?.count ?? 0).toBe(1);
    const before = (await tipOf(page))!;
    expect(before.leaving).toBe(false);
    const fx = before.x / before.width;
    const fy = before.y / before.height;

    const seen: number[] = [before.width];
    for (const [width, height] of [
      [844, 390],
      [1280, 800],
      [390, 844],
      [360, 740],
    ] as const) {
      await page.setViewportSize({ width, height });
      // The pill follows the new size: wait for it, never a fixed time (the canvas can be 0 for a moment).
      await expect
        .poll(
          async () => {
            const now = await tipOf(page);
            // Until the canvas has the new size the fraction is trivially the old one: wait for the size first.
            if (now === undefined || now.width < 100 || now.width === seen.at(-1))
              return 'sem medida';
            return Math.abs(now.x / now.width - fx) <= 0.02 &&
              Math.abs(now.y / now.height - fy) <= 0.06
              ? 'ok'
              : `fx ${(now.x / now.width).toFixed(3)} (queria ${fx.toFixed(3)}), fy ${(now.y / now.height).toFixed(3)} (queria ${fy.toFixed(3)})`;
          },
          { message: `${width}×${height}: a ponta fica na âncora reprojetada` },
        )
        .toBe('ok');
      const now = (await tipOf(page))!;
      expect(now.text, `${width}×${height}: a mesma etiqueta`).toBe(before.text);
      expect(now.leaving).toBe(false);
      seen.push(now.width);
    }
    // The boxes were really different sizes (the test would pass with a stuck pill otherwise).
    expect(Math.max(...seen) - Math.min(...seen)).toBeGreaterThan(150);
  });
});
