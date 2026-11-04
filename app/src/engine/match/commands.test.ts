import { describe, expect, it } from 'vitest';
import { FORMATION_SLOTS } from '../formations.ts';
import { BENCH_SIZE } from '../lineup.ts';
import { selectionValue } from '../selection.ts';
import { aiTeamInput, fixtureInput, testGame } from '../testing/match.ts';
import { testParams } from '../testing/params.ts';
import type { Side } from '../types.ts';
import { substitutionsLeft } from './commands.ts';
import { MAX_SUBS } from './rules.ts';
import { simulateMatch } from './simulate.ts';
import type { MatchCommand, MatchEvent, MatchInput, MatchResult, TeamInput } from './types.ts';

/*
 * US-021 (docs/01-requirements.md): commands and substitutions during the match (T-012), with the
 * rules of docs/design/partida.md ("Comandos em jogo", "Substituições", "Determinismo") and the
 * note on commands of docs/02-architecture.md (4.1): a command of minute M takes effect from
 * minute M + 1, so re-running with one more command gives the same events up to minute M; the
 * substitution of a player injured in that same minute is the exception.
 *
 * The coach's side is the home side with `controller: 'human'` (the AI's in-match rules 2 to 6
 * never play for it) and the AI's sheet with a bench of 7.
 */
const params = testParams();
const state = testGame();
const plain = state.fixtures.find((f) => !state.clubs[f.homeId]!.def.rivals.includes(f.awayId))!;

/** The plain fixture with the coach on the home side and the AI on the away side, both with benches. */
const coached: MatchInput = {
  ...fixtureInput(state, plain),
  home: aiTeamInput(state, plain, plain.homeId, 'human'),
  away: aiTeamInput(state, plain, plain.awayId),
};
const home = coached.home.sheet.lineup;

function withSeed(input: MatchInput, seed: number): MatchInput {
  return { ...input, seed, fixtureId: `${input.fixtureId}-${seed}` };
}

type Of<T extends MatchEvent['type']> = Extract<MatchEvent, { type: T }>;
const ofType = <T extends MatchEvent['type']>(result: MatchResult, type: T): Of<T>[] =>
  result.events.filter((e): e is Of<T> => e.type === type);

/** Every player an event names. */
function playersIn(e: MatchEvent): string[] {
  switch (e.type) {
    case 'chance':
      return [e.shooter];
    case 'goal':
      return e.assist === undefined ? [e.scorer] : [e.scorer, e.assist];
    case 'penaltyAwarded':
    case 'penaltyMissed':
      return [e.taker];
    case 'yellow':
    case 'red':
    case 'injury':
      return [e.player];
    case 'substitution':
      return [e.out, e.in];
    default:
      return [];
  }
}

/** The events up to regulation minute `minute` (45 and 90 with their added time). */
const upTo = (events: readonly MatchEvent[], minute: number) =>
  events.filter((e) => e.minute <= minute && e.type !== 'fulltime');

const sub = (minute: number, out: string, into: string, side: Side = 'home'): MatchCommand => ({
  minute,
  side,
  kind: 'substitution',
  out,
  in: into,
});

/** Chances created by `side` after regulation minute `from` (the "finalizações" of the stats). */
function chancesAfter(result: MatchResult, side: Side, from: number): number {
  let n = 0;
  for (const e of result.events) {
    if (e.minute <= from || !('side' in e) || e.side !== side) continue;
    if (e.type === 'chance' || e.type === 'goal' || e.type === 'penaltyMissed') n += 1;
  }
  return n;
}

