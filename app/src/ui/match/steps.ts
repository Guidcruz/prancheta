// Relative imports with their extension, so the E2E reads the same steps (tests/e2e/match.spec.ts).
import type { MatchEvent } from '../../engine/index.ts';
import type { TimingKey } from './timing.ts';

/*
 * The clock of the assisted match as a pure function of the events and the mode
 * (docs/design/telas/partida.md, "Relógio da partida", "Narração em texto" and "Pausa
 * dramática"): the engine's `MatchEvent` list of the coach's match, already complete before the
 * kick-off, becomes a list of steps, each with what it shows and what it waits for. The screen only
 * decides when each step is shown; nothing here reaches the engine, so nothing here can change the
 * result. No DOM, no timer (player.ts runs the steps), no text (narration.ts writes them).
 *
 * The minutes are the slots of the clock: 0' (the kick-off), 1' to 45', the first half's added
 * minutes, 46' to 90' and the second half's, up to the minute of the final whistle. The plays of a
 * minute come in order, each with its own wait; a minute with nothing shown waits for the empty
 * minute of its mode. A pause asked in the middle of a minute ends that minute (with the outcome of
 * a dramatic pause) and stops before the next (player.ts), so what the player sees is always a
 * whole state of the match, and the clock then shows the next minute to play (the convention of
 * the commands of T-033).
 */

/** How the coach watches (the engine's other mode, `result`, never opens the match screen). */
export type WatchMode = 'full' | 'highlights';

export type MatchPhase = 'first' | 'half' | 'second' | 'end';

/** A minute of the clock: regulation minute, added minute (45+2, 90+4) and half. */
export interface MatchClock {
  readonly minute: number;
  readonly added?: number;
  readonly half: 1 | 2;
}

/** The start of the second half: a line of the screen, not an event of the engine. */
export interface SecondHalfLine {
  readonly type: 'secondHalf';
  readonly minute: 46;
  readonly half: 2;
}

export type LineSource = MatchEvent | SecondHalfLine;

/**
 * A line of the commentary as a step leaves it. `build` is the start of a play with a dramatic
 * pause ("Fulano finaliza..."), the same for a goal and a chance of the same kind; `final` is the
 * event itself, which replaces the start in place (same `id`).
 */
export interface LineState {
  readonly id: string;
  readonly source: LineSource;
  readonly stage: 'build' | 'final';
  /** The minute the line is shown at. */
  readonly clock: MatchClock;
}

export interface MatchStep {
  /** The minute this step belongs to (its index in the match's minutes). */
  readonly slot: number;
  /** The minute on the clock while the step is shown. */
  readonly clock: MatchClock;
  /** What the step waits for once shown; none for the final whistle, the last step. */
  readonly timing?: TimingKey;
  /** The line it adds or replaces (none for a minute with nothing shown). */
  readonly line?: LineState;
  /** The event whose sentence goes to the screen reader with this step (after an outcome). */
  readonly announce?: MatchEvent;
  /** The score from this step on, when it changes (a goal revealed, the awarded score). */
  readonly score?: readonly [number, number];
  /** The phase while the step is shown. */
  readonly phase: MatchPhase;
}

/** The phases of the match: shown in both modes, they are the marks of the clock. */
const PHASE_EVENTS: ReadonlySet<MatchEvent['type']> = new Set([
  'kickoff',
  'stoppage',
  'halftime',
  'fulltime',
]);

/**
 * The event has a line in `mode`: every event in "Animada completa"; in "Só lances principais"
 * the engine's importance 2 or more (goals, clear chances, penalties, reds, injuries, half and full
 * time) and the phases. The half-time talk is never narrated in T-032 (the coach's talk is T-033's;
 * the AI's is not narrated).
 */
export function isShown(event: MatchEvent, mode: WatchMode): boolean {
  if (event.type === 'halftimeTalk') return false;
  return mode === 'full' || PHASE_EVENTS.has(event.type) || event.importance >= 2;
}

/**
 * A play with a dramatic pause: every goal, every clear chance (importance 2: `pGoal ≥ 0.25` or
 * the post) and every penalty. A weak chance never has one, so a pause always says "it may be a
 * goal" and leaves the outcome open.
 */
export function hasDrama(event: MatchEvent): boolean {
  if (event.type === 'goal' || event.type === 'penaltyAwarded') return true;
  return event.type === 'chance' && event.importance >= 2;
}

const keyOf = (c: MatchClock) => `${c.half}-${c.minute}-${c.added ?? 0}`;
const sameClock = (a: MatchClock, b: MatchClock) => keyOf(a) === keyOf(b);

/** The minutes of a match as the engine played them, from 0' to the final whistle. */
export function matchMinutes(events: readonly MatchEvent[]): MatchClock[] {
  const added = (half: 1 | 2) =>
    events.find(
      (e): e is Extract<MatchEvent, { type: 'stoppage' }> =>
        e.type === 'stoppage' && e.half === half,
    )?.minutes ?? 0;
  const minutes: MatchClock[] = [{ minute: 0, half: 1 }];
  for (const half of [1, 2] as const) {
    const last = half * 45;
    for (let minute = last - 44; minute <= last; minute++) minutes.push({ minute, half });
    for (let extra = 1; extra <= added(half); extra++) {
      minutes.push({ minute: last, added: extra, half });
    }
  }
  const end = events.find((e) => e.type === 'fulltime');
  if (end === undefined) return minutes;
  const at = minutes.findIndex((m) => sameClock(m, end));
  return at === -1 ? minutes : minutes.slice(0, at + 1);
}

const clockOf = (e: { minute: number; added?: number; half: 1 | 2 }): MatchClock => ({
  minute: e.minute,
  ...(e.added === undefined ? {} : { added: e.added }),
  half: e.half,
});

