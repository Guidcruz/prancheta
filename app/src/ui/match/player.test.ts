import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testMatches } from '../testing/matches';
import { MatchPlayer, type PlayerState } from './player';
import { matchSteps, viewAt, type MatchStep } from './steps';
import { timingOf } from './timing';

/*
 * The match clock on fake timers (docs/design/telas/partida.md, "Relógio da partida"; "No Vitest
 * (T-032)"): the time from the kick-off to the final whistle is the sum of the steps of the table;
 * a pause only between two minutes, and the clock then shows the next minute to play; resume
 * starts that minute at once; a change of speed counts from the next step; stop shows nothing more.
 */

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const { result } = testMatches().find((m) => m.result.score[0] + m.result.score[1] >= 2)!;
const steps = matchSteps(result.events, 'full');

function run(speed: 'normal' | 'fast' = 'normal', list: readonly MatchStep[] = steps) {
  const states: PlayerState[] = [];
  const revealed: number[] = [];
  const end = vi.fn();
  const player = new MatchPlayer(list, {
    speed,
    onchange: (s) => states.push(s),
    onreveal: (_step, i) => revealed.push(i),
    onend: end,
  });
  return { player, states, revealed, end };
}

const sum = (list: readonly MatchStep[], speed: 'normal' | 'fast') =>
  list.reduce((total, s) => total + timingOf(s.timing, speed), 0);

describe('MatchPlayer', () => {
  it.each(['normal', 'fast'] as const)(
    '%s: from 0’ to the final whistle in the sum of the steps (±5%%), every step once, in order',
    (speed) => {
      for (const mode of ['full', 'highlights'] as const) {
        const list = matchSteps(result.events, mode);
        const { player, revealed, end } = run(speed, list);
        const started = Date.now();
        player.start();
        expect(revealed).toEqual([0]);
        vi.runAllTimers();
        expect(end).toHaveBeenCalledTimes(1);
        const took = Date.now() - started;
        const expected = sum(list, speed);
        expect(Math.abs(took - expected)).toBeLessThanOrEqual(expected * 0.05);
        expect(took).toBe(expected);
        expect(revealed).toEqual(list.map((_, i) => i));
        expect(player.state.ended).toBe(true);
      }
    },
  );

  it('a pause in the middle of a minute ends the minute and stops before the next', () => {
    // A minute with a dramatic pause: ask for the pause during the start of the play.
    const build = steps.findIndex((s) => s.line?.stage === 'build');
    const { player, revealed } = run();
    player.start();
    vi.advanceTimersByTime(sum(steps.slice(0, build), 'normal'));
    expect(revealed.at(-1)).toBe(build);
    player.pause();
    expect(player.state).toMatchObject({ pausing: true, paused: false });
    const slot = steps[build]!.slot;
    const lastOfSlot = steps.findLastIndex((s) => s.slot === slot);
    vi.advanceTimersByTime(sum(steps.slice(build, lastOfSlot + 1), 'normal'));
    // The outcome was shown; the next minute was not.
    expect(revealed.at(-1)).toBe(lastOfSlot);
    expect(player.state).toMatchObject({ paused: true, pausing: false, index: lastOfSlot });
    const view = viewAt(steps, player.state.index, player.state.paused);
    expect(view.clock).toEqual(steps[lastOfSlot + 1]!.clock);
    // Nothing moves while paused.
    vi.advanceTimersByTime(60_000);
    expect(revealed.at(-1)).toBe(lastOfSlot);
    // Resume: the next minute at once.
    player.resume();
    expect(revealed.at(-1)).toBe(lastOfSlot + 1);
    expect(player.state.paused).toBe(false);
  });

  it('every pause stops between two minutes, never inside one', () => {
    const { player } = run('fast');
    player.start();
    for (let i = 0; i < 25 && !player.state.ended; i++) {
      vi.advanceTimersByTime(137 * (i + 1));
      player.pause();
      vi.advanceTimersByTime(10_000);
      const { index, paused, ended } = player.state;
      if (ended) break;
      expect(paused).toBe(true);
      expect(steps[index + 1]!.slot).not.toBe(steps[index]!.slot);
      player.resume();
    }
  });

  it('"Retomar" before the minute ends drops the pause; toggle is the same button', () => {
    const { player } = run();
    player.start();
    player.toggle();
    expect(player.state.pausing).toBe(true);
    player.toggle();
    expect(player.state).toMatchObject({ pausing: false, paused: false });
    vi.advanceTimersByTime(5_000);
    expect(player.state.paused).toBe(false);
    expect(player.state.index).toBeGreaterThan(0);
  });

  it('a change of speed counts from the next step', () => {
    const { player, revealed } = run('normal');
    player.start();
    // Step 0 (the kick-off) waits 400 ms in Normal; switching to Rápido keeps that wait.
    player.setSpeed('fast');
    expect(player.state.speed).toBe('fast');
    vi.advanceTimersByTime(timingOf(steps[0]!.timing, 'fast'));
    expect(revealed).toEqual([0]);
    vi.advanceTimersByTime(
      timingOf(steps[0]!.timing, 'normal') - timingOf(steps[0]!.timing, 'fast'),
    );
    expect(revealed).toEqual([0, 1]);
    // Step 1 already waits for the fast duration.
    vi.advanceTimersByTime(timingOf(steps[1]!.timing, 'fast'));
    expect(revealed).toEqual([0, 1, 2]);
  });

  it('stop (Pular) shows nothing more and ignores the controls', () => {
    const { player, revealed, end } = run();
    player.start();
    vi.advanceTimersByTime(3_000);
    const shown = revealed.length;
    player.stop();
    vi.runAllTimers();
    player.resume();
    player.start();
    expect(revealed).toHaveLength(shown);
    expect(end).not.toHaveBeenCalled();
    expect(player.state.stopped).toBe(true);
  });

  it('pause after the final whistle does nothing', () => {
    const { player } = run('fast');
    player.start();
    vi.runAllTimers();
    player.pause();
    expect(player.state).toMatchObject({ ended: true, paused: false, pausing: false });
  });
});
