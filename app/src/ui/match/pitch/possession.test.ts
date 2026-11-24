import { describe, expect, it } from 'vitest';
import { testMatchesOf } from '../../testing/matches';
import { matchSteps } from '../steps';
import { MATCH_TIMING } from '../timing';
import { OWNER, possessionOwners } from './possession';

/*
 * The owner of the ball in each step (docs/design/campo-lances.md, D4-C): a pure function that
 * follows the possession of the match report.
 */

const corpus = testMatchesOf(2026, 10);

describe('possessionOwners', () => {
  it('is deterministic and gives one owner per step', () => {
    const { result, match } = corpus[0]!;
    const steps = matchSteps(result.events, 'full');
    const a = possessionOwners(steps, result.stats.home.possession, match.seed);
    const b = possessionOwners(steps, result.stats.home.possession, match.seed);
    expect(a.length).toBe(steps.length);
    expect([...a]).toEqual([...b]);
  });

  it('gives a play to its side, nobody to the phases and to the step after a goal', () => {
    let plays = 0;
    for (const { result, match } of corpus.slice(0, 40)) {
      const steps = matchSteps(result.events, 'full');
      const owners = possessionOwners(steps, result.stats.home.possession, match.seed);
      steps.forEach((step, i) => {
        const source = step.line?.source;
        if (source === undefined) return;
        if (['kickoff', 'halftime', 'secondHalf', 'fulltime'].includes(source.type)) {
          expect(owners[i]).toBe(OWNER.none);
        } else if (
          source.type === 'chance' ||
          source.type === 'goal' ||
          source.type === 'penaltyAwarded' ||
          source.type === 'penaltyMissed'
        ) {
          plays++;
          expect(owners[i]).toBe(source.side === 'home' ? OWNER.home : OWNER.away);
        }
      });
    }
    expect(plays).toBeGreaterThan(100);
  });

  it('gives nobody the minute right after a goal (the ball goes back to the centre)', () => {
    let after = 0;
    for (const { result, match } of corpus.slice(0, 60)) {
      const steps = matchSteps(result.events, 'full');
      const owners = possessionOwners(steps, result.stats.home.possession, match.seed);
      steps.forEach((step, i) => {
        if (steps[i - 1]?.timing !== 'afterGoal' || step.timing !== 'minuteFull') return;
        after++;
        expect(owners[i]).toBe(OWNER.none);
      });
    }
    expect(after).toBeGreaterThan(0);
  });

  it('keeps the share of the time with the ball near the possession of the report', () => {
    const gaps: number[] = [];
    for (const { result, match } of corpus) {
      const steps = matchSteps(result.events, 'full');
      const owners = possessionOwners(steps, result.stats.home.possession, match.seed);
      let home = 0;
      let total = 0;
      steps.forEach((step, i) => {
        if (step.timing !== 'minuteFull' || owners[i] === OWNER.none) return;
        const weight = MATCH_TIMING.normal.minuteFull;
        total += weight;
        if (owners[i] === OWNER.home) home += weight;
      });
      gaps.push(Math.abs((100 * home) / total - result.stats.home.possession));
    }
    gaps.sort((a, b) => a - b);
    const at = (q: number) => gaps[Math.floor(q * (gaps.length - 1))]!;
    // Only the minutes with nothing shown here (the quota has the other steps too).
    expect(at(0.5)).toBeLessThan(3);
    expect(at(0.9)).toBeLessThan(6);
  });
});
