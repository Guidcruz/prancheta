import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '@engine';
import { testMatches } from '../testing/matches';
import { hasDrama, isShown, matchMinutes, matchSteps, viewAt, type WatchMode } from './steps';
import { MATCH_TIMING, timingOf, type TimingKey } from './timing';

/*
 * The clock of the match as a pure function (docs/design/telas/partida.md, "Relógio da partida",
 * "Narração em texto", "Pausa dramática"; "No Vitest (T-032)"), on 60 real matches of the engine:
 * the same events and mode give the same steps; each mode's filter; the dramatic pause on every
 * goal, clear chance and penalty, never on a weak chance; the score changes only on an outcome;
 * the minutes from 0' to the final whistle; the paused clock shows the next minute to play.
 */

const MODES: readonly WatchMode[] = ['full', 'highlights'];
const matches = testMatches();

/** The events that have a line (a start or a final one), each once, in the order shown. */
const lined = (events: readonly MatchEvent[], mode: WatchMode): MatchEvent[] => {
  const seen: MatchEvent[] = [];
  for (const step of matchSteps(events, mode)) {
    const source = step.line?.source;
    if (source === undefined || source.type === 'secondHalf') continue;
    if (!seen.includes(source)) seen.push(source);
  }
  return seen;
};

describe('matchSteps', () => {
  it('the same events and mode give the same steps', () => {
    for (const { result } of matches.slice(0, 10)) {
      for (const mode of MODES) {
        expect(matchSteps([...result.events], mode)).toEqual(matchSteps(result.events, mode));
      }
    }
  });

  it('"Animada completa" shows every event but the half-time talk, once, in the order of the engine', () => {
    for (const { result } of matches) {
      const shown = lined(result.events, 'full');
      expect(shown).toEqual(result.events.filter((e) => e.type !== 'halftimeTalk'));
    }
  });

  it('"Só lances principais" shows importance 2 or more and the phases, nothing else', () => {
    let weak = 0;
    for (const { result } of matches) {
      const shown = lined(result.events, 'highlights');
      expect(shown).toEqual(
        result.events.filter(
          (e) =>
            e.type !== 'halftimeTalk' &&
            (e.importance >= 2 || ['kickoff', 'stoppage', 'halftime', 'fulltime'].includes(e.type)),
        ),
      );
      for (const e of shown) {
        expect(['yellow', 'substitution', 'tacticChange', 'halftimeTalk']).not.toContain(e.type);
        if (e.type === 'chance') expect(e.importance).toBe(2);
      }
      weak += result.events.filter((e) => e.type === 'chance' && e.importance === 1).length;
    }
    expect(weak, 'the matches have weak chances to leave out').toBeGreaterThan(0);
  });

  it('every goal, clear chance and penalty has its start, then the outcome in the same line', () => {
    let goals = 0;
    let penalties = 0;
    for (const { result } of matches) {
      for (const mode of MODES) {
        const steps = matchSteps(result.events, mode);
        steps.forEach((step, i) => {
          if (step.line?.stage !== 'build') return;
          expect(step.timing).toBe('drama');
          expect(step.announce?.type === 'penaltyAwarded' || step.announce === undefined).toBe(
            true,
          );
          const next = steps[i + 1]!;
          expect(next.line?.id).toBe(step.line.id);
          expect(next.line?.stage).toBe('final');
          expect(next.slot).toBe(step.slot);
          const outcome = next.line!.source as MatchEvent;
          expect(next.timing).toBe(outcome.type === 'goal' ? 'afterGoal' : 'afterMiss');
          if (outcome.type === 'goal') goals += 1;
          if (step.line.source.type === 'penaltyAwarded') penalties += 1;
        });
        for (const e of result.events.filter((e) => isShown(e, mode) && hasDrama(e))) {
          const index = result.events.indexOf(e);
          const at = steps.findIndex((s) => s.line?.id === `e${index}`);
          if (e.type === 'goal' && e.kind === 'penalty') continue; // the line of its award
          expect(steps[at]!.line!.stage, `${e.type} has a start`).toBe('build');
        }
      }
    }
    expect(goals).toBeGreaterThan(50);
    expect(penalties, 'some penalty in 60 matches').toBeGreaterThan(0);
  });

  it('a weak chance and the other plays have no dramatic pause', () => {
    for (const { result } of matches) {
      for (const step of matchSteps(result.events, 'full')) {
        const source = step.line?.source;
        if (source === undefined || step.line!.stage === 'build') continue;
        if (source.type === 'chance' && source.importance === 1) expect(step.timing).toBe('event');
        if (['yellow', 'red', 'injury', 'substitution', 'tacticChange'].includes(source.type)) {
          expect(step.timing).toBe('event');
        }
      }
    }
  });

  it('the score changes only with a goal revealed, and ends as the engine’s', () => {
    for (const { result } of matches) {
      for (const mode of MODES) {
        const steps = matchSteps(result.events, mode);
        for (const step of steps) {
          if (step.score === undefined) continue;
          const source = step.line?.source;
          expect(source?.type === 'goal' || source?.type === 'fulltime').toBe(true);
          expect(step.line?.stage).toBe('final');
        }
        const end = viewAt(steps, steps.length - 1);
        expect(end.ended).toBe(true);
        expect(end.score).toEqual(result.score);
        expect(end.phase).toBe('end');
      }
    }
  });

  it('the minutes go from 0 to the final whistle, the second half starting at 46 with its line', () => {
    for (const { result } of matches) {
      const minutes = matchMinutes(result.events);
      expect(minutes[0]).toEqual({ minute: 0, half: 1 });
      const end = result.events.at(-1)!;
      expect(end.type).toBe('fulltime');
      expect(minutes.at(-1)).toEqual({
        minute: end.minute,
        ...(end.added === undefined ? {} : { added: end.added }),
        half: end.half,
      });
      const steps = matchSteps(result.events, 'highlights');
      expect(new Set(steps.map((s) => s.slot)).size).toBe(minutes.length);
      const second = steps.find((s) => s.line?.id === 'second-half');
      if (minutes.some((m) => m.half === 2)) {
        expect(second?.clock).toEqual({ minute: 46, half: 2 });
        expect(second?.phase).toBe('second');
      }
      // Slots never go back.
      steps.forEach((s, i) => i > 0 && expect(s.slot).toBeGreaterThanOrEqual(steps[i - 1]!.slot));
    }
  });

  it('a minute with nothing shown waits for the empty minute of its mode', () => {
    const { result } = matches[0]!;
    const empty = (mode: WatchMode) =>
      matchSteps(result.events, mode).filter((s) => s.line === undefined);
    expect(empty('full').length).toBeGreaterThan(20);
    for (const s of empty('full')) expect(s.timing).toBe('minuteFull');
    for (const s of empty('highlights')) expect(s.timing).toBe('minuteHighlights');
  });

  it('only the outcomes, the penalty awarded, the red and the phases are announced', () => {
    for (const { result } of matches) {
      const steps = matchSteps(result.events, 'full');
      const announced = steps.flatMap((s) => (s.announce === undefined ? [] : [s.announce.type]));
      const expected = result.events
        .map((e) => e.type)
        .filter((type) =>
          ['goal', 'penaltyAwarded', 'penaltyMissed', 'red', 'halftime', 'fulltime'].includes(type),
        );
      expect(announced).toEqual(expected);
      for (const step of steps) {
        if (step.line?.stage === 'build' && step.line.source.type !== 'penaltyAwarded') {
          expect(step.announce).toBeUndefined();
        }
      }
    }
  });
});