describe('US-021: substitution', () => {
  // "Dado uma partida no minuto 60": the coach decides with 59 minutes played (the screen shows
  // 60'), so the command is of minute 59 and takes effect at the start of minute 60.
  const out = home.starters[7]!; // a midfielder
  const into = home.bench.find(
    (id) => coached.home.players.find((p) => p.id === id)!.position !== 'GK',
  )!;
  const command = sub(59, out, into);

  it('puts the reserve in the events from minute 60, and the starter in none after it', () => {
    let seen = 0;
    for (let seed = 0; seed < 200; seed++) {
      const input = withSeed(coached, seed);
      const r = simulateMatch(input, params, [command]);
      const off = r.events.some(
        (e) => (e.type === 'red' || e.type === 'injury') && e.player === out && e.minute <= 59,
      );
      // He was already off, or the AI's rule 1 used the reserve for an injury: ignored.
      const used = ofType(r, 'substitution').some((e) => e.in === into && e.minute < 60);
      if (off || used) continue;
      const event = ofType(r, 'substitution').find((e) => e.out === out)!;
      expect(event).toMatchObject({ minute: 60, half: 2, out, in: into, reason: 'tactical' });
      for (const e of r.events) {
        if (playersIn(e).includes(into)) expect(e.minute).toBeGreaterThanOrEqual(60);
        if (playersIn(e).includes(out) && e.type !== 'substitution') {
          expect(e.minute).toBeLessThanOrEqual(59);
        }
      }
      expect(r.minutes[out]).toBe(59);
      expect(r.minutes[into]).toBeGreaterThan(0);
      if (r.events.some((e) => e.type !== 'substitution' && playersIn(e).includes(into))) seen++;
    }
    expect(seen).toBeGreaterThan(20); // the reserve does take part in the play
  });

  it('counts the substitution: one fewer left', () => {
    const r = simulateMatch(coached, params, [command]);
    const at = r.events.findIndex((e) => e.type === 'substitution');
    expect(substitutionsLeft(r.events.slice(0, at), 'home')).toBe(MAX_SUBS);
    expect(substitutionsLeft(r.events.slice(0, at + 1), 'home')).toBe(MAX_SUBS - 1);
    expect(substitutionsLeft(r.events, 'away')).toBe(
      MAX_SUBS - ofType(r, 'substitution').filter((e) => e.side === 'away').length,
    );
  });

  it('keeps the reserve who came on at kick-off for an unavailable starter off the bench', () => {
    // The left-back is injured before the match: the best reserve takes his slot at kick-off and,
    // although still listed on the bench, can never come on again.
    const injured = home.starters[3]!;
    const team: TeamInput = {
      ...coached.home,
      players: coached.home.players.map((p) => (p.id === injured ? { ...p, injuryRounds: 3 } : p)),
    };
    const input = { ...coached, home: team };
    const kickoff = simulateMatch(input, params);
    const replacement = kickoff.warnings.find((w) => w.code === 'lineup-unavailable-player')!
      .detail!.replacement as string;
    expect(home.bench).toContain(replacement);

    const r = simulateMatch(input, params, [sub(30, home.starters[2]!, replacement)]);
    expect(r.warnings).toContainEqual({
      code: 'command-player-not-on-bench',
      detail: { command: 0, side: 'home', minute: 30, kind: 'substitution', player: replacement },
    });
    expect(JSON.stringify(r.events)).toBe(JSON.stringify(kickoff.events));
    // Nor does the AI's rule 1 ever bring him on, in 300 matches with injuries.
    for (let seed = 0; seed < 300; seed++) {
      const s = simulateMatch(withSeed(input, seed), params);
      for (const e of ofType(s, 'substitution')) expect(e.in).not.toBe(replacement);
    }
  });

  it('uses only the first 7 of a longer bench, with a warning', () => {
    const squad = coached.home.players;
    const extra = squad.filter((p) => !home.starters.includes(p.id) && !home.bench.includes(p.id));
    const long = [...home.bench, ...extra.map((p) => p.id)];
    expect(long.length).toBeGreaterThan(BENCH_SIZE);
    const team: TeamInput = {
      ...coached.home,
      sheet: { ...coached.home.sheet, lineup: { ...home, bench: long } },
    };
    const r = simulateMatch({ ...coached, home: team }, params, [
      sub(10, home.starters[9]!, extra[0]!.id),
    ]);
    expect(r.warnings.map((w) => w.code)).toEqual([
      'lineup-bench-too-long',
      'command-player-not-on-bench',
    ]);
  });
});

