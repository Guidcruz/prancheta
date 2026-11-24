import { describe, expect, it } from 'vitest';
import { type MatchEvent, type MatchInput, type PlayerId, type Side } from '@engine';
import { testMatchesOf } from '../../testing/matches';
import { commentaryItem, nameOf, type NarrationContext } from '../narration';
import { matchSteps, type MatchStep } from '../steps';
import { tagPlanOf } from '../tags';
import { PITCH_MOTION, PITCH_SIZE } from './motion';
import { choreograph, createScene, physicalOf, sceneAt, stillScene, tagDiscOf } from './scene';

/*
 * The anchor of the discs (docs/design/telas/partida-campo-v2.md, 10 and 13, "Vitest, âncora"),
 * on a corpus of about 200 matches with fixed seeds, real lineups, substitutions, red cards and
 * injuries. The goalkeeper of each step is replayed here, event by event, independent of the
 * choreography. 200 matches by default; PITCH_ANCHOR_FULL=1 adds two more seeds (600 in all), for
 * the release.
 */

const SEEDS = process.env['PITCH_ANCHOR_FULL'] === '1' ? [2026, 7, 31] : [2026, 7];
const corpus = SEEDS.flatMap((seed) => testMatchesOf(seed, 10));
const lineupsOf = (match: MatchInput) => ({
  home: { ...match.home.sheet.lineup, players: match.home.players },
  away: { ...match.away.sheet.lineup, players: match.away.players },
});

/** The player of each of the 11 slots after each step, replayed from the events alone. */
function replay(steps: readonly MatchStep[], match: MatchInput) {
  const slots: Record<Side, (PlayerId | null)[]> = {
    home: [...match.home.sheet.lineup.starters],
    away: [...match.away.sheet.lineup.starters],
  };
  const all = [...match.home.players, ...match.away.players];
  const physical = (id: PlayerId) => physicalOf(all.find((p) => p.id === id)!);
  const events = steps.flatMap((s) => (s.line?.stage === 'final' ? [s.line.source] : []));
  return steps.map((step) => {
    const source = step.line?.source;
    if (step.line?.stage === 'final' && source !== undefined) {
      if (source.type === 'substitution') {
        const at = slots[source.side].indexOf(source.out);
        if (at !== -1) slots[source.side][at] = source.in;
      } else if (
        source.type === 'red' ||
        (source.type === 'injury' &&
          !events.some(
            (e) => e.type === 'substitution' && e.side === source.side && e.out === source.player,
          ))
      ) {
        const at = slots[source.side].indexOf(source.player);
        if (at === 0) {
          // The engine's rule (fillEmptyGoal): the outfield player on the pitch of most
          // `physical`, the first slot on a tie.
          let best = -1;
          for (let i = 1; i < 11; i++) {
            const id = slots[source.side][i];
            if (id === null || id === undefined) continue;
            if (best === -1 || physical(id) > physical(slots[source.side][best]!)) best = i;
          }
          if (best !== -1) {
            slots[source.side][0] = slots[source.side][best]!;
            slots[source.side][best] = null;
          }
        } else if (at > 0) slots[source.side][at] = null;
      }
    }
    return { home: slots.home[0], away: slots.away[0] };
  });
}

const finisherOf = (source: MatchEvent): PlayerId | undefined =>
  source.type === 'chance'
    ? source.shooter
    : source.type === 'goal'
      ? source.scorer
      : source.type === 'penaltyAwarded' || source.type === 'penaltyMissed'
        ? source.taker
        : undefined;

