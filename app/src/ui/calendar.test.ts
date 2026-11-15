import { describe, expect, it } from 'vitest';
import { SEASON_ROUNDS, type Fixture, type GameState } from '@engine';
import { t } from '@lib/i18n';
import {
  calendarHalves,
  calendarScroll,
  cameFromList,
  cardView,
  clubCalendar,
  halfOf,
  listTarget,
  nextRoundOf,
  originOf,
  withoutOrigin,
  roundFromAddress,
  roundMatches,
  roundPlayed,
} from './calendar';
import { matchDate } from './club';
import { resultOf } from './round';
import {
  CALENDAR_DESTINATION,
  calendarRoundHref,
  calendarRoundOf,
  destinationOf,
  hrefOf,
} from './router';
import { TEST_CLUB, testCareer } from './testing/game';

/*
 * T-084 (US-024): the pure reads of the Calendário (docs/design/telas/calendario.md, "O que a
 * tela lê" and "Medidas para o E2E", the Vitest part): the 38 rounds of the club (half, next
 * round, result on the coach's side, derby), the order of the Rodada (the coach's match first),
 * the address of the Rodada (only a round already played) and the scroll of the list, with no DOM.
 */

const preseason = testCareer('full', 1);
const round10 = testCareer('full', 10);
const over = testCareer('full', 39);

const mineOf = (f: Fixture) => f.homeId === TEST_CLUB || f.awayId === TEST_CLUB;

/** A copy of `game` with the coach's match of `round` ended early (awarded score). */
function withAbandoned(game: GameState, round: number): GameState {
  return {
    ...game,
    fixtures: game.fixtures.map((f) =>
      f.round === round && mineOf(f) && f.result !== undefined
        ? { ...f, result: { ...f.result, abandoned: true } }
        : f,
    ),
  };
}

describe('the 38 rounds of the club (US-024, scenario 1)', () => {
  it('one entry per round, in order, the venue from homeId', () => {
    const entries = clubCalendar(round10, TEST_CLUB);
    expect(entries.map((e) => e.round)).toEqual(
      Array.from({ length: SEASON_ROUNDS }, (_, i) => i + 1),
    );
    for (const entry of entries) {
      expect(mineOf(entry.fixture)).toBe(true);
      expect(entry.venue).toBe(entry.fixture.homeId === TEST_CLUB ? 'home' : 'away');
    }
  });

  it('the rounds played carry the result on the coach side; the others none', () => {
    for (const entry of clubCalendar(round10, TEST_CLUB)) {
      if (entry.round < 10) {
        expect(entry.result).toBe(resultOf(entry.fixture.result!.score, entry.venue));
      } else {
        expect(entry.result).toBeUndefined();
        expect(entry.fixture.result).toBeUndefined();
      }
    }
  });

  it('only the next round is the next one; none with the season over', () => {
    expect(
      clubCalendar(round10, TEST_CLUB)
        .filter((e) => e.next)
        .map((e) => e.round),
    ).toEqual([10]);
    expect(
      clubCalendar(preseason, TEST_CLUB)
        .filter((e) => e.next)
        .map((e) => e.round),
    ).toEqual([1]);
    expect(clubCalendar(over, TEST_CLUB).some((e) => e.next)).toBe(false);
    expect(nextRoundOf(round10)).toBe(10);
    expect(nextRoundOf(over)).toBeUndefined();
  });

  it('two halves of 19 rounds, split at SEASON_ROUNDS / 2', () => {
    const halves = calendarHalves(clubCalendar(round10, TEST_CLUB));
    expect(halves.first.map((e) => e.round)).toEqual(
      Array.from({ length: SEASON_ROUNDS / 2 }, (_, i) => i + 1),
    );
    expect(halves.second.map((e) => e.round)).toEqual(
      Array.from({ length: SEASON_ROUNDS / 2 }, (_, i) => i + 1 + SEASON_ROUNDS / 2),
    );
    expect(halfOf(SEASON_ROUNDS / 2)).toBe('first');
    expect(halfOf(SEASON_ROUNDS / 2 + 1)).toBe('second');
  });

  it('a derby exactly when the opponent is in the rivals of the club (scenario 3)', () => {
    const rivals = round10.clubs[TEST_CLUB]!.def.rivals;
    const entries = clubCalendar(round10, TEST_CLUB);
    for (const entry of entries) {
      const opponent = entry.venue === 'home' ? entry.fixture.awayId : entry.fixture.homeId;
      expect(entry.derby, `round ${entry.round}`).toBe(rivals.includes(opponent));
    }
    // The test club has rivals, so the case is exercised.
    expect(entries.some((e) => e.derby)).toBe(true);
  });
});