describe('US-021: the limit of 5 substitutions', () => {
  const outs = home.starters.slice(1, 7);
  const ins = home.bench.slice(0, 6);
  const six = outs.map((out, i) => sub(50, out, ins[i]!));

  it('refuses a 6th substitution with a warning the screen maps to the content message', () => {
    const r = simulateMatch(coached, params, six);
    const subs = ofType(r, 'substitution').filter((e) => e.side === 'home');
    expect(subs).toHaveLength(MAX_SUBS);
    expect(subs.map((e) => e.in)).toEqual(ins.slice(0, MAX_SUBS));
    expect(r.warnings).toContainEqual({
      code: 'command-no-subs-left',
      detail: { command: 5, side: 'home', minute: 50, kind: 'substitution' },
    });
    expect(substitutionsLeft(r.events, 'home')).toBe(0);
    expect(r.minutes[ins[5]!]).toBeUndefined();
  });

  it('leaves an injured player without a substitute once the 5 are used', () => {
    let checked = 0;
    for (let seed = 0; seed < 3_000 && checked < 5; seed++) {
      const r = simulateMatch(withSeed(coached, seed), params, six.slice(0, MAX_SUBS));
      const injury = ofType(r, 'injury').find((e) => e.side === 'home' && e.minute > 50);
      if (injury === undefined) continue;
      checked++;
      const subs = ofType(r, 'substitution').filter((e) => e.side === 'home');
      expect(subs).toHaveLength(MAX_SUBS);
      expect(subs.every((e) => e.reason === 'tactical')).toBe(true);
    }
    expect(checked).toBe(5);
  });

  it('never goes over 5 for a side, commands and AI together, in 1,000 matches', () => {
    for (let seed = 0; seed < 1_000; seed++) {
      const r = simulateMatch(withSeed(coached, seed), params, [
        sub(20, home.starters[9]!, home.bench[6]!),
        ...outs.slice(0, 3).map((out, i) => sub(65, out, ins[i]!)),
      ]);
      for (const side of ['home', 'away'] as const) {
        expect(ofType(r, 'substitution').filter((e) => e.side === side).length).toBeLessThanOrEqual(
          MAX_SUBS,
        );
      }
    }
  });
});

describe('US-021: a command changes the simulation', () => {
  it(
    'with "todo mundo no ataque" from minute 70 the side creates and concedes more than with "segurar o resultado", over 1,000 runs',
    { timeout: 120_000 },
    () => {
      const allOut: MatchCommand = { minute: 70, side: 'home', kind: 'preset', preset: 'allOut' };
      const hold: MatchCommand = { minute: 70, side: 'home', kind: 'preset', preset: 'holdResult' };
      const total = { allOut: { made: 0, conceded: 0 }, hold: { made: 0, conceded: 0 } };
      for (let seed = 0; seed < 1_000; seed++) {
        const input = withSeed(coached, seed);
        const a = simulateMatch(input, params, [allOut]);
        const h = simulateMatch(input, params, [hold]);
        // The same state at minute 70, with the same seed.
        expect(JSON.stringify(upTo(a.events, 70))).toBe(JSON.stringify(upTo(h.events, 70)));
        total.allOut.made += chancesAfter(a, 'home', 70);
        total.allOut.conceded += chancesAfter(a, 'away', 70);
        total.hold.made += chancesAfter(h, 'home', 70);
        total.hold.conceded += chancesAfter(h, 'away', 70);
      }
      expect(total.allOut.made).toBeGreaterThan(total.hold.made);
      expect(total.allOut.conceded).toBeGreaterThan(total.hold.conceded);
    },
  );
});

