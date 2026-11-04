import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  newGame,
  seedFromString,
  simulateMatch,
  suggestSheet,
  validateLineup,
} from '../engine/index.ts';
import type {
  ClubDef,
  GameState,
  Player,
  PlayerId,
  TeamInput,
  TeamSheet,
} from '../engine/index.ts';
import { fixedIdentitySource } from '../engine/testing/identity.ts';
import { testParams } from '../engine/testing/params.ts';

/*
 * T-011 acceptance, end to end: one chained season with the 20 real clubs. Each round the AI
 * sheet of every club goes through validateLineup and simulateMatch; between rounds condition,
 * injuries, suspensions and yellow counts are applied by hand in the simplest way partida.md
 * allows (the official application is T-013's playRound, which does not exist yet). Simplifications:
 * a player out counts one round/game down when his club plays; recovery is 7 per day between the
 * round dates; no morale, form, benchStreak or appearances.
 */
const clubs = JSON.parse(
  readFileSync(new URL('./clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];
const params = testParams();
const ROTATION = params.ai.rotationCondition;
const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;

function run(seed: number) {
  const created = newGame(
    { seed, year: 2026, realism: 'full' },
    clubs,
    params,
    fixedIdentitySource(),
  );
  if (!created.ok) throw new Error('newGame failed');
  let state: GameState = created.value;
  const problems: string[] = [];
  let rotations = 0;
  let sheets = 0;
  let tiredStarters = 0;
  let outRounds = 0;
  let outSuspended = 0;
  /** Substitutions of the in-match AI (T-012), by reason. */
  const subs: Record<string, number> = { injury: 0, fatigue: 0, tactical: 0 };
  const lastXi = new Map<string, Set<PlayerId>>();

  for (let round = 1; round <= 38; round++) {
    state = { ...state, round };
    const fixtures = state.fixtures.filter((f) => f.round === round);
    const players: Record<PlayerId, Player> = { ...state.players };
    const played = new Set<PlayerId>();
    const finalEnergy: Record<PlayerId, number> = {};
    const newInj: { player: PlayerId; rounds: number }[] = [];
    const newSus: { player: PlayerId; games: number }[] = [];
    const yc: Record<PlayerId, number> = {};

    for (const f of fixtures) {
      const inputs: Record<string, TeamInput> = {};
      for (const [id, opp] of [
        [f.homeId, f.awayId],
        [f.awayId, f.homeId],
      ] as const) {
        const sheet: TeamSheet = suggestSheet(state, params, id, opp);
        const where = `seed ${seed} r${round} ${id}`;
        if (!validateLineup(state, id, sheet).ok) problems.push(`${where}: invalid sheet`);
        const xi = sheet.lineup.starters.map((p) => state.players[p]!);
        sheets++;
        if (xi.length !== 11) problems.push(`${where}: ${xi.length} starters`);
        for (const p of [...xi, ...sheet.lineup.bench.map((b) => state.players[b]!)]) {
          if (p.injuryRounds > 0) problems.push(`${where}: injured ${p.id}`);
          if (p.suspendedGames > 0) problems.push(`${where}: suspended ${p.id}`);
          if (p.clubId !== id) problems.push(`${where}: foreign ${p.id}`);
        }
        const prev = lastXi.get(id);
        for (const p of xi) {
          if (p.condition < ROTATION) tiredStarters++;
        }
        if (prev !== undefined) {
          for (const pid of prev) {
            const p = state.players[pid]!;
            if (
              p.condition < ROTATION &&
              p.injuryRounds === 0 &&
              p.suspendedGames === 0 &&
              !sheet.lineup.starters.includes(pid)
            )
              rotations++;
          }
        }
        lastXi.set(id, new Set(sheet.lineup.starters));
        inputs[id] = {
          clubId: id,
          controller: 'ai',
          profile: state.clubs[id]!.profile,
          fans: state.clubs[id]!.fans,
          players: state.squads[id]!.map((p) => state.players[p]!),
          sheet,
        };
      }
      const result = simulateMatch(
        {
          fixtureId: f.id,
          seed: seedFromString(`${state.seed}-s1-r${round}-${f.homeId}-${f.awayId}`),
          home: inputs[f.homeId]!,
          away: inputs[f.awayId]!,
          derby: state.clubs[f.homeId]!.def.rivals.includes(f.awayId),
          neutral: false,
          rules: state.rules,
        },
        params,
      );
      for (const id of Object.keys(result.finalEnergy)) {
        played.add(id);
        finalEnergy[id] = result.finalEnergy[id]!;
      }
      for (const e of result.events) if (e.type === 'substitution') subs[e.reason]! += 1;
      newInj.push(...result.newInjuries);
      newSus.push(...result.newSuspensions);
      Object.assign(yc, result.yellowCounts);
    }

    // Between rounds, by hand.
    const gap =
      round < 38
        ? day(state.fixtures.find((f) => f.round === round + 1)!.date) - day(fixtures[0]!.date)
        : 0;
    for (const id of Object.keys(players)) {
      const p = players[id]!;
      if (p.injuryRounds > 0 || p.suspendedGames > 0) outRounds++;
      if (p.suspendedGames > 0) outSuspended++;
      const base = played.has(id) ? finalEnergy[id]! : p.condition;
      players[id] = {
        ...p,
        condition: Math.min(100, base + params.match.fatigue.recoveryPerDay * gap),
        injuryRounds: Math.max(0, p.injuryRounds - 1),
        suspendedGames: Math.max(0, p.suspendedGames - 1),
        yellowCount: yc[id] ?? p.yellowCount,
      };
    }
    for (const i of newInj) players[i.player] = { ...players[i.player]!, injuryRounds: i.rounds };
    for (const s of newSus) {
      players[s.player] = {
        ...players[s.player]!,
        suspendedGames: players[s.player]!.suspendedGames + s.games,
      };
    }
    state = { ...state, players };
  }
  return { problems, rotations, sheets, tiredStarters, outRounds, outSuspended, subs };
}

describe('T-011 acceptance: chained season with the 20 real clubs', () => {
  it(
    'never fields an injured or suspended player, every sheet validates, and rotation happens',
    { timeout: 120_000 },
    () => {
      let rot = 0;
      let out = 0;
      let sus = 0;
      let sheets = 0;
      let tired = 0;
      const subs: Record<string, number> = { injury: 0, fatigue: 0, tactical: 0 };
      for (const seed of [1, 2, 3]) {
        const r = run(seed);
        expect(r.problems).toEqual([]);
        rot += r.rotations;
        out += r.outRounds;
        sus += r.outSuspended;
        sheets += r.sheets;
        tired += r.tiredStarters;
        for (const [reason, n] of Object.entries(r.subs)) subs[reason]! += n;
      }
      const matches = 3 * 380;
      const perMatch = (n: number) => (n / matches).toFixed(2);
      const all = subs.injury! + subs.fatigue! + subs.tactical!;
      console.info(
        `[T-011 e2e] sheets ${sheets}; player-rounds out ${out} (suspended ${sus}); rotations of tired starters ${rot}; starters below ${ROTATION}: ${tired}\n` +
          `[T-012 e2e] substitutions per match ${perMatch(all)} (ia-clubes.md: 3 to 4): injury ${perMatch(subs.injury!)}, fatigue ${perMatch(subs.fatigue!)}, tactical ${perMatch(subs.tactical!)}`,
      );
      expect(sheets).toBe(3 * 380 * 2);
      expect(out).toBeGreaterThan(0);
      expect(rot).toBeGreaterThan(0);
    },
  );
});
