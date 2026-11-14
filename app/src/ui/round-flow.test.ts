import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { t } from '@lib/i18n';
import ErrorState from './components/ErrorState.svelte';
import type { PlayError } from '@lib/career';
import {
  PLAY_GUARD_MS,
  ROUND_HASH,
  RoundFlow,
  areaErrorOf,
  isRoundHash,
  playOutcome,
  type PlayAnswer,
} from './round-flow';
import { FakeHistory } from './testing/fake-history';

/*
 * The flow of "Jogar rodada" (resumo-rodada.md, "Fluxo da rodada" and "Navegação"; T-030): the
 * summary's own entry in the history, "Continuar" and the back gesture, the window of about
 * 500 ms in which "Jogar rodada" ignores taps after the summary closes, and what the frame does
 * with each answer of `playRound` (never silent). The fake clock stands for the time between taps.
 */

function setup() {
  const history = new FakeHistory('/jogo/#/squad');
  const flow = new RoundFlow(() => history);
  return { history, flow };
}

describe('the protection window of "Jogar rodada" (CEO decision 2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a tap 200 ms after "Continuar" does not play; 600 ms after, it plays', () => {
    const { flow } = setup();
    const play = vi.fn();
    flow.open();
    flow.close('squad');
    vi.advanceTimersByTime(200);
    expect(flow.tap(play)).toBe(false);
    expect(play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(flow.tap(play)).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('the window starts again when the address leaves the summary (back gesture)', () => {
    const { flow } = setup();
    const play = vi.fn();
    flow.open();
    vi.advanceTimersByTime(5_000);
    flow.left();
    vi.advanceTimersByTime(PLAY_GUARD_MS - 1);
    expect(flow.tap(play)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(flow.tap(play)).toBe(true);
  });

  it('before any summary, the first tap plays', () => {
    const { flow } = setup();
    const play = vi.fn();
    expect(flow.tap(play)).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
  });
});

describe('the summary in the history (resumo-rodada.md, "Navegação")', () => {
  it('opens with its own entry, `#/round`, over the tab it came from', () => {
    const { history, flow } = setup();
    flow.open();
    expect(history.length).toBe(2);
    expect(history.location.hash).toBe(ROUND_HASH);
    expect(history.state).toEqual({ round: true });
    expect(isRoundHash(history.location.hash)).toBe(true);
  });

  it('a sheet opened during the round closes with it: its entry becomes the summary’s', () => {
    // The tab, then the card of a player (sheet-history.ts keeps the state below it).
    const history = new FakeHistory('/jogo/#/squad');
    const flow = new RoundFlow(() => history);
    history.pushState({ sheet: 'player-card', player: 'p1' }, '');
    flow.open();
    expect(history.length).toBe(2);
    expect(history.state).toEqual({ round: true });
    expect(history.location.hash).toBe(ROUND_HASH);
    // "Continuar": straight to the tab, with no sheet's entry left behind.
    flow.close('squad');
    expect(history.length).toBe(1);
    expect(history.state).toBeNull();
    expect(history.location.hash).toBe('#/squad');
    // The "Mais" sheet of the frame is an entry too.
    history.pushState({ sheet: true }, '');
    flow.open();
    expect(history.length).toBe(2);
    expect(history.state).toEqual({ round: true });
  });

  it('"Continuar" takes its entry away: back to the tab', () => {
    const { history, flow } = setup();
    const popped = vi.fn();
    history.onPop(popped);
    flow.open();
    expect(flow.close('squad')).toBeUndefined();
    expect(popped).toHaveBeenCalledTimes(1);
    expect(history.location.hash).toBe('#/squad');
    expect(history.length).toBe(1);
  });

  it('a double tap on "Continuar" goes back once, never out of the career', () => {
    const { history, flow } = setup();
    history.pushState(null, '', '#/club');
    flow.open();
    // The browser's back is asynchronous: the second tap comes before the popstate.
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    flow.close('club');
    flow.close('club');
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('without its entry on top (an address typed or restored), the address becomes the tab', () => {
    const history = new FakeHistory('/jogo/#/round');
    const flow = new RoundFlow(() => history);
    expect(flow.close('squad')).toBe('squad');
    expect(history.location.hash).toBe('#/squad');
    expect(history.length).toBe(1);
    // No tab of origin: the Clube.
    history.replaceState(null, '', ROUND_HASH);
    expect(flow.close()).toBe('club');
    expect(history.location.hash).toBe('#/club');
  });

  it('an address of the summary with nothing to show becomes the Clube, in place', () => {
    const history = new FakeHistory('/jogo/#/round');
    const flow = new RoundFlow(() => history);
    expect(flow.toClub()).toBe('club');
    expect(history.location.hash).toBe('#/club');
    expect(history.length).toBe(1);
  });

  it('only `#/round` is the summary', () => {
    expect(isRoundHash('#/round')).toBe(true);
    expect(isRoundHash('#round')).toBe(true);
    for (const hash of ['', '#/', '#/club', '#/rounds', '#/round/2']) {
      expect(isRoundHash(hash), hash).toBe(false);
    }
  });
});

describe('what the frame does with the answer of playRound (resumo-rodada.md, "Estados")', () => {
  const played: PlayAnswer = {
    ok: true,
    value: { report: {} as never, saved: true },
  };

  it('a round played opens the summary, stored or not', () => {
    expect(playOutcome(played, 'open')).toEqual({ kind: 'summary' });
    expect(playOutcome({ ok: true, value: { report: {} as never, saved: false } }, 'open')).toEqual(
      { kind: 'summary' },
    );
  });

  it('a write refused by another tab: no summary (the full-screen error takes over)', () => {
    expect(
      playOutcome({ ok: true, value: { report: {} as never, saved: false } }, 'fatal'),
    ).toEqual({ kind: 'none' });
  });

  it('a second tap while busy does nothing', () => {
    expect(playOutcome({ ok: false, error: 'busy' }, 'open')).toEqual({ kind: 'none' });
  });

  it('any other refusal leaves the error in the content area, with its code: never silent', () => {
    const others: PlayError[] = [
      'not-open',
      'unsaved',
      'season-over',
      'round-already-played',
      'round-not-open',
      'unexpected',
    ];
    for (const error of others) {
      expect(playOutcome({ ok: false, error }, 'open'), error).toEqual({
        kind: 'error',
        code: error,
      });
    }
  });
});

describe('the error of the content area (resumo-rodada.md, "Erro ao jogar")', () => {
  it('a refusal of playRound becomes the area error with its code; a crash comes first', () => {
    expect(areaErrorOf({}, undefined)).toBeUndefined();
    expect(areaErrorOf({}, 'round-not-open')).toBe('round-not-open');
    expect(areaErrorOf({ crash: 'unexpected' }, 'round-not-open')).toBe('unexpected');
    expect(areaErrorOf({ unsaved: 'invalid-save' }, undefined)).toBe('invalid-save');
    expect(areaErrorOf({ unsaved: 'invalid-save' }, 'season-over')).toBe('season-over');
    // A write refused for lack of room is a banner, not the area's error.
    expect(areaErrorOf({ unsaved: 'quota-exceeded' }, undefined)).toBeUndefined();
  });

  it('the answer of playRound reaches the ErrorState of the area, with the code shown', () => {
    const outcome = playOutcome({ ok: false, error: 'round-already-played' }, 'open');
    expect(outcome.kind).toBe('error');
    const code = areaErrorOf({}, outcome.kind === 'error' ? outcome.code : undefined)!;
    // As the frame draws it (CareerFrame.svelte, `areaError`).
    const body = render(ErrorState, {
      props: {
        layout: 'area',
        title: t('error.unexpected.title', 'pt-BR'),
        message: t('error.unexpected.body', 'pt-BR'),
        code: t('error.code', 'pt-BR', { code }),
        primary: { label: t('action.retry', 'pt-BR'), onclick: () => undefined },
      },
    }).body;
    expect(body).toContain('error area');
    expect(body).toContain(t('error.code', 'pt-BR', { code: 'round-already-played' }));
  });
});
