import { describe, expect, it } from 'vitest';
import type { PlayerId } from '@engine';
import { MATCH_TIMING } from './timing';
import { TAG_MIN_MS, TagTracker, type TagStepInput, type TrackedView } from './tag-tracker';
import type { TagPlan } from './tags';

/*
 * Which tags are on the pitch after each step (partida-campo-v2.md, 9 and 16, items 11 to 13):
 * the age by the sum of the durations of the steps, the swap by another player, the same key from
 * the start to the outcome, the exit and the shirt of the team.
 */

interface View extends TrackedView {
  readonly text: string;
}
const view = (key: string, text = key, leaving = false): View => ({ key, text, leaving });
const plan = (key: string, tone: 'play' | 'goal' = 'play', kind: TagPlan['kind'] = 'shot') =>
  ({ key, tone, kind, player: key as PlayerId, side: 'home' }) satisfies TagPlan;

const play = (key: string, duration: number, text = key): Partial<TagStepInput<View>> => ({
  plan: plan(key),
  view: view(key, text),
  duration,
});
const empty = (duration: number): Partial<TagStepInput<View>> => ({ duration });
const input = (part: Partial<TagStepInput<View>>): TagStepInput<View> => ({
  plan: undefined,
  view: undefined,
  duration: 800,
  speed: 'normal',
  fade: true,
  team: undefined,
  ...part,
});
const keys = (tracker: TagTracker<View>) =>
  tracker.tags.map((v) => `${v.key}${v.leaving ? '*' : ''}`);
const TEAM = view('team');

describe('TagTracker', () => {
  it('counts the age of a tag by the sum of the durations of the steps since its entry', () => {
    const tracker = new TagTracker<View>();
    tracker.step(input(play('e1:play', MATCH_TIMING.normal.drama)));
    expect(tracker.age).toBe(0);
    tracker.step(input(play('e1:play', MATCH_TIMING.normal.afterMiss)));
    expect(tracker.age).toBe(1200);
    tracker.step(input(empty(800)));
    // 1200 + 600 = 1800 ≥ 1600: it leaves at this step, fading.
    expect(keys(tracker)).toEqual(['e1:play*']);
    expect(tracker.age).toBeUndefined();
  });

  it('keeps every tag until the least time, in Normal and in Rápido, even with its disc gone', () => {
    // A weak chance: one step of 400 ms; the disc leaves at the next one, the tag does not.
    const tracker = new TagTracker<View>();
    tracker.step(input(play('e2:play', 400)));
    for (const duration of [800, 800]) {
      expect(tracker.step(input(empty(duration)))).toBe(false);
      expect(keys(tracker)).toEqual(['e2:play']);
    }
    // 400 + 800 + 800 = 2000: gone at the next step without a tag.
    tracker.step(input(empty(800)));
    expect(keys(tracker)).toEqual(['e2:play*']);

    const fast = new TagTracker<View>();
    const f = (part: Partial<TagStepInput<View>>) => input({ speed: 'fast', ...part });
    fast.step(f(play('e3:play', 500)));
    fast.step(f(play('e3:play', 250)));
    // 750 < 800: still there at the first step without a tag.
    fast.step(f(empty(300)));
    expect(keys(fast)).toEqual(['e3:play']);
    // 1050 ≥ 800: leaves now.
    fast.step(f(empty(300)));
    expect(keys(fast)).toEqual(['e3:play*']);
    expect(TAG_MIN_MS).toEqual({ normal: 1600, fast: 800 });
  });

  it('is replaced at once by another player: no fade, a new age', () => {
    const tracker = new TagTracker<View>();
    tracker.step(input(play('a:play', 1200)));
    tracker.step(input(play('b:play', 600)));
    expect(keys(tracker)).toEqual(['b:play']);
    expect(tracker.age).toBe(0);
  });

  it('keeps the same key from the start to the outcome, changing only the view', () => {
    const tracker = new TagTracker<View>();
    tracker.step(input(play('e4:play', 1200, 'Finalização')));
    tracker.step(input(play('e4:play', 600, 'Defendida')));
    expect(tracker.tags).toEqual([view('e4:play', 'Defendida')]);
    expect(tracker.age).toBe(1200);
  });

  it('takes the goal tag away at once at the next step, with no fade', () => {
    const tracker = new TagTracker<View>();
    tracker.step(input(play('e5:play', 1200)));
    tracker.step(input({ plan: plan('e5:goal', 'goal'), view: view('e5:goal'), duration: 2000 }));
    expect(keys(tracker)).toEqual(['e5:goal']);
    tracker.step(input(empty(800)));
    expect(keys(tracker)).toEqual([]);
  });

  it('takes the tag before away when the player of the play is not on the pitch', () => {
    const tracker = new TagTracker<View>();
    tracker.step(input(play('e6:play', 1200)));
    tracker.step(input({ plan: plan('e7:play'), view: undefined, duration: 400 }));
    expect(keys(tracker)).toEqual([]);
  });

  it('goes away at once, with no fade, when motion is reduced', () => {
    const tracker = new TagTracker<View>();
    tracker.step(input({ ...play('e8:play', 2000), fade: false }));
    tracker.step(input({ ...empty(800), fade: false }));
    expect(keys(tracker)).toEqual([]);
    expect(tracker.leavingKey).toBeUndefined();
  });

  it('shows the shirt of the team only with no tag of a play, and keeps it when the tag has faded', () => {
    const tracker = new TagTracker<View>();
    // A minute with nothing shown: the shirt.
    tracker.step(input({ ...empty(800), team: TEAM }));
    expect(keys(tracker)).toEqual(['team']);
    // A play: no shirt.
    tracker.step(input(play('e9:play', 1000)));
    expect(keys(tracker)).toEqual(['e9:play']);
    // A minute while the tag still holds (age under the least): the candidate is not shown.
    tracker.step(input({ ...empty(800), team: TEAM }));
    expect(keys(tracker)).toEqual(['e9:play']);
    // The tag leaves at this step (age 1800): the shirt comes, the fading tag goes on.
    tracker.step(input({ ...empty(800), team: TEAM }));
    expect(keys(tracker)).toEqual(['team', 'e9:play*']);
    // Regression: when the fade ends the shirt must still be there.
    expect(tracker.left('e9:play')).toBe(true);
    expect(keys(tracker)).toEqual(['team']);
    expect(tracker.left('e9:play')).toBe(false);
  });

  it('reports whether the tags changed', () => {
    const tracker = new TagTracker<View>();
    expect(tracker.step(input(empty(800)))).toBe(false);
    expect(tracker.step(input(play('e10:play', 400)))).toBe(true);
    expect(tracker.step(input(play('e10:play', 400, 'other text')))).toBe(false);
    expect(tracker.step(input(empty(800)))).toBe(false);
  });
});
