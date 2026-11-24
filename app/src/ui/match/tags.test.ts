import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '@engine';
import { testMatches } from '../testing/matches';
import { matchSteps } from './steps';
import { TAG_KIND_KEYS, tagPlanOf } from './tags';

/*
 * The table of tags (docs/design/telas/partida-campo-v2.md, 9): which step has which tag, with
 * which kind and which player; and that the start of a goal and the start of a chance of the same
 * kind, side and player are the same tag (the tag never hints the outcome).
 */

const matches = testMatches();

describe('tagPlanOf', () => {
  it('follows the table: the kind of each step and its player', () => {
    const seen = new Set<string>();
    for (const { result } of matches) {
      for (const step of matchSteps(result.events, 'full')) {
        const plan = tagPlanOf(step);
        const source = step.line?.source;
        if (plan === undefined || source === undefined) continue;
        seen.add(`${source.type}/${step.line!.stage}/${plan.kind}/${plan.tone}`);
        if (source.type === 'chance') {
          const kind =
            step.line!.stage === 'build'
              ? source.kind === 'freeKick'
                ? 'freeKick'
                : 'shot'
              : source.outcome;
          expect(plan.kind).toBe(kind);
          expect(plan.player).toBe(source.shooter);
        }
        if (source.type === 'goal') {
          expect(plan.tone).toBe(step.line!.stage === 'build' ? 'play' : 'goal');
          expect(plan.player).toBe(source.scorer);
        }
        if (source.type === 'penaltyAwarded') expect(plan.kind).toBe('penalty');
        if (source.type === 'red') expect(plan.kind).toBe('red');
        expect(TAG_KIND_KEYS[plan.kind]).toBeTruthy();
      }
    }
    for (const row of [
      'chance/build/shot/play',
      'chance/final/saved/play',
      'goal/build/shot/play',
      'goal/final/goal/goal',
      'penaltyAwarded/build/penalty/play',
    ]) {
      expect(seen.has(row), row).toBe(true);
    }
  });

  it('gives no tag to a card, a substitution, a tactic change, the phases or a minute with nothing shown', () => {
    for (const { result } of matches) {
      for (const step of matchSteps(result.events, 'full')) {
        const type = step.line?.source.type;
        if (
          type === undefined ||
          [
            'yellow',
            'injury',
            'substitution',
            'tacticChange',
            'stoppage',
            'kickoff',
            'halftime',
            'secondHalf',
            'fulltime',
          ].includes(type)
        ) {
          expect(tagPlanOf(step), `${type}`).toBeUndefined();
        }
      }
    }
  });

  it('gives the start of a goal and the start of a chance of the same kind, side and player the same tag', () => {
    const swapped = (events: readonly MatchEvent[], goal: Extract<MatchEvent, { type: 'goal' }>) =>
      events.map((e): MatchEvent =>
        e === goal
          ? ({
              type: 'chance',
              minute: goal.minute,
              ...(goal.added === undefined ? {} : { added: goal.added }),
              half: goal.half,
              side: goal.side,
              shooter: goal.scorer,
              kind: goal.kind === 'freeKick' ? 'freeKick' : 'open',
              outcome: 'saved',
              importance: 2,
            } as MatchEvent)
          : e,
      );
    let compared = 0;
    for (const { result } of matches) {
      const goal = result.events.find(
        (e): e is Extract<MatchEvent, { type: 'goal' }> =>
          e.type === 'goal' && e.kind !== 'penalty',
      );
      if (goal === undefined) continue;
      const a = matchSteps(result.events, 'full').find(
        (s) => s.line?.source === goal && s.line.stage === 'build',
      );
      const swappedEvents = swapped(result.events, goal);
      const chance = swappedEvents.find(
        (e) => e.type === 'chance' && e.shooter === goal.scorer && e.minute === goal.minute,
      );
      const b = matchSteps(swappedEvents, 'full').find(
        (s) => s.line?.source === chance && s.line?.stage === 'build',
      );
      if (a === undefined || b === undefined) continue;
      const planA = tagPlanOf(a)!;
      const planB = tagPlanOf(b)!;
      expect({ ...planA, key: '' }).toEqual({ ...planB, key: '' });
      compared++;
    }
    expect(compared).toBeGreaterThan(5);
  });
});
