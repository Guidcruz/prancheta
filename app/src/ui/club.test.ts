import { describe, expect, it } from 'vitest';
import { FAN_MOODS, getStandings, type GameState } from '@engine';
import { t } from '@lib/i18n';
import {
  absences,
  absencesLine,
  clubStanding,
  fanReading,
  formBadges,
  matchDate,
  nextMatch,
  preseason,
  readBlock,
  signed,
  tableWindow,
} from './club';
import { TEST_CLUB, testCareer, withFans, withPlayer } from './testing/game';

/*
 * The reads of the Clube screen (clube.md, "O que a tela lê"; US-015, US-026) on real careers:
 * the next match with venue and derby, the absences, the thermometer number and mood, the mini
 * table around the club and the last results. The screen itself is in club-screens.test.ts.
 */

const round5 = testCareer('full', 5);
const squadOf = (game: GameState) => game.squads[TEST_CLUB]!;

describe('nextMatch', () => {
  it('is the fixture of the next round with the club, with the venue and the opponent', () => {
    const next = nextMatch(round5, TEST_CLUB)!;
    expect(next.fixture.round).toBe(5);
    expect([next.fixture.homeId, next.fixture.awayId]).toContain(TEST_CLUB);
    expect(next.venue).toBe(next.fixture.homeId === TEST_CLUB ? 'home' : 'away');
    expect(next.opponentId).not.toBe(TEST_CLUB);
  });

  it('marks a derby when the opponent is in the club rivals', () => {
    const rivals = round5.clubs[TEST_CLUB]!.def.rivals;
    expect(rivals.length).toBeGreaterThan(0);
    const derby = round5.fixtures.find(
      (f) =>
        (f.homeId === TEST_CLUB && rivals.includes(f.awayId)) ||
        (f.awayId === TEST_CLUB && rivals.includes(f.homeId)),
    )!;
    const other = round5.fixtures.find(
      (f) => f.homeId === TEST_CLUB && !rivals.includes(f.awayId) && f.round !== derby.round,
    )!;
    expect(nextMatch({ ...round5, round: derby.round }, TEST_CLUB)!.derby).toBe(true);
    expect(nextMatch({ ...round5, round: other.round }, TEST_CLUB)!.derby).toBe(false);
  });

  it('has none with the season over', () => {
    expect(nextMatch(testCareer('full', 39), TEST_CLUB)).toBeUndefined();
    expect(nextMatch({ ...round5, phase: 'seasonEnd' }, TEST_CLUB)).toBeUndefined();
  });
});

describe('absences (Realismo completo only)', () => {
  const [a, b, c] = squadOf(round5);
  const healthy = squadOf(round5).reduce(
    (game, id) => withPlayer(game, id, { injuryRounds: 0, suspendedGames: 0 }),
    round5,
  );

  it('counts the injured and the suspended; one with both counts only as injured', () => {
    let game = withPlayer(healthy, a!, { injuryRounds: 3 });
    game = withPlayer(game, b!, { suspendedGames: 1 });
    game = withPlayer(game, c!, { injuryRounds: 1, suspendedGames: 1 });
    expect(absences(game, TEST_CLUB)).toEqual({ injured: 2, suspended: 1 });
  });

  it('has no line when nobody is out, in Realismo simplificado, or with the season over', () => {
    expect(absences(healthy, TEST_CLUB)).toBeUndefined();
    const out = withPlayer(healthy, a!, { injuryRounds: 3 });
    expect(absences({ ...out, rules: { realism: 'simplified' } }, TEST_CLUB)).toBeUndefined();
    expect(absences({ ...out, round: 39 }, TEST_CLUB)).toBeUndefined();
  });

  it('writes the line with the plural of each part and joins the two', () => {
    expect(absencesLine({ injured: 1, suspended: 1 }, 'pt-BR')).toBe(
      'Desfalques: 1 lesionado, 1 suspenso',
    );
    expect(absencesLine({ injured: 2, suspended: 0 }, 'pt-BR')).toBe('Desfalques: 2 lesionados');
    expect(absencesLine({ injured: 0, suspended: 3 }, 'pt-BR')).toBe('Desfalques: 3 suspensos');
    for (const lang of ['es', 'en'] as const) {
      expect(absencesLine({ injured: 1, suspended: 2 }, lang)).not.toMatch(/[{}]|club\./);
    }
  });
});

