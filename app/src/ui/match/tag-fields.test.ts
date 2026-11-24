import { describe, expect, it } from 'vitest';
import { t } from '@lib/i18n';
import { testMatchesOf } from '../testing/matches';
import { nameOf } from './narration';
import { matchSteps } from './steps';
import { TAG_KIND_KEYS, tagFields, tagPlanOf } from './tags';

/*
 * What the tag shows (partida-campo-v2.md, 10 and 13, anchor 3): the kind, the name and the number
 * of the shirt of the PlayerId of the plan, as the commentary and the squad say them.
 */

describe('tagFields', () => {
  it('shows the translated kind, the name of the player and his Player.shirt', () => {
    let checked = 0;
    for (const { game, match, result } of testMatchesOf(2026, 3)) {
      const squad = new Map([...match.home.players, ...match.away.players].map((p) => [p.id, p]));
      for (const lang of ['pt-BR', 'es', 'en'] as const) {
        const ctx = { game, homeId: match.home.clubId, awayId: match.away.clubId, lang };
        for (const step of matchSteps(result.events, 'full')) {
          const plan = tagPlanOf(step);
          if (plan === undefined) continue;
          const fields = tagFields(plan, ctx);
          expect(fields.kind).toBe(t(TAG_KIND_KEYS[plan.kind], lang));
          expect(fields.name).toBe(nameOf(ctx, plan.player));
          expect(fields.shirt).toBe(squad.get(plan.player)!.shirt);
          expect(fields.kind.length).toBeGreaterThan(0);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it("gives no shirt number to a player the game does not know, never another player's", () => {
    const { game, match, result } = testMatchesOf(2026, 1)[0]!;
    const ctx = {
      game,
      homeId: match.home.clubId,
      awayId: match.away.clubId,
      lang: 'pt-BR' as const,
    };
    const step = matchSteps(result.events, 'full').find((s) => tagPlanOf(s) !== undefined)!;
    const stranger = { ...tagPlanOf(step)!, player: 'nobody-here' as never };
    expect(tagFields(stranger, ctx).shirt).toBeUndefined();
  });
});