describe('the anchor on a corpus of 200 matches (partida-campo-v2.md, 13)', () => {
  it('has the matches and the events the criterion asks for', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(200);
    const types = new Set<string>();
    let keeperOff = 0;
    for (const { result } of corpus) {
      for (const e of result.events) types.add(e.type);
    }
    for (const { match, result } of corpus) {
      const steps = matchSteps(result.events, 'full');
      const keepers = replay(steps, match);
      const first = keepers[0]!;
      if (keepers.some((k) => k.home !== first.home || k.away !== first.away)) keeperOff++;
    }
    for (const type of ['goal', 'chance', 'substitution', 'red', 'injury', 'penaltyAwarded']) {
      expect(types.has(type), `no ${type} in the corpus`).toBe(true);
    }
    // Matches where the goalkeeper of a side changed at some point (a substitution or a red).
    expect(keeperOff).toBeGreaterThan(0);
  });

  it('every step with a disc has it made for the PlayerId of the event; the keeper is the owner of the keeper slot', () => {
    let plays = 0;
    let reds = 0;
    for (const { match, result } of corpus) {
      const steps = matchSteps(result.events, 'full');
      const choreo = choreograph(steps, lineupsOf(match), match.seed);
      expect(choreo.unknown).toEqual([]);
      const keepers = replay(steps, match);
      const out = createScene();
      steps.forEach((step, i) => {
        const source = step.line?.source;
        const alpha = stillScene(choreo, i, out).alpha;
        const shown = [...alpha].flatMap((a, d) => (a === 1 ? [choreo.steps[i]!.owner[d]] : []));
        if (source === undefined || source.type === 'secondHalf') return;
        if (source.type === 'red') {
          // The sent-off, with his disc still in sight at the end of the step (reduced motion).
          reds++;
          expect(shown).toEqual([source.player]);
          return;
        }
        const finisher = finisherOf(source);
        if (finisher === undefined || step.timing === undefined || !('side' in source)) {
          expect(shown).toEqual([]);
          return;
        }
        plays++;
        const defending = source.side === 'home' ? 'away' : 'home';
        expect(new Set(shown)).toEqual(new Set([finisher, keepers[i]![defending]]));
      });
    }
    expect(plays).toBeGreaterThan(1000);
    expect(reds).toBeGreaterThan(0);
  });

  it('at the end of the start of a play of the open game the ball is within 0.1 m of the finisher; a penalty has the ball on the spot', () => {
    let opens = 0;
    let penalties = 0;
    for (const { match, result } of corpus) {
      const steps = matchSteps(result.events, 'full');
      const choreo = choreograph(steps, lineupsOf(match), match.seed);
      const out = createScene();
      steps.forEach((step, i) => {
        if (step.line?.stage !== 'build') return;
        // The step after a goal is the new kick-off: the play is shown from the formation spots.
        if (steps[i - 1]?.timing === 'afterGoal') return;
        const source = step.line.source as MatchEvent & { side: Side };
        const finisher = finisherOf(source);
        if (finisher === undefined) return;
        const disc = choreo.steps[i]!.owner.indexOf(finisher);
        expect(disc, `${source.type}: no disc for the finisher`).toBeGreaterThanOrEqual(0);
        const at = sceneAt(choreo, i, 1, out);
        const gap = Math.hypot(at.ballX - at.x[disc]!, at.ballY - at.y[disc]!);
        if (source.type === 'penaltyAwarded') {
          penalties++;
          const goal = source.side === 'home' ? PITCH_SIZE.length : 0;
          expect(Math.abs(Math.abs(at.ballX - goal) - PITCH_MOTION.penalty.spot)).toBeLessThan(
            1e-9,
          );
          // The taker is on the spot's line, behind the ball (decorative position).
          expect(Math.abs(at.y[disc]! - at.ballY)).toBeLessThan(1e-9);
          expect(gap).toBeLessThanOrEqual(PITCH_MOTION.penalty.behind + 0.1);
        } else if (source.type === 'chance' || source.type === 'goal') {
          opens++;
          expect(gap, `${source.type} at step ${i}`).toBeLessThanOrEqual(0.1);
        }
      });
    }
    expect(opens).toBeGreaterThan(500);
    expect(penalties).toBeGreaterThan(0);
  });
});