describe('the card of a round', () => {
  const entries = clubCalendar(round10, TEST_CLUB);
  const name = (id: string) => round10.clubs[id]!.def.shortName;

  it('a played card: the meta line, the goals, the derby then the result badge, and its name', () => {
    for (const entry of entries.filter((e) => e.round < 10)) {
      const view = cardView(round10, entry, 'pt-BR');
      const [hg, ag] = entry.fixture.result!.score;
      expect(view.meta).toBe(
        t('club.next.meta', 'pt-BR', {
          round: entry.round,
          date: matchDate(entry.fixture.date, 'pt-BR'),
        }),
      );
      expect([view.homeGoals, view.awayGoals]).toEqual([hg, ag]);
      const word = t(`result.${entry.result!}`, 'pt-BR');
      expect(view.badges.map((b) => b.kind)).toEqual([
        ...(entry.derby ? ['derby'] : []),
        { W: 'win', D: 'draw', L: 'loss' }[entry.result!],
      ]);
      expect(view.badges.at(-1)!.label).toBe(word);
      expect(view.highlight).toBeUndefined();
      // The visible text in the same order (WCAG 2.5.3), then the venue and the derby.
      const venue = t(`match.venue.${entry.venue}`, 'pt-BR');
      expect(view.a11yLabel).toBe(
        [
          `Ver a rodada ${entry.round}: ${name(entry.fixture.homeId)} ${hg} ${name(entry.fixture.awayId)} ${ag}, ${word}`,
          venue,
          ...(entry.derby ? [t('match.derby', 'pt-BR')] : []),
        ].join(', '),
      );
    }
  });

  it('a card still to play: no goals, no name, no result; the next one with the highlight', () => {
    for (const entry of entries.filter((e) => e.round >= 10)) {
      const view = cardView(round10, entry, 'pt-BR');
      expect(view.a11yLabel).toBeUndefined();
      expect(view.homeGoals).toBeUndefined();
      expect(view.badges.map((b) => b.kind)).toEqual(entry.derby ? ['derby'] : []);
      expect(view.highlight).toBe(entry.round === 10 ? t('club.next.title', 'pt-BR') : undefined);
    }
  });

  it('a match ended early: the note on the card and at the end of its name', () => {
    const game = withAbandoned(round10, 3);
    const entry = clubCalendar(game, TEST_CLUB).find((e) => e.round === 3)!;
    for (const lang of ['pt-BR', 'es', 'en'] as const) {
      const view = cardView(game, entry, lang);
      const note = t('match.abandoned.short', lang);
      expect(view.note).toBe(note);
      expect(view.a11yLabel!.endsWith(`, ${note}`)).toBe(true);
      expect(view.a11yLabel).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('the Rodada (scenario 2): the coach match first, then the calendar order', () => {
  it('the ten matches of a round played', () => {
    const matches = roundMatches(round10, TEST_CLUB, 3)!;
    expect(matches).toHaveLength(10);
    expect(mineOf(matches[0]!)).toBe(true);
    const others = round10.fixtures.filter((f) => f.round === 3 && !mineOf(f));
    expect(matches.slice(1).map((f) => f.id)).toEqual(others.map((f) => f.id));
  });

  it('none for a round still to play or out of the season', () => {
    expect(roundMatches(round10, TEST_CLUB, 10)).toBeUndefined();
    expect(roundMatches(round10, TEST_CLUB, 0)).toBeUndefined();
    expect(roundMatches(round10, TEST_CLUB, 39)).toBeUndefined();
    expect(roundPlayed(round10, 9)).toBe(true);
    expect(roundPlayed(round10, 10)).toBe(false);
    expect(roundPlayed(over, SEASON_ROUNDS)).toBe(true);
  });
});

describe('the address of the Rodada (calendario.md, "Endereço que não vale")', () => {
  it('the address of a round and back', () => {
    expect(calendarRoundHref(5)).toBe('#/calendar/round/5');
    expect(calendarRoundOf('#/calendar/round/5')).toBe('5');
    expect(calendarRoundOf('#/calendar/round/abc')).toBe('abc');
    expect(calendarRoundOf('#/calendar/round/')).toBe('');
    for (const hash of ['#/calendar', '#/club', '', '#/calendar/5', '#/round']) {
      expect(calendarRoundOf(hash), hash).toBeUndefined();
    }
  });

  it('every address of the Rodada is the Calendário tab', () => {
    for (const hash of ['#/calendar/round/3', '#/calendar/round/30', '#/calendar/round/abc']) {
      expect(destinationOf(hash)).toBe(CALENDAR_DESTINATION);
    }
    expect(destinationOf(hrefOf(CALENDAR_DESTINATION))).toBe(CALENDAR_DESTINATION);
  });

  it('only a round already played of this season opens', () => {
    expect(roundFromAddress(round10, '3')).toBe(3);
    expect(roundFromAddress(round10, '9')).toBe(9);
    expect(roundFromAddress(over, '38')).toBe(38);
    for (const text of ['10', '30', '0', '39', 'abc', '', '03', '+3', '3.0', '-1', ' 3', '1e1']) {
      expect(roundFromAddress(round10, text), text).toBeUndefined();
    }
    expect(roundFromAddress(round10, undefined)).toBeUndefined();
    expect(roundFromAddress(preseason, '1')).toBeUndefined();
  });

  it('the list entry remembers the round it was left for; the Rodada entry its list', () => {
    expect(originOf({ calendarFrom: 3 })).toBe(3);
    expect(originOf({ calendarFrom: 3, sheet: 'x' })).toBe(3);
    for (const state of [null, undefined, {}, { calendarFrom: '3' }, { calendarFrom: 2.5 }, 3]) {
      expect(originOf(state)).toBeUndefined();
    }
    // A list shown without its origin forgets it; nothing else of the entry changes.
    expect(withoutOrigin({ calendarFrom: 3 })).toBeNull();
    expect(withoutOrigin({ calendarFrom: 3, saves: true })).toEqual({ saves: true });
    for (const state of [null, undefined, {}, { calendarFrom: 'x' }, { saves: true }]) {
      expect(withoutOrigin(state)).toBeUndefined();
    }
    expect(cameFromList({ calendarList: true })).toBe(true);
    expect(cameFromList({ calendarList: true, sheet: 'report', fixture: 'f' })).toBe(true);
    for (const state of [null, {}, { calendarList: 'yes' }, { round: true }]) {
      expect(cameFromList(state)).toBe(false);
    }
  });
});

describe('where the list opens (US-024; CEO decision 4)', () => {
  it('back from a Rodada, its round; otherwise the next round; with the season over, the last', () => {
    expect(listTarget(round10)).toBe(10);
    expect(listTarget(round10, 3)).toBe(3);
    expect(listTarget(preseason)).toBe(1);
    expect(listTarget(over)).toBe(SEASON_ROUNDS);
    expect(listTarget(over, 12)).toBe(12);
    expect(listTarget(round10, 0)).toBe(10);
    expect(listTarget(round10, 39)).toBe(10);
  });

  // A phone 740px tall: the header ends at 56, "Jogar rodada" starts at 600; cards of 150px.
  const layout = (top: number, maxScroll = 6000) => ({
    rowTop: top,
    rowBottom: top + 150,
    headerBottom: 56,
    viewBottom: 600,
    maxScroll,
  });

  it('the card in the middle of the area between the header and "Jogar rodada"', () => {
    const scroll = calendarScroll(layout(1500));
    // Scrolled past the header: the area is [0, 600] in the window; the card's middle at 300.
    expect(1500 + 75 - scroll).toBe(300);
  });

  it('a card near the top leaves the list at the top (round 1), one near the end at the end', () => {
    expect(calendarScroll(layout(120))).toBe(0);
    expect(calendarScroll(layout(5900, 5400))).toBe(5400);
  });

  it('a card still under the header: the middle of the area that is left below it', () => {
    const scroll = calendarScroll(layout(260));
    const top = 260 - scroll;
    const areaTop = 56 - scroll;
    expect(scroll).toBeGreaterThan(0);
    expect(Math.abs(top + 75 - (areaTop + 600) / 2)).toBeLessThanOrEqual(0.5);
  });
});