describe('US-021: the same decisions give the same result', () => {
  const commands: MatchCommand[] = [
    { minute: 0, side: 'home', kind: 'tactic', posture: 'attacking' },
    sub(38, home.starters[5]!, home.bench[3]!),
    { minute: 45, side: 'home', kind: 'halftimeTalk', talk: 'demand' },
    { minute: 55, side: 'home', kind: 'tactic', formation: '4-3-3', pressure: 'high' },
    { minute: 72, side: 'home', kind: 'preset', preset: 'allOut' },
    sub(72, home.starters[1]!, home.bench[1]!),
  ];

  it('gives identical events, byte for byte, in two runs with the same seed and commands', () => {
    for (let seed = 0; seed < 50; seed++) {
      const input = withSeed(coached, seed);
      const a = simulateMatch(input, params, commands);
      const b = simulateMatch(structuredClone(input), params, structuredClone(commands));
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    }
  });

  it('never changes the commands it receives', () => {
    const frozen = Object.freeze(commands.map((c) => Object.freeze({ ...c })));
    expect(() => simulateMatch(coached, params, frozen)).not.toThrow();
  });

  it('does not depend on the order of commands of different minutes in the list', () => {
    const a = simulateMatch(coached, params, commands);
    // Within a minute the list order counts (minute 72 has two commands): keep it, reverse the rest.
    const reordered = [...commands.slice(0, 4), commands[5]!, commands[4]!].reverse();
    expect(JSON.stringify(simulateMatch(coached, params, reordered))).toBe(JSON.stringify(a));
    // Swapping those two only swaps their two events: the same state follows.
    const b = simulateMatch(coached, params, [...commands].reverse());
    expect(b.score).toEqual(a.score);
    expect(b.events.length).toBe(a.events.length);
  });

  it('with two arguments, is the match without commands', () => {
    expect(JSON.stringify(simulateMatch(coached, params, []))).toBe(
      JSON.stringify(simulateMatch(coached, params)),
    );
  });
});

describe('determinism: a command of minute M leaves the events up to M as they were', () => {
  /** A deterministic command of minute `minute` for the seed: substitution, tactic or preset. */
  function commandFor(seed: number, minute: number, side: Side, input: MatchInput): MatchCommand {
    const lineup = input[side].sheet.lineup;
    switch (seed % 4) {
      case 0:
        return sub(minute, lineup.starters[1 + (seed % 10)]!, lineup.bench[seed % 7]!, side);
      case 1:
        return {
          minute,
          side,
          kind: 'tactic',
          formation: (['4-3-3', '3-5-2', '5-3-2'] as const)[seed % 3],
        };
      case 2:
        return {
          minute,
          side,
          kind: 'preset',
          preset: (['press', 'holdResult', 'allOut'] as const)[seed % 3]!,
        };
      default:
        return { minute, side, kind: 'tactic', posture: 'defensive', pressure: 'low' };
    }
  }

  it('re-running with the accumulated list keeps the prefix, in 600 matches (both sides, AI on the other)', () => {
    for (let seed = 0; seed < 600; seed++) {
      const input = withSeed(coached, seed);
      const side: Side = seed % 3 === 0 ? 'away' : 'home';
      const earlier: MatchCommand[] = [commandFor(seed + 1, 20, side, input)];
      const minute = [30, 45, 61, 75, 89][seed % 5]!;
      const added = commandFor(seed, minute, side, input);
      const before = simulateMatch(input, params, earlier);
      const after = simulateMatch(input, params, [...earlier, added]);
      // The one exception: a substitution of a player injured in that very minute happens at once,
      // so the events are the same up to his injury.
      const injury =
        added.kind === 'substitution'
          ? before.events.findIndex(
              (e) => e.type === 'injury' && e.player === added.out && e.minute === minute,
            )
          : -1;
      const prefix = injury >= 0 ? before.events.slice(0, injury + 1) : upTo(before.events, minute);
      expect(JSON.stringify(after.events.slice(0, prefix.length))).toBe(JSON.stringify(prefix));
    }
  });
});

