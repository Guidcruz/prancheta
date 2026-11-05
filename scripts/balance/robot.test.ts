import { describe, expect, it } from 'vitest';
import {
  HALF_MINUTES,
  playRound,
  prepareRound,
  validateLineup,
} from '../../app/src/engine/index.ts';
import type { GameState, MatchCommand, TeamStrengths } from '../../app/src/engine/index.ts';
import { seasonStart } from './league.ts';
import { loadParams, serieAClubs } from './options.ts';
import { expectedPoints, robotRoundInput, robotTalk } from './robot.ts';

/*
 * The robot coach (balance-targets.md, decision 10): valid sheets and commands, the same input for
 * the same state, the talk by the score, the fans decisions up to the cap, and a season that the
 * engine plays without a single warning about the robot's input.
 */

const loaded = loadParams();
if (!loaded.ok) throw new Error('params');
const params = loaded.params;
const ctx = { params, clubs: serieAClubs(), seed: 1 };
const CLUB = 'coritibom';

describe('robotTalk', () => {
  it('"Cobrar" losing (unless hotheads would pay for it), "Motivar" drawing, "Acalmar" winning', () => {
    expect(robotTalk(0, 1, 0)).toBe('demand');
    expect(robotTalk(0, 1, 1)).toBe('demand');
    expect(robotTalk(0, 1, 2)).toBe('motivate');
    expect(robotTalk(1, 1, 0)).toBe('motivate');
    expect(robotTalk(2, 1, 3)).toBe('calm');
  });
});

describe('expectedPoints', () => {
  const team = (power: number, defense: number): TeamStrengths => ({
    goalkeeper: 70,
    def: defense,
    mid: power,
    atk: power,
    power,
    defense,
    factor: 1,
  });

  it('is 3 points shared between two equal sides, and more for the stronger one', () => {
    const even = expectedPoints(team(70, 70), team(70, 70), params);
    expect(even).toBeGreaterThan(1.2);
    expect(even).toBeLessThan(1.5);
    expect(expectedPoints(team(80, 80), team(70, 70), params)).toBeGreaterThan(even);
    expect(expectedPoints(team(60, 60), team(70, 70), params)).toBeLessThan(even);
  });
});

describe('robotRoundInput', () => {
  const start = seasonStart(ctx, 1);

  it('gives a valid sheet, the "full" mode, commands for its match and the fans cap', () => {
    const input = robotRoundInput(start, params, CLUB);
    const sheet = input.sheets[CLUB]!;
    expect(validateLineup(start, CLUB, sheet).ok).toBe(true);
    expect(sheet.lineup.starters).toHaveLength(11);
    expect(input.coaches).toEqual({ [CLUB]: 'full' });
    expect(input.fanDecisions).toEqual({ [CLUB]: params.fans.decisionCap });
    const fixture = start.fixtures.find(
      (f) => f.round === 1 && (f.homeId === CLUB || f.awayId === CLUB),
    )!;
    expect(Object.keys(input.commands)).toEqual([fixture.id]);
    const commands = input.commands[fixture.id]!;
    const talks = commands.filter((c) => c.kind === 'halftimeTalk');
    expect(talks).toHaveLength(1);
    expect(talks[0]!.minute).toBe(HALF_MINUTES);
    for (const c of commands) expect(c.minute).toBeGreaterThanOrEqual(HALF_MINUTES);
  });

  it('is the same for the same state, and never changes it', () => {
    const before = JSON.stringify(start);
    expect(robotRoundInput(start, params, CLUB)).toEqual(robotRoundInput(start, params, CLUB));
    expect(JSON.stringify(start)).toBe(before);
  });

  it('plays the club as the human of the round: the match uses its sheet', () => {
    const input = robotRoundInput(start, params, CLUB);
    const plan = prepareRound(start, params, input);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const match = plan.value.matches.find((m) => m.home.clubId === CLUB || m.away.clubId === CLUB)!;
    const own = match.home.clubId === CLUB ? match.home : match.away;
    expect(own.controller).toBe('human');
    expect(own.sheet).toEqual(input.sheets[CLUB]);
  });

  it(
    'plays a whole season: every command is taken, and the robot substitutes and talks',
    { timeout: 60_000 },
    () => {
      let state: GameState = start;
      let subs = 0;
      let talks = 0;
      const warnings: string[] = [];
      while (state.phase === 'season' && state.round <= 38) {
        const input = robotRoundInput(state, params, CLUB);
        const commands = Object.values(input.commands).flat() as MatchCommand[];
        subs += commands.filter((c) => c.kind === 'substitution').length;
        talks += commands.filter((c) => c.kind === 'halftimeTalk').length;
        const played = playRound(state, params, input);
        expect(played.ok).toBe(true);
        if (!played.ok) return;
        for (const r of played.value.report.results) {
          if (!r.fixtureId.endsWith(`-${CLUB}`) && !r.fixtureId.includes(`-${CLUB}-`)) continue;
          for (const w of r.warnings) warnings.push(`r${state.round} ${w.code}`);
        }
        state = played.value.state;
      }
      expect(warnings).toEqual([]);
      expect(talks).toBe(38);
      expect(subs / 38).toBeGreaterThan(2);
      expect(subs / 38).toBeLessThanOrEqual(5);
    },
  );
});
