import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  bestEleven,
  generateSquad,
  newGame,
  seedFromString,
  simulateMatch,
  teamStrength,
} from '../engine/index.ts';
import type {
  AiProfile,
  ClubDef,
  Formation,
  GameState,
  MatchResult,
  Player,
  TeamInput,
} from '../engine/index.ts';
import { fixedIdentitySource } from '../engine/testing/identity.ts';
import { testParams } from '../engine/testing/params.ts';

/*
 * Quick report of the match engine (T-009) with the 20 real clubs, against the 1a targets of
 * docs/design/balance-targets.md. It only REPORTS: tuning is the /balance's job (T-016), so the
 * assertions below are sanity bounds far outside the targets, never the targets themselves.
 *
 * The full report runs only with `MATCH_METRICS=1` (like NAMES_FULL_CHECK):
 * `MATCH_METRICS=1 npm test -w app -- --silent=false src/data/match-metrics.test.ts`. Without it,
 * a short version (2 careers, 500 duels of each) checks the same sanity bounds in a second.
 *
 * - League: 30 careers (seeds 1..30) × the 380 matches of season 1 = 11,400 matches, both sides
 *   with the best XI of their first preferred formation, balanced posture and medium pressure
 *   (the AI's pre-match tactic is T-011), thermometer at its start value.
 * - Calibrated duels (balance-targets.md, "Duelos calibrados"): squads generated with exact
 *   strength (clubStrengthSd = 0), both in 4-4-2, balanced, medium, neutral ground, thermometer
 *   55; 20,000 matches at 20 points of difference (80 × 60) and as many at 30 (85 × 55), as the
 *   /balance does.
 */
const clubs = JSON.parse(
  readFileSync(new URL('./clubs.serie-a.json', import.meta.url), 'utf8'),
) as ClubDef[];
const params = testParams();
const FULL = process.env.MATCH_METRICS === '1';
const CAREERS = FULL ? 30 : 2;
const DUEL_MATCHES = FULL ? 20_000 : 500;
const TACTIC = { posture: 'balanced', pressure: 'medium' } as const;

function teamInput(
  clubId: string,
  squad: readonly Player[],
  formation: Formation,
  profile: AiProfile,
  fans: number,
): TeamInput {
  const starters = bestEleven(squad, formation).map(({ player }) => player.id);
  return {
    clubId,
    controller: 'ai',
    profile,
    fans,
    players: squad,
    sheet: {
      lineup: {
        formation,
        starters,
        bench: [],
        captains: [],
        penaltyTakers: [],
        freeKickTakers: [],
      },
      tactic: TACTIC,
    },
  };
}

function clubInput(state: GameState, clubId: string): TeamInput {
  const club = state.clubs[clubId]!;
  const squad = state.squads[clubId]!.map((id) => state.players[id]!);
  return teamInput(clubId, squad, club.preferredFormations[0], club.profile, club.fans);
}

interface Tally {
  matches: number;
  goals: number;
  nilNil: number;
  draws: number;
  homeWins: number;
  thrashings: number;
  bigMargins: number;
  scores: Map<string, number>;
}

function tally(): Tally {
  return {
    matches: 0,
    goals: 0,
    nilNil: 0,
    draws: 0,
    homeWins: 0,
    thrashings: 0,
    bigMargins: 0,
    scores: new Map(),
  };
}

