import { describe, expect, it } from 'vitest';
import {
  FORMATION_SLOTS,
  HALF_MINUTES,
  correctedCondition,
  effectiveRating,
  isUnavailable,
  naturalFirstEleven,
  playRound,
  prepareRound,
  validateLineup,
} from '../../app/src/engine/index.ts';
import type {
  Formation,
  GameState,
  MatchCommand,
  Player,
  PlayerId,
  Position,
  TeamSheet,
  TeamStrengths,
} from '../../app/src/engine/index.ts';
import { seasonStart } from './league.ts';
import { loadParams, serieAClubs } from './options.ts';
import { asKickoffSheet, expectedPoints, robotRoundInput, robotTalk } from './robot.ts';

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

  it('picks its XI by "natural primeiro" with the eff, as the AI does with its value (T-082)', () => {
    // Everyone is fresh at the start, so the rotation of a congested week changes nobody.
    const eff = (p: Player, slot: Position) => effectiveRating(p, slot, correctedCondition(p));
    /** The greedy fill of before T-082 (strictly higher eff, slot by slot): only a reference. */
    const greedy = (available: readonly Player[], formation: Formation): PlayerId[] => {
      const taken = new Set<PlayerId>();
      for (const slot of FORMATION_SLOTS[formation]) {
        let best: Player | undefined;
        for (const p of available) {
          if (!taken.has(p.id) && (best === undefined || eff(p, slot) > eff(best, slot))) best = p;
        }
        taken.add(best!.id);
      }
      return [...taken];
    };
    const differ: string[] = [];
    for (const clubId of Object.keys(start.squads)) {
      const { lineup } = robotRoundInput(start, params, clubId).sheets[clubId]!;
      const available = start.squads[clubId]!.map((id) => start.players[id]!).filter(
        (p) => !isUnavailable(p),
      );
      const xi = naturalFirstEleven(available, lineup.formation, eff).map((p) => p!.id);
      expect(lineup.starters, clubId).toEqual(xi);
      if (JSON.stringify(greedy(available, lineup.formation)) !== JSON.stringify(xi)) {
        differ.push(clubId);
      }
    }
    // Precondition: in the formation the robot picks, the greedy fill gives another XI for some
    // clubs (11 of the 20 when this was written), so a greedy robot fails the check above.
    expect(differ.length).toBeGreaterThan(0);
  });

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

  it('reads an opponent\'s last sheet with "tudo no ataque" as balanced, like the kick-off', () => {
    const input = robotRoundInput(start, params, CLUB);
    const plan = prepareRound(start, params, input);
    if (!plan.ok) throw new Error('plan');
    const match = plan.value.matches.find((m) => m.home.clubId === CLUB || m.away.clubId === CLUB)!;
    const opponent = match.home.clubId === CLUB ? match.away : match.home;
    const withPosture = (posture: string): GameState => ({
      ...start,
      lastSheets: {
        ...start.lastSheets,
        [opponent.clubId]: {
          ...opponent.sheet,
          tactic: { ...opponent.sheet.tactic, posture: posture as 'balanced' },
        },
      },
    });
    expect(robotRoundInput(withPosture('allOut'), params, CLUB)).toEqual(
      robotRoundInput(withPosture('balanced'), params, CLUB),
    );
    const allOut = { ...opponent.sheet, tactic: { posture: 'allOut', pressure: 'high' } };
    expect(asKickoffSheet(allOut as unknown as TeamSheet).tactic).toEqual({
      posture: 'balanced',
      pressure: 'high',
    });
    expect(asKickoffSheet(opponent.sheet)).toBe(opponent.sheet);
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
