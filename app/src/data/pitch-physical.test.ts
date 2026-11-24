import { describe, expect, it } from 'vitest';
import { attributeOf, type MatchEvent } from '@engine';
import { fillEmptyGoal } from '../engine/strength';
import { testMatches } from '../ui/testing/matches';
import { matchSteps } from '../ui/match/steps';
import { choreograph, createScene, sceneAt, physicalOf } from '../ui/match/pitch/scene';

/* The pitch reads `physical` as the engine does (`fillEmptyGoal`, D5-A of campo-lances.md). */
describe('physicalOf equals the engine attributeOf', () => {
  it('for every player of the test matches, and for a player without the attribute', () => {
    for (const { match } of testMatches()) {
      for (const player of [...match.home.players, ...match.away.players]) {
        expect(physicalOf(player)).toBe(attributeOf(player, 'physical'));
      }
    }
    const base = testMatches()[0]!.match.home.players[0]!;
    for (const overall of [1, 40, 63, 77, 99]) {
      const bare = { ...base, overall, attributes: {} };
      expect(physicalOf(bare)).toBe(attributeOf(bare, 'physical'));
    }
  });
});

describe('the pitch picks the new keeper as the engine does (fillEmptyGoal)', () => {
  const { match, result } = testMatches()[3]!;
  const starters = match.home.sheet.lineup.starters;
  const red: MatchEvent = {
    minute: 40,
    half: 1,
    importance: 3,
    type: 'red',
    side: 'home',
    player: starters[0]!,
    reason: 'direct',
  };
  const events = [...result.events];
  events.splice(
    events.findLastIndex((e) => e.half === 1 && e.added === undefined && e.minute <= 40) + 1,
    0,
    red,
  );
  const steps = matchSteps(events, 'full');
  const index = steps.findIndex((s) => s.line?.id === `e${events.indexOf(red)}`);

  for (const values of [
    [50, 50, 50, 50, 50, 90, 50, 50, 50, 50],
    [50, 50, 90, 50, 50, 50, 50, 90, 50, 50],
    [60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
  ]) {
    it(`physical ${values.join(',')}`, () => {
      const byId = new Map(starters.slice(1).map((id, i) => [id, values[i]!] as const));
      const players = match.home.players.map((p) =>
        byId.has(p.id) ? { ...p, attributes: { ...p.attributes, physical: byId.get(p.id)! } } : p,
      );
      const slots = starters.map((id) => players.find((p) => p.id === id));
      const expected = fillEmptyGoal([undefined, ...slots.slice(1)]).vacated!;
      const lineups = {
        home: { ...match.home.sheet.lineup, players },
        away: { ...match.away.sheet.lineup, players: match.away.players },
      };
      const choreo = choreograph(steps, lineups, match.seed);
      const out = sceneAt(choreo, index, 1, createScene());
      expect([...out.on.slice(0, 11)].flatMap((v, d) => (v === 0 ? [d] : []))).toEqual([expected]);
    });
  }
});