function add(t: Tally, result: MatchResult): void {
  const [h, a] = result.score;
  t.matches += 1;
  t.goals += h + a;
  if (h === 0 && a === 0) t.nilNil += 1;
  if (h === a) t.draws += 1;
  if (h > a) t.homeWins += 1;
  if (Math.abs(h - a) >= 3) t.thrashings += 1;
  if (Math.abs(h - a) >= 5) t.bigMargins += 1;
  const key = `${h}x${a}`;
  t.scores.set(key, (t.scores.get(key) ?? 0) + 1);
}

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`;

describe('T-009 match metrics with the 20 real clubs (report only, not the /balance)', () => {
  it(
    `simulates ${FULL ? 'at least 10,000' : 'a sample of'} league matches and the calibrated duels`,
    { timeout: 300_000 },
    () => {
      const league = tally();
      let gap10 = { matches: 0, strongerWins: 0, draws: 0 };
      for (let career = 1; career <= CAREERS; career++) {
        const created = newGame(
          { seed: career, year: 2026, realism: 'full' },
          clubs,
          params,
          fixedIdentitySource(),
        );
        if (!created.ok) throw new Error('newGame failed');
        const state = created.value;
        const inputs = new Map(Object.keys(state.clubs).map((id) => [id, clubInput(state, id)]));
        const shown = new Map(Object.keys(state.clubs).map((id) => [id, teamStrength(state, id)!]));
        for (const fixture of state.fixtures) {
          const result = simulateMatch(
            {
              fixtureId: fixture.id,
              seed: seedFromString(
                `${state.seed}-s1-r${fixture.round}-${fixture.homeId}-${fixture.awayId}`,
              ),
              home: inputs.get(fixture.homeId)!,
              away: inputs.get(fixture.awayId)!,
              derby: state.clubs[fixture.homeId]!.def.rivals.includes(fixture.awayId),
              neutral: false,
              rules: state.rules,
              capacity: state.clubs[fixture.homeId]!.def.stadium.capacity,
            },
            params,
          );
          add(league, result);
          const diff = shown.get(fixture.homeId)! - shown.get(fixture.awayId)!;
          if (Math.abs(diff) >= 10) {
            const [h, a] = result.score;
            gap10 = {
              matches: gap10.matches + 1,
              strongerWins: gap10.strongerWins + ((diff > 0 ? h > a : a > h) ? 1 : 0),
              draws: gap10.draws + (h === a ? 1 : 0),
            };
          }
        }
      }

      const duel = (strong: number, weak: number, matches: number) => {
        const out = { matches: 0, strongWins: 0, draws: 0, weakWins: 0, goals: 0 };
        const exact = testParams({ clubStrengthSd: 0 });
        const perPair = 50;
        for (let pair = 0; out.matches < matches; pair++) {
          const make = (id: string, strength: number) =>
            generateSquad(
              {
                clubId: id,
                seed: seedFromString(`duel-${strong}-${weak}-${pair}`),
                strength,
                formation: '4-4-2',
              },
              exact,
              fixedIdentitySource(),
            ).players;
          const a = teamInput('duel-a', make('duel-a', strong), '4-4-2', 'traditional', 55);
          const b = teamInput('duel-b', make('duel-b', weak), '4-4-2', 'traditional', 55);
          for (let k = 0; k < perPair && out.matches < matches; k++) {
            // Alternate the listed home side; on neutral ground it only changes the draw order.
            const strongHome = k % 2 === 0;
            const result = simulateMatch(
              {
                fixtureId: `duel-${pair}-${k}`,
                seed: seedFromString(`duel-${strong}-${weak}-${pair}-${k}`),
                home: strongHome ? a : b,
                away: strongHome ? b : a,
                derby: false,
                neutral: true,
                rules: { realism: 'full' },
              },
              params,
            );
            const [h, aw] = result.score;
            const s = strongHome ? h : aw;
            const w = strongHome ? aw : h;
            out.matches += 1;
            out.goals += h + aw;
            if (s > w) out.strongWins += 1;
            else if (s === w) out.draws += 1;
            else out.weakWins += 1;
          }
        }
        return out;
      };
      const d20 = duel(80, 60, DUEL_MATCHES);
      const d30 = duel(85, 55, DUEL_MATCHES);

      const n = league.matches;
      const top = [...league.scores.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5);
      const lines = [
        `[T-009 metrics] league: ${n} matches (${CAREERS} careers × 380), duels: ${d20.matches} + ${d30.matches}`,
        `  goals per match        ${(league.goals / n).toFixed(3)}   target 2.65 (2.50–2.80)`,
        `  0x0                    ${pct(league.nilNil, n)}   target 7% (6–9%)`,
        `  draws                  ${pct(league.draws, n)}   target 26% (24–28%)`,
        `  home wins              ${pct(league.homeWins, n)}   target 47.5% (45–50%)`,
        `  margin >= 3 (goleada)  ${pct(league.thrashings, n)}   target 11% (8–13%)`,
        `  margin >= 5            ${pct(league.bigMargins, n)}   target 1% (0.5–2%)`,
        `  most common scores     ${top.map(([s, c]) => `${s} ${pct(c, n)}`).join(', ')}   target 1x1 and 1x0 in the top 3`,
        `  league, shown gap >= 10: ${gap10.matches} matches, stronger wins ${pct(gap10.strongerWins, gap10.matches || 1)}, draws ${pct(gap10.draws, gap10.matches || 1)}`,
        `  duel 80x60 (gap 20)    stronger wins ${pct(d20.strongWins, d20.matches)}   target 65% (62–68%); draws ${pct(d20.draws, d20.matches)}; goals ${(d20.goals / d20.matches).toFixed(2)}`,
        `  duel 85x55 (gap 30)    weaker wins ${pct(d30.weakWins, d30.matches)}   target 10% (8–12%); stronger ${pct(d30.strongWins, d30.matches)}; goals ${(d30.goals / d30.matches).toFixed(2)}`,
      ];
      console.info(lines.join('\n'));

      // Sanity only (a broken loop, not a tuning question): far outside every target.
      expect(n).toBe(CAREERS * 380);
      if (FULL) expect(n).toBeGreaterThanOrEqual(10_000);
      expect(league.goals / n).toBeGreaterThan(1.5);
      expect(league.goals / n).toBeLessThan(4.5);
      expect(league.homeWins / n).toBeGreaterThan(0.3);
      expect(d20.strongWins / d20.matches).toBeGreaterThan(0.5);
    },
  );
});