describe('tactics and shortcuts (partida.md, "Táticas" and "Comandos em jogo")', () => {
  const first = (r: MatchResult) => ofType(r, 'tacticChange').find((e) => e.side === 'home');

  it('applies a tactic from the next minute, with the whole new tactic in the event', () => {
    const r = simulateMatch(coached, params, [
      { minute: 30, side: 'home', kind: 'tactic', posture: 'attacking', pressure: 'high' },
    ]);
    expect(first(r)).toEqual({
      minute: 31,
      half: 1,
      importance: 1,
      type: 'tacticChange',
      side: 'home',
      formation: home.formation,
      posture: 'attacking',
      pressure: 'high',
    });
  });

  it('maps each shortcut to its tactic, with the shortcut in the event', () => {
    const start = coached.home.sheet.tactic;
    const press = first(
      simulateMatch(coached, params, [
        { minute: 10, side: 'home', kind: 'preset', preset: 'press' },
      ]),
    )!;
    expect(press).toMatchObject({ posture: start.posture, pressure: 'high', preset: 'press' });
    const hold = first(
      simulateMatch(coached, params, [
        { minute: 10, side: 'home', kind: 'preset', preset: 'holdResult' },
      ]),
    )!;
    expect(hold).toMatchObject({ posture: 'defensive', pressure: 'low', preset: 'holdResult' });
    const all = first(
      simulateMatch(coached, params, [
        { minute: 10, side: 'home', kind: 'preset', preset: 'allOut' },
      ]),
    )!;
    expect(all).toMatchObject({ posture: 'allOut', pressure: 'high', preset: 'allOut' });
  });

  it('gives no event and changes nothing for the tactic the side already has', () => {
    const same: MatchCommand = {
      minute: 10,
      side: 'home',
      kind: 'tactic',
      ...coached.home.sheet.tactic,
      formation: home.formation,
    };
    expect(JSON.stringify(simulateMatch(coached, params, [same]))).toBe(
      JSON.stringify(simulateMatch(coached, params)),
    );
  });

  it('changes the formation, keeping everyone on the pitch', () => {
    const formation = home.formation === '4-3-3' ? '4-4-2' : '4-3-3';
    const r = simulateMatch(coached, params, [
      { minute: 40, side: 'home', kind: 'tactic', formation },
    ]);
    expect(first(r)).toMatchObject({ minute: 41, formation });
    expect(Object.keys(r.minutes).filter((id) => home.starters.includes(id))).toHaveLength(11);
  });
});

describe('invalid commands are ignored with a warning (partida.md, "Casos de borda")', () => {
  const plainRun = simulateMatch(coached, params);
  const keeper = home.starters[0]!;
  const reserve = home.bench[2]!;

  function ignored(command: unknown, code: string, extra: Record<string, unknown> = {}) {
    const r = simulateMatch(coached, params, [command as MatchCommand]);
    expect(JSON.stringify(r.events)).toBe(JSON.stringify(plainRun.events));
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]!.code).toBe(code);
    expect(r.warnings[0]!.detail).toMatchObject({ command: 0, ...extra });
  }

  it('a player who is not on the pitch, or a reserve who is not on the bench', () => {
    const outsider = coached.home.players.find(
      (p) => !home.starters.includes(p.id) && !home.bench.includes(p.id),
    )!;
    ignored(sub(30, outsider.id, reserve), 'command-player-not-on-pitch', { player: outsider.id });
    ignored(sub(30, home.starters[4]!, home.starters[5]!), 'command-player-not-on-bench');
    ignored(sub(30, home.starters[4]!, outsider.id), 'command-player-not-on-bench');
    ignored(
      sub(30, home.starters[4]!, coached.away.sheet.lineup.bench[1]!),
      'command-player-not-on-bench',
    );
  });

  it('a reserve already used, and a player who already left', () => {
    const r = simulateMatch(coached, params, [
      sub(20, home.starters[6]!, reserve),
      sub(30, home.starters[7]!, reserve),
      sub(40, home.starters[6]!, home.bench[3]!),
    ]);
    expect(ofType(r, 'substitution').filter((e) => e.side === 'home')).toHaveLength(1);
    expect(r.warnings.map((w) => w.code)).toEqual([
      'command-player-not-on-bench',
      'command-player-not-on-pitch',
    ]);
  });

  it('a bad minute, side, kind, formation, posture, pressure, shortcut or talk', () => {
    ignored(
      { minute: -1, side: 'home', kind: 'preset', preset: 'press' },
      'command-invalid-minute',
    );
    ignored(
      { minute: 12.5, side: 'home', kind: 'preset', preset: 'press' },
      'command-invalid-minute',
    );
    ignored(
      { minute: 91, side: 'home', kind: 'preset', preset: 'press' },
      'command-invalid-minute',
    );
    ignored(
      { minute: 46, side: 'home', kind: 'halftimeTalk', talk: 'calm' },
      'command-invalid-minute',
    );
    ignored(
      { minute: 10, side: 'middle', kind: 'preset', preset: 'press' },
      'command-unknown-side',
    );
    ignored({ minute: 10, side: 'home', kind: 'swap' }, 'command-unknown-kind');
    ignored(null, 'command-unknown-kind');
    ignored(
      { minute: 10, side: 'home', kind: 'tactic', formation: '4-6-0' },
      'command-unknown-formation',
      { value: '4-6-0' },
    );
    ignored(
      { minute: 10, side: 'home', kind: 'tactic', posture: 'parkTheBus' },
      'command-unknown-posture',
    );
    ignored(
      { minute: 10, side: 'home', kind: 'tactic', pressure: 'extreme' },
      'command-unknown-pressure',
    );
    ignored(
      { minute: 10, side: 'home', kind: 'preset', preset: 'panic' },
      'command-unknown-preset',
    );
    ignored(
      { minute: 45, side: 'home', kind: 'halftimeTalk', talk: 'shout' },
      'command-unknown-talk',
    );
  });

  it('a command of minute 90: there is no next minute', () => {
    ignored({ minute: 90, side: 'home', kind: 'preset', preset: 'allOut' }, 'command-too-late');
    ignored(sub(90, keeper, reserve), 'command-too-late');
  });
});

