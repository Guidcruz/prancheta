import { describe, expect, it } from 'vitest';
import { suggestSheet, validateLineup, type SuggestState } from './ai.ts';
import { BENCH_SIZE } from './lineup.ts';
import { AI_PROFILES } from './clubs.ts';
import { FORMATIONS, FORMATION_SLOTS } from './formations.ts';
import type { ClubState } from './game.ts';
import { generateSquad } from './generation.ts';
import type { Player } from './players.ts';
import { Rng, seedFromString } from './rng.ts';
import { isAvailable } from './strength.ts';
import { fixedIdentitySource } from './testing/identity.ts';
import { testGame } from './testing/match.ts';
import { testParams } from './testing/params.ts';
import type { ClubId, Formation, PlayerId } from './types.ts';

/*
 * Properties of the pre-match AI (US-011; ia-clubes.md, "Pedido ao developer" 2):
 * - every sheet it suggests for a generated squad passes validateLineup, with a goalkeeper in goal
 *   and one goalkeeper in the XI;
 * - over 200 seasons × 38 rounds of random availability (injuries, suspensions, condition, morale,
 *   profile, formations, venue), no sheet ever has an injured or suspended player, and the sheet
 *   is always well formed. The rounds between seasons are not played (that is T-013): each round
 *   draws a new situation for one club, which covers more cases than a real season would.
 */
const params = testParams();
const SEEDS = 300;
const SEASONS = 200;
const ROUNDS = 38;

function pickFormations(rng: Rng): readonly [Formation, Formation] {
  const a = FORMATIONS[rng.int(0, FORMATIONS.length - 1)]!;
  const b = FORMATIONS[rng.int(0, FORMATIONS.length - 1)]!;
  return [a, b];
}

/**
 * The problems of the suggested sheet, as text (empty when it is well formed). Collected instead
 * of asserted one by one, so 7,600 cases stay fast; the failing case is in the message.
 */
function problemsOf(state: SuggestState, clubId: ClubId, opponentId?: ClubId): string[] {
  const sheet = suggestSheet(state, params, clubId, opponentId);
  const { lineup, tactic } = sheet;
  const problems: string[] = [];
  const squad = new Set(state.squads[clubId]);
  const available = [...squad].filter((id) => isAvailable(state.players[id]!)).length;
  const ids: PlayerId[] = [...lineup.starters, ...lineup.bench];
  if (new Set(ids).size !== ids.length) problems.push('repeated player');
  for (const id of ids) {
    if (!squad.has(id)) problems.push(`${id} not in the squad`);
    else if (!isAvailable(state.players[id]!)) problems.push(`${id} injured or suspended`);
  }
  if (!FORMATIONS.includes(lineup.formation)) problems.push(`formation ${lineup.formation}`);
  if (lineup.starters.length !== Math.min(11, available)) problems.push('starters count');
  if (lineup.bench.length !== Math.min(BENCH_SIZE, available - lineup.starters.length)) {
    problems.push('bench count');
  }
  for (const list of [lineup.captains, lineup.penaltyTakers, lineup.freeKickTakers]) {
    if (list.length !== (lineup.starters.length > 0 ? 1 : 0)) problems.push('taker list size');
    for (const id of list) if (!lineup.starters.includes(id)) problems.push(`${id} not a starter`);
  }
  if (!['defensive', 'balanced', 'attacking'].includes(tactic.posture)) problems.push('posture');
  if (!['low', 'medium', 'high'].includes(tactic.pressure)) problems.push('pressure');
  const checked = validateLineup(state, clubId, sheet);
  // Valid whenever someone is available (11, or all of them with fewer); never with nobody.
  if (available > 0 ? !checked.ok : checked.ok || checked.error !== 'wrong-count') {
    problems.push(`validateLineup ${JSON.stringify(checked.ok ? 'ok' : checked.detail)}`);
  }
  return problems.map((p) => `${clubId} r${state.round} s${state.season}: ${p}`);
}

describe('suggestSheet properties', () => {
  it(
    `passes validateLineup with one goalkeeper in goal for ${SEEDS} generated squads`,
    { timeout: 60_000 },
    () => {
      const base = testGame();
      const opponentId = Object.keys(base.clubs)[1]!;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const rng = new Rng(seedFromString(`ai-generated-${seed}`));
        const clubId = 'gerado';
        const formations = pickFormations(rng);
        const strength = 55 + rng.next() * 30;
        const players = generateSquad(
          { clubId, seed, strength, formation: formations[0] },
          params,
          fixedIdentitySource(),
        ).players;
        const profile = AI_PROFILES[rng.int(0, AI_PROFILES.length - 1)]!;
        const club: ClubState = {
          ...base.clubs[Object.keys(base.clubs)[0]!]!,
          profile,
          preferredFormations: formations,
        };
        const state: SuggestState = {
          ...base,
          clubs: { ...base.clubs, [clubId]: club },
          players: { ...base.players, ...Object.fromEntries(players.map((p) => [p.id, p])) },
          squads: { ...base.squads, [clubId]: players.map((p) => p.id) },
        };
        expect(problemsOf(state, clubId, opponentId)).toEqual([]);
        const sheet = suggestSheet(state, params, clubId, opponentId);
        const xi = sheet.lineup.starters.map((id) => state.players[id]!);
        expect(FORMATION_SLOTS[sheet.lineup.formation][0]).toBe('GK');
        expect(xi[0]!.position).toBe('GK');
        expect(xi.filter((p) => p.position === 'GK')).toHaveLength(1);
        if (profile !== 'chaotic') expect(formations).toContain(sheet.lineup.formation);
      }
    },
  );

  it(
    `never lines up an injured or suspended player in ${SEASONS} seasons × ${ROUNDS} rounds`,
    { timeout: 60_000 },
    () => {
      const base = testGame();
      const clubIds = Object.keys(base.clubs);
      const problems: string[] = [];
      for (let season = 1; season <= SEASONS; season++) {
        const rng = new Rng(seedFromString(`ai-seasons-${season}`));
        for (let round = 1; round <= ROUNDS; round++) {
          const clubId = clubIds[rng.int(0, clubIds.length - 1)]!;
          let opponentId = clubIds[rng.int(0, clubIds.length - 2)]!;
          if (opponentId === clubId) opponentId = clubIds[clubIds.length - 1]!;
          // Up to a third of the squad out: from a full XI to fewer than 11 available.
          const injuryRate = rng.next() * 0.35;
          // Only the two squads: suggestSheet reads no other player.
          const players: Record<PlayerId, Player> = {};
          for (const id of [...base.squads[clubId]!, ...base.squads[opponentId]!]) {
            const u = rng.next();
            players[id] = {
              ...base.players[id]!,
              injuryRounds: u < injuryRate * 0.6 ? rng.int(1, 6) : 0,
              suspendedGames: u >= injuryRate * 0.6 && u < injuryRate ? rng.int(1, 2) : 0,
              condition: 40 + rng.next() * 60,
              morale: rng.next() * 100,
            };
          }
          const club = base.clubs[clubId]!;
          const clubs = {
            ...base.clubs,
            [clubId]: {
              ...club,
              profile: AI_PROFILES[rng.int(0, AI_PROFILES.length - 1)]!,
              preferredFormations: pickFormations(rng),
            },
          };
          const state: SuggestState = { ...base, season, round, clubs, players };
          problems.push(...problemsOf(state, clubId, rng.int(0, 3) === 0 ? undefined : opponentId));
        }
      }
      expect(problems).toEqual([]);
    },
  );
});