describe('a match ended early ("Jogo encerrado": fulltime with `abandoned`)', () => {
  // The home side falls below 7 at 30': the match ends there, with the awarded score.
  const events: MatchEvent[] = [
    { minute: 0, half: 1, importance: 1, type: 'kickoff' },
    {
      minute: 10,
      half: 1,
      importance: 3,
      type: 'goal',
      side: 'home',
      scorer: 'a#9',
      kind: 'open',
      score: [1, 0],
    },
    {
      minute: 30,
      half: 1,
      importance: 3,
      type: 'red',
      side: 'home',
      player: 'a#4',
      reason: 'direct',
    },
    { minute: 30, half: 1, importance: 3, type: 'fulltime', score: [0, 3], abandoned: true },
  ];

  it.each(['full', 'highlights'] as const)(
    "%s: the minutes stop at 30', the score is the awarded one",
    (mode) => {
      const minutes = matchMinutes(events);
      expect(minutes).toHaveLength(31);
      expect(minutes.at(-1)).toEqual({ minute: 30, half: 1 });
      const steps = matchSteps(events, mode);
      const last = steps.at(-1)!;
      expect(last.clock).toEqual({ minute: 30, half: 1 });
      expect(last.line?.source).toBe(events[3]);
      expect(last.timing).toBeUndefined();
      expect(last.announce).toBe(events[3]);
      const end = viewAt(steps, steps.length - 1);
      expect(end).toMatchObject({
        score: [0, 3],
        phase: 'end',
        ended: true,
        clock: { minute: 30, half: 1 },
      });
      // Before the whistle, the real goal; no half time, no second half, no stoppage.
      expect(viewAt(steps, steps.length - 2).score).toEqual([1, 0]);
      expect(steps.some((s) => s.line?.id === 'second-half')).toBe(false);
      expect(steps.some((s) => s.phase === 'half' || s.phase === 'second')).toBe(false);
    },
  );
});