/** The outcome of a penalty: the goal from the spot or the miss of the same side. */
function penaltyOutcome(
  awarded: Extract<MatchEvent, { type: 'penaltyAwarded' }>,
  next: MatchEvent | undefined,
): MatchEvent | undefined {
  if (next === undefined || !('side' in next) || next.side !== awarded.side) return undefined;
  if (next.type === 'penaltyMissed') return next;
  if (next.type === 'goal' && next.kind === 'penalty') return next;
  return undefined;
}

const ANNOUNCED: ReadonlySet<MatchEvent['type']> = new Set([
  'goal',
  'penaltyAwarded',
  'penaltyMissed',
  'red',
  'halftime',
  'fulltime',
]);

/**
 * The steps of the match in `mode`. Pure: the same events and mode always give the same steps.
 * The durations are the speed's (timing.ts); a change of speed counts from the next step.
 */
export function matchSteps(events: readonly MatchEvent[], mode: WatchMode): MatchStep[] {
  const byMinute = new Map<string, { event: MatchEvent; index: number }[]>();
  events.forEach((event, index) => {
    const key = keyOf(event);
    if (!byMinute.has(key)) byMinute.set(key, []);
    byMinute.get(key)!.push({ event, index });
  });
  const steps: MatchStep[] = [];
  let phase: MatchPhase = 'first';
  const push = (step: Omit<MatchStep, 'phase'>) => steps.push({ ...step, phase });

  matchMinutes(events).forEach((clock, slot) => {
    const before = steps.length;
    if (clock.half === 2 && clock.minute === 46 && clock.added === undefined) {
      phase = 'second';
      push({
        slot,
        clock,
        timing: 'event',
        line: {
          id: 'second-half',
          source: { type: 'secondHalf', minute: 46, half: 2 },
          stage: 'final',
          clock,
        },
      });
    }
    const list = (byMinute.get(keyOf(clock)) ?? []).filter(({ event }) => isShown(event, mode));
    for (let i = 0; i < list.length; i++) {
      const { event, index } = list[i]!;
      const id = `e${index}`;
      const at = clockOf(event);
      const announce = ANNOUNCED.has(event.type) ? { announce: event } : {};
      if (event.type === 'penaltyAwarded') {
        const outcome = penaltyOutcome(event, list[i + 1]?.event);
        // The start of a penalty is the award itself, announced (it does not say if it goes in).
        push({
          slot,
          clock,
          timing: outcome === undefined ? 'event' : 'drama',
          line: { id, source: event, stage: outcome === undefined ? 'final' : 'build', clock: at },
          announce: event,
        });
        if (outcome === undefined) continue;
        i += 1;
        push({
          slot,
          clock,
          timing: outcome.type === 'goal' ? 'afterGoal' : 'afterMiss',
          line: { id, source: outcome, stage: 'final', clock: at },
          announce: outcome,
          ...(outcome.type === 'goal' ? { score: outcome.score } : {}),
        });
        continue;
      }
      if (hasDrama(event)) {
        // The start: the same line, the same wait and no sentence for a goal and for a chance.
        push({
          slot,
          clock,
          timing: 'drama',
          line: { id, source: event, stage: 'build', clock: at },
        });
        push({
          slot,
          clock,
          timing: event.type === 'goal' ? 'afterGoal' : 'afterMiss',
          line: { id, source: event, stage: 'final', clock: at },
          ...announce,
          ...(event.type === 'goal' ? { score: event.score } : {}),
        });
        continue;
      }
      if (event.type === 'halftime') phase = 'half';
      if (event.type === 'fulltime') phase = 'end';
      push({
        slot,
        clock,
        ...(event.type === 'fulltime'
          ? { score: event.score }
          : { timing: event.type === 'halftime' ? ('interval' as const) : ('event' as const) }),
        line: { id, source: event, stage: 'final', clock: at },
        ...announce,
      });
    }
    if (steps.length === before) {
      push({ slot, clock, timing: mode === 'full' ? 'minuteFull' : 'minuteHighlights' });
    }
  });
  return steps;
}

/** What the screen shows once the steps up to `index` are shown. */
export interface MatchView {
  /** The lines, the most recent first; a line replaced in place keeps its position. */
  readonly lines: readonly LineState[];
  readonly score: readonly [number, number];
  /** The minute on the clock: with the match paused, the next minute to play. */
  readonly clock: MatchClock;
  readonly phase: MatchPhase;
  /** The event of the last sentence for the screen reader. */
  readonly announce?: MatchEvent;
  /** The final whistle is shown. */
  readonly ended: boolean;
}

/** The view after the steps `0..index`; `paused` shows the next minute to play on the clock. */
export function viewAt(steps: readonly MatchStep[], index: number, paused = false): MatchView {
  const order: string[] = [];
  const lines = new Map<string, LineState>();
  let score: readonly [number, number] = [0, 0];
  let announce: MatchView['announce'];
  const last = Math.min(index, steps.length - 1);
  for (let i = 0; i <= last; i++) {
    const step = steps[i]!;
    if (step.line !== undefined) {
      if (!lines.has(step.line.id)) order.push(step.line.id);
      lines.set(step.line.id, step.line);
    }
    if (step.score !== undefined) score = step.score;
    if (step.announce !== undefined) announce = step.announce;
  }
  const current = steps[last];
  const next = paused ? steps[last + 1] : undefined;
  return {
    lines: order.reverse().map((id) => lines.get(id)!),
    score,
    clock: (next ?? current)?.clock ?? { minute: 0, half: 1 },
    phase: current?.phase ?? 'first',
    ...(announce === undefined ? {} : { announce }),
    ended: current !== undefined && current.timing === undefined,
  };
}