describe('fanReading (US-026)', () => {
  it('shows Math.round of the thermometer and the mood of that same number', () => {
    expect(fanReading(19.49)).toEqual({ value: 19, mood: 'revolt' });
    expect(fanReading(19.5)).toEqual({ value: 20, mood: 'irritated' });
    expect(fanReading(60)).toEqual({ value: 60, mood: 'excited' });
    expect(fanReading(79.5)).toEqual({ value: 80, mood: 'party' });
  });

  it('stays between 0 and 100 and reads a non-finite value as 0', () => {
    expect(fanReading(-3)).toEqual({ value: 0, mood: 'revolt' });
    expect(fanReading(104)).toEqual({ value: 100, mood: 'party' });
    expect(fanReading(Number.NaN)).toEqual({ value: 0, mood: 'revolt' });
  });

  it('has a label in the content for every mood, in every language', () => {
    for (const lang of ['pt-BR', 'es', 'en'] as const) {
      for (const mood of FAN_MOODS) {
        expect(t(`fans.mood.${mood}`, lang), `${lang}/${mood}`).not.toBe(`fans.mood.${mood}`);
      }
    }
  });

  it('reads the club of the career, which starts at fans.start (60, "Animada")', () => {
    const start = testCareer('full', 1).clubs[TEST_CLUB]!.fans;
    expect(fanReading(start)).toEqual({ value: 60, mood: 'excited' });
    expect(fanReading(withFans(round5, TEST_CLUB, 12.4).clubs[TEST_CLUB]!.fans).mood).toBe(
      'revolt',
    );
  });
});

describe('the standings near the club', () => {
  const rows = getStandings(round5);
  const at = (position: number) => rows[position - 1]!.clubId;

  it('takes the club above and below; the first three at the top, the last three at the bottom', () => {
    expect(tableWindow(rows, at(1)).map((r) => r.position)).toEqual([1, 2, 3]);
    expect(tableWindow(rows, at(2)).map((r) => r.position)).toEqual([1, 2, 3]);
    expect(tableWindow(rows, at(13)).map((r) => r.position)).toEqual([12, 13, 14]);
    expect(tableWindow(rows, at(20)).map((r) => r.position)).toEqual([18, 19, 20]);
    expect(tableWindow(rows, 'nobody')).toEqual([]);
  });

  it("gives the club's row of getStandings, with its last results", () => {
    const standing = clubStanding(round5, TEST_CLUB)!;
    const mine = rows.find((r) => r.clubId === TEST_CLUB)!;
    expect(standing.mine).toEqual(mine);
    expect(standing.mine.played).toBe(4);
    expect(standing.window.map((r) => r.clubId)).toContain(TEST_CLUB);
    expect(standing.mine.form.length).toBe(4);
  });

  it('pre-season: round 1, everybody with 0 and no result', () => {
    const before = testCareer('full', 1);
    expect(preseason(before)).toBe(true);
    expect(preseason(round5)).toBe(false);
    const standing = clubStanding(before, TEST_CLUB)!;
    expect(standing.rows.every((r) => r.points === 0 && r.played === 0)).toBe(true);
    expect(formBadges(standing.mine.form, 'pt-BR')).toEqual([]);
  });

  it('the last results are a letter shown and a word read, oldest first', () => {
    expect(formBadges(['W', 'D', 'L'], 'pt-BR')).toEqual([
      { kind: 'win', label: 'Vitória', short: 'V' },
      { kind: 'draw', label: 'Empate', short: 'E' },
      { kind: 'loss', label: 'Derrota', short: 'D' },
    ]);
  });

  it('writes the goal difference with its sign', () => {
    expect(signed(3, 'pt-BR')).toBe('+3');
    expect(signed(0, 'pt-BR')).toBe('0');
    expect(signed(-2, 'pt-BR')).toMatch(/^[-−]2$/);
  });
});

describe('matchDate', () => {
  it('formats the day with weekday and short month in the language, without a time zone shift', () => {
    // 2026-04-12 is a Sunday.
    expect(matchDate('2026-04-12', 'pt-BR')).toMatch(/^dom\.?, 12 de abr\.?$/);
    expect(matchDate('2026-04-12', 'en')).toMatch(/Sun/);
    expect(matchDate('2026-04-12', 'es')).toMatch(/12/);
  });
});

describe('readBlock', () => {
  it('keeps the value, or the error a read threw, without throwing', () => {
    expect(readBlock(() => 7)).toEqual({ ok: true, value: 7 });
    const error = new Error('boom');
    expect(
      readBlock(() => {
        throw error;
      }),
    ).toEqual({ ok: false, error });
  });
});