describe('the tag of each step (partida-campo-v2.md, 9, 10 and 13, anchor 3)', () => {
  const ctxOf = (game: (typeof corpus)[number]['game'], match: MatchInput): NarrationContext => ({
    game,
    homeId: match.home.clubId,
    awayId: match.away.clubId,
    lang: 'pt-BR',
  });

  it('hangs from the disc of the PlayerId of the event, with his name and his shirt number, as the line of the same step says', () => {
    let tags = 0;
    let goals = 0;
    let reds = 0;
    let afterGoal = 0;
    for (const { game, match, result } of corpus) {
      const steps = matchSteps(result.events, 'full');
      const choreo = choreograph(steps, lineupsOf(match), match.seed);
      const ctx = ctxOf(game, match);
      const squad = new Map([...match.home.players, ...match.away.players].map((p) => [p.id, p]));
      const out = createScene();
      steps.forEach((step, i) => {
        const plan = tagPlanOf(step);
        const source = step.line?.source;
        const finisher =
          source === undefined || source.type === 'secondHalf' ? undefined : finisherOf(source);
        // A play (or a red card) has a tag, and only a play or a red card does.
        const expected =
          step.timing !== undefined &&
          (finisher !== undefined || source?.type === 'red') &&
          source !== undefined &&
          'side' in source;
        expect(plan !== undefined, `step ${i}`).toBe(expected);
        if (plan === undefined) {
          expect(tagDiscOf(choreo, i)).toBe(-1);
          return;
        }
        tags++;
        const player = source?.type === 'red' ? source.player : finisher!;
        expect(plan.player).toBe(player);
        // The same PlayerId gives the disc, the name and the number.
        const disc = tagDiscOf(choreo, i);
        expect(disc, `step ${i}: no disc`).toBeGreaterThanOrEqual(0);
        expect(choreo.steps[i]!.owner[disc]).toBe(plan.player);
        expect(stillScene(choreo, i, out).alpha[disc], `step ${i}: disc not in sight`).toBe(1);
        const line = commentaryItem(step.line!, ctx);
        const name = nameOf(ctx, plan.player);
        expect(line.text, `step ${i}`).toContain(name);
        const shirt = game.players[plan.player]?.shirt;
        expect(shirt).toBe(squad.get(plan.player)!.shirt);
        expect(Number.isInteger(shirt)).toBe(true);
        if (plan.tone === 'goal') {
          goals++;
          expect(step.timing).toBe('afterGoal');
          expect(line.text).toBe(name);
        }
        if (plan.kind === 'red') {
          reds++;
          expect(line.text).toBe(name);
        }
        if (steps[i - 1]?.timing === 'afterGoal') afterGoal++;
      });
    }
    expect(tags).toBeGreaterThan(1000);
    expect(goals).toBeGreaterThan(100);
    expect(reds).toBeGreaterThan(0);
    // A play right after a goal (the play wins over the kick-off) has its tag too, on the disc
    // that fades in at its spot of the formation (the ball reaches the point of the play only
    // in the step after, as the anchor test above leaves out).
    expect(afterGoal).toBeGreaterThan(0);
  });

  it('gives the start and the outcome of a play the same tag, with the same player; only the kind changes', () => {
    for (const { result } of corpus.slice(0, 40)) {
      const steps = matchSteps(result.events, 'full');
      const byLine = new Map<string, ReturnType<typeof tagPlanOf>[]>();
      for (const step of steps) {
        const plan = tagPlanOf(step);
        if (plan === undefined || step.line === undefined) continue;
        byLine.set(step.line.id, [...(byLine.get(step.line.id) ?? []), plan]);
      }
      for (const plans of byLine.values()) {
        expect(new Set(plans.map((p) => p!.player)).size).toBe(1);
        expect(new Set(plans.map((p) => p!.side)).size).toBe(1);
      }
    }
  });

  it('has no disc and no tag for a PlayerId that is not on the pitch (and the error is on record)', () => {
    const found = corpus.find(({ result }) => result.events.some((e) => e.type === 'chance'))!;
    const { match, result } = found;
    const stranger = 'nobody-here' as PlayerId;
    const events = result.events.map((e) =>
      e.type === 'chance' ? { ...e, shooter: stranger } : e,
    );
    const steps = matchSteps(events, 'full');
    const choreo = choreograph(steps, lineupsOf(match), match.seed);
    expect(choreo.unknown).toContain(stranger);
    steps.forEach((step, i) => {
      const source = step.line?.source;
      if (source?.type !== 'chance') return;
      expect(tagPlanOf(step)?.player).toBe(stranger);
      expect(tagDiscOf(choreo, i)).toBe(-1);
    });
  });
});
