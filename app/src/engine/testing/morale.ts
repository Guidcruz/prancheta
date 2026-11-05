/**
 * An independent reading of docs/design/jogadores.md, "Moral por rodada", for the engine tests
 * (T-014): the morale every player should have after a round, recomputed from the state before
 * it and the round's results, without the engine's own functions. A test compares it with what
 * `playRound` wrote, so a change in either side shows up.
 *
 * Test-only code: never imported by `index.ts`.
 */
import type { GameState } from '../game.ts';
import type { MatchResult } from '../match/types.ts';
import type { PlayerId, Side } from '../types.ts';

/** Who heard the half-time talk of `side`: on the pitch at the `halftime` event. */
function heardTalk(result: MatchResult, squad: ReadonlySet<PlayerId>, side: Side): Set<PlayerId> {
  const cameOn = new Set(
    result.events.flatMap((e) => (e.type === 'substitution' && e.side === side ? [e.in] : [])),
  );
  const pitch = new Set(
    Object.keys(result.minutes).filter((id) => squad.has(id) && !cameOn.has(id)),
  );
  for (const e of result.events) {
    if (e.type === 'halftime') return pitch;
    if (e.type === 'substitution' && e.side === side) {
      pitch.delete(e.out);
      pitch.add(e.in);
    }
    if ((e.type === 'red' || e.type === 'injury') && e.side === side) pitch.delete(e.player);
  }
  return new Set();
}

/** The parts of a player's morale change in a round, before the professional's half. */
export interface MoraleParts {
  result: number;
  bench: number;
  drift: number;
  demand: number;
  benchStreak: number;
}

/**
 * The parts of every player's morale change in the round that took `before` to a state with
 * `results` (the round's matches, any order). Every player of a club that played has an entry.
 */
export function expectedMoraleParts(
  before: GameState,
  results: readonly MatchResult[],
): Map<PlayerId, MoraleParts> {
  const out = new Map<PlayerId, MoraleParts>();
  for (const result of results) {
    const fixture = before.fixtures.find((f) => f.id === result.fixtureId)!;
    const derby = before.clubs[fixture.homeId]!.def.rivals.includes(fixture.awayId);
    for (const [side, clubId, own, other] of [
      ['home', fixture.homeId, result.score[0], result.score[1]],
      ['away', fixture.awayId, result.score[1], result.score[0]],
    ] as const) {
      const squad = new Set(before.squads[clubId]);
      const played = Object.keys(result.minutes).filter((id) => squad.has(id));
      const subs = new Set(
        result.events.flatMap((e) => (e.type === 'substitution' && e.side === side ? [e.in] : [])),
      );
      const xi = played.filter((id) => !subs.has(id)).map((id) => before.players[id]!.overall);
      const xiMean = xi.reduce((s, x) => s + x, 0) / xi.length;
      const byResult = (own > other ? 3 : own === other ? 0 : -3) * (derby ? 2 : 1);
      const demanded = result.events.some(
        (e) => e.type === 'halftimeTalk' && e.side === side && e.talk === 'demand',
      );
      const heard = demanded ? heardTalk(result, squad, side) : new Set<PlayerId>();
      const fans = before.clubs[clubId]!.fans;
      for (const id of squad) {
        const p = before.players[id]!;
        const tookPitch = played.includes(id);
        const out_ = p.injuryRounds > 0 || p.suspendedGames > 0;
        const expected = p.overall >= xiMean - 3;
        const benchStreak = !tookPitch && !out_ && expected ? p.benchStreak + 1 : 0;
        out.set(id, {
          result: tookPitch ? byResult : 0,
          bench: benchStreak >= 2 ? (p.trait === 'hothead' ? -4 : -2) : 0,
          drift: fans > p.morale ? 1 : fans < p.morale ? -1 : 0,
          demand: heard.has(id) && p.trait === 'hothead' ? -3 : 0,
          benchStreak,
        });
      }
    }
  }
  return out;
}

/** The morale a player should have after the round: the parts summed, then clamped once. */
export function expectedMorale(before: GameState, id: PlayerId, parts: MoraleParts): number {
  const p = before.players[id]!;
  const half = (x: number) => (x < 0 && p.trait === 'professional' ? x / 2 : x);
  const sum = half(parts.result) + half(parts.bench) + half(parts.drift) + half(parts.demand);
  return Math.max(0, Math.min(100, p.morale + sum));
}