describe('viewAt', () => {
  const { result } = matches.find((m) => m.result.score[0] + m.result.score[1] >= 2)!;
  const steps = matchSteps(result.events, 'full');

  it('opens at 0’ with the kick-off line, 0 × 0, first half', () => {
    const view = viewAt(steps, 0);
    expect(view.clock).toEqual({ minute: 0, half: 1 });
    expect(view.score).toEqual([0, 0]);
    expect(view.phase).toBe('first');
    expect(view.lines.map((l) => l.source.type)).toEqual(['kickoff']);
    expect(view.ended).toBe(false);
  });

  it('the most recent line on top; the outcome replaces its start in place', () => {
    const build = steps.findIndex((s) => s.line?.stage === 'build');
    const atBuild = viewAt(steps, build);
    expect(atBuild.lines[0]!.stage).toBe('build');
    const count = atBuild.lines.length;
    const atOutcome = viewAt(steps, build + 1);
    expect(atOutcome.lines).toHaveLength(count);
    expect(atOutcome.lines[0]!.id).toBe(atBuild.lines[0]!.id);
    expect(atOutcome.lines[0]!.stage).toBe('final');
    expect(atOutcome.lines.slice(1)).toEqual(atBuild.lines.slice(1));
  });

  it('paused, the clock shows the next minute to play', () => {
    const lastOfSlot = steps.findIndex((s, i) => s.slot === 10 && steps[i + 1]?.slot === 11);
    expect(viewAt(steps, lastOfSlot).clock).toEqual(steps[lastOfSlot]!.clock);
    expect(viewAt(steps, lastOfSlot, true).clock).toEqual(steps[lastOfSlot + 1]!.clock);
    expect(viewAt(steps, lastOfSlot, true).clock.minute).toBe(steps[lastOfSlot]!.clock.minute + 1);
  });

  it('the last announcement is the event of the last step that announced', () => {
    const at = steps.findIndex((s) => s.announce !== undefined);
    expect(viewAt(steps, at).announce).toBe(steps[at]!.announce);
    expect(viewAt(steps, at - 1).announce).toBeUndefined();
  });
});

describe('the duration of a match (MATCH_TIMING)', () => {
  const total = (keys: readonly (TimingKey | undefined)[], speed: 'normal' | 'fast') =>
    keys.reduce((sum, key) => sum + timingOf(key, speed), 0);

  it('the table of partida.md', () => {
    expect(MATCH_TIMING).toEqual({
      normal: {
        minuteFull: 500,
        minuteHighlights: 180,
        event: 400,
        drama: 1200,
        afterGoal: 2000,
        afterMiss: 600,
        interval: 2000,
      },
      fast: {
        minuteFull: 200,
        minuteHighlights: 70,
        event: 150,
        drama: 500,
        afterGoal: 800,
        afterMiss: 250,
        interval: 800,
      },
    });
  });

  it('on average, “Só lances principais” takes about 30 s and 12 s; the full mode waits for T-085', () => {
    const mean = (mode: WatchMode, speed: 'normal' | 'fast') =>
      matches.reduce(
        (sum, { result }) =>
          sum +
          total(
            matchSteps(result.events, mode).map((s) => s.timing),
            speed,
          ),
        0,
      ) / matches.length;
    // The estimates are rough (about 40 plays per match): the measured means are in the CHANGELOG.
    expect(mean('full', 'normal')).toBeGreaterThan(50_000);
    expect(mean('full', 'normal')).toBeLessThan(100_000);
    // "Só lances principais" after the CEO's decision of 2026-11-15 (empty minute 180/70 ms):
    // about 30 s in Normal and 12 s in Rápido (measured: 28.8 s and 11.4 s on these 60 matches).
    expect(mean('highlights', 'normal')).toBeGreaterThan(25_000);
    expect(mean('highlights', 'normal')).toBeLessThan(35_000);
    expect(mean('highlights', 'fast')).toBeGreaterThan(9_000);
    expect(mean('highlights', 'fast')).toBeLessThan(14_000);
    expect(mean('full', 'fast')).toBeLessThan(mean('full', 'normal') / 2);
    expect(mean('highlights', 'fast')).toBeLessThan(mean('highlights', 'normal') / 2);
  });
});
