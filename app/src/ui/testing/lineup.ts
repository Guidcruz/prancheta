import type { DraftSheet, GameState, Player, Position } from '@engine';
import { TEST_CLUB, withPlayer } from './game';

/*
 * The lineup fixture of escalacao.md, "Medidas para o E2E", for the screen tests of T-029, built
 * on a real career by the same rule as tests/e2e/lineup.spec.ts: 4-4-2 with a centre-back on the
 * striker's slot (index 9) and an attacking midfielder on a defensive one (index 6), a tired
 * full-back (condition 79), 6 reserves and a free bench place, and among the players left out
 * one injured (3 rounds) and one suspended. The squad's composition is fixed (3/5/4/4/4/5).
 * Nobody in the squad has a secondary position here (the draw would put one by chance, say on
 * the improvised midfielder); `secondaryFixture` adds the cases of escalacao.md, "Posição
 * secundária".
 */

export interface LineupFixture {
  readonly game: GameState;
  readonly sheet: DraftSheet;
  readonly starters: readonly Player[];
  readonly bench: readonly Player[];
  readonly injured: Player;
  readonly suspended: Player;
  readonly misplaced: Player;
  readonly improvised: Player;
  readonly tired: Player;
}

export function lineupFixture(base: GameState): LineupFixture {
  const left = base.squads[TEST_CLUB]!.map((id) => base.players[id]!).sort(
    (a, b) => b.overall - a.overall,
  );
  const take = (position: Position): Player => {
    const at = left.findIndex((p) => p.position === position);
    if (at < 0) throw new Error(`fixture: no ${position} left`);
    return left.splice(at, 1)[0]!;
  };
  const gk = take('GK');
  const [cb1, cb2, misplaced] = [take('CB'), take('CB'), take('CB')];
  const [fb1, tired] = [take('FB'), take('FB')];
  const dm = take('DM');
  const [improvised, am1, am2] = [take('AM'), take('AM'), take('AM')];
  const st = take('ST');
  const starters = [gk, cb1, cb2, tired, fb1, dm, improvised, am1, am2, misplaced, st];
  const bench = [take('GK'), take('CB'), take('FB'), take('DM'), take('ST'), take('ST')];
  const injured = take('DM');
  const suspended = take('ST');
  let game = base;
  for (const p of [...starters, ...bench, injured, suspended, ...left]) {
    game = withPlayer(game, p.id, {
      injuryRounds: 0,
      suspendedGames: 0,
      condition: 100,
      secondaryPosition: null,
    });
  }
  game = withPlayer(game, tired.id, { condition: 79 });
  game = withPlayer(game, injured.id, { injuryRounds: 3, suspendedGames: 0 });
  game = withPlayer(game, suspended.id, { injuryRounds: 0, suspendedGames: 1 });
  const fresh = (p: Player) => game.players[p.id]!;
  return {
    game,
    sheet: {
      lineup: {
        formation: '4-4-2',
        starters: starters.map((p) => p.id),
        bench: [...bench.map((p) => p.id), null],
        captains: [],
        penaltyTakers: [],
        freeKickTakers: [],
      },
      tactic: { posture: 'balanced', pressure: 'medium' },
    },
    starters: starters.map(fresh),
    bench: bench.map(fresh),
    injured: fresh(injured),
    suspended: fresh(suspended),
    misplaced: fresh(misplaced),
    improvised: fresh(improvised),
    tired: fresh(tired),
  };
}

/**
 * The cases of escalacao.md, "Posição secundária" › "Medidas para o E2E (T-079)", on top of the
 * fixture (the same rule as tests/e2e/lineup-fixture.ts):
 * - (a) `onSecondary`: the bench's defensive midfielder, with secondary CB, in the leftmost CB
 *   slot (index 1); the centre-back of that slot goes to his bench place (3);
 * - (b) `benchSecondary`: the bench's full-back (bench 2), with secondary CB;
 * - (c) `benchPlain`: the attacking midfielder left out, without one, on the bench (4) in place
 *   of a striker, who is left out;
 * - (d) `injuredOnSecondary`: the improvised attacking midfielder of the DM slot (index 6), now
 *   with secondary DM and injured for 2 rounds;
 * - (e) `misplaced`: the centre-back on the striker's slot, as in the fixture.
 * `naturalCb` is the centre-back of slot 2, the slot to pick for the candidate's badge.
 */
export interface SecondaryFixture extends LineupFixture {
  readonly onSecondary: Player;
  readonly benchSecondary: Player;
  readonly benchPlain: Player;
  readonly injuredOnSecondary: Player;
  readonly naturalCb: Player;
}

export function secondaryFixture(fx: LineupFixture): SecondaryFixture {
  const used = new Set([...fx.sheet.lineup.starters, ...fx.sheet.lineup.bench]);
  const spareAm = fx.game.squads[TEST_CLUB]!.map((id) => fx.game.players[id]!).find(
    (p) => p.position === 'AM' && !used.has(p.id),
  );
  if (spareAm === undefined) throw new Error('fixture: no AM left out');
  const dm = fx.bench[3]!;
  const fb = fx.bench[2]!;
  const cb = fx.starters[1]!;
  let game = withPlayer(fx.game, dm.id, { secondaryPosition: 'CB' });
  game = withPlayer(game, fb.id, { secondaryPosition: 'CB' });
  game = withPlayer(game, fx.improvised.id, { secondaryPosition: 'DM', injuryRounds: 2 });
  const starters = [...fx.sheet.lineup.starters];
  const bench = [...fx.sheet.lineup.bench];
  starters[1] = dm.id;
  bench[3] = cb.id;
  bench[4] = spareAm.id;
  const fresh = (p: Player) => game.players[p.id]!;
  return {
    ...fx,
    game,
    sheet: { ...fx.sheet, lineup: { ...fx.sheet.lineup, starters, bench } },
    onSecondary: fresh(dm),
    benchSecondary: fresh(fb),
    benchPlain: fresh(spareAm),
    injuredOnSecondary: fresh(fx.improvised),
    naturalCb: fresh(fx.starters[2]!),
    misplaced: fresh(fx.misplaced),
  };
}