describe('the coach replaces an injured player (docs/02-architecture.md, 4.1 "Comandos")', () => {
  /** The first seed where a home starter other than the goalkeeper is injured. */
  function injuredMatch() {
    for (let seed = 0; seed < 5_000; seed++) {
      const input = withSeed(coached, seed);
      const r = simulateMatch(input, params);
      const injury = ofType(r, 'injury').find(
        (e) => e.side === 'home' && e.player !== home.starters[0],
      );
      if (injury !== undefined) return { input, r, injury };
    }
    throw new Error('no injury found');
  }
  const { input, r, injury } = injuredMatch();
  const players = new Map(coached.home.players.map((p) => [p.id, p] as const));

  it("without a command, the AI's rule 1 replaces him at once (the coach's club too)", () => {
    const at = r.events.indexOf(injury);
    const event = r.events[at + 1]!;
    expect(event).toMatchObject({
      type: 'substitution',
      side: 'home',
      out: injury.player,
      reason: 'injury',
      minute: injury.minute,
    });
    if (event.type !== 'substitution') return;
    // The reserve with the highest selection value for the slot of the injured player.
    const position = FORMATION_SLOTS[home.formation][home.starters.indexOf(injury.player)]!;
    const best = Math.max(...home.bench.map((id) => selectionValue(players.get(id)!, position)));
    expect(selectionValue(players.get(event.in)!, position)).toBe(best);
  });

  it('with a substitution of the same minute for him, his choice comes on at once', () => {
    const aiChoice = (r.events[r.events.indexOf(injury) + 1] as Of<'substitution'>).in;
    const chosen = home.bench.find((id) => id !== aiChoice && players.get(id)!.position !== 'GK')!;
    const s = simulateMatch(input, params, [sub(injury.minute, injury.player, chosen)]);
    const at = r.events.indexOf(injury);
    expect(JSON.stringify(s.events.slice(0, at + 1))).toBe(
      JSON.stringify(r.events.slice(0, at + 1)),
    );
    expect(s.events[at + 1]).toMatchObject({
      type: 'substitution',
      out: injury.player,
      in: chosen,
      reason: 'injury',
    });
    expect(s.warnings).toEqual([]);
  });

  it("with an invalid choice, falls back to the AI's rule 1 with a warning", () => {
    const s = simulateMatch(input, params, [sub(injury.minute, injury.player, home.starters[2]!)]);
    expect(JSON.stringify(s.events)).toBe(JSON.stringify(r.events));
    expect(s.warnings.map((w) => w.code)).toEqual(['command-player-not-on-bench']);
  });
});
