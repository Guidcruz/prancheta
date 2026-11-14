import { describe, expect, it } from 'vitest';
import type { GameState, MatchSheet, MatchSheetEvent } from '@engine';
import { t } from '@lib/i18n';
import { matchDate } from './club';
import { eventLine, matchReport, playedFixture } from './report';
import { TEST_CLUB, testCareer, testSheets } from './testing/game';

/*
 * The match report of T-083 as pure reads (resumo-rodada.md, "Súmula (folha) — T-083"; US-019):
 * `Fixture.result` plus the stored match sheet, the word of each kind of event, the report without
 * its sheet (the goals of the result, the rest unchanged), on real careers.
 */

const game = testCareer('full', 6);
const sheets = testSheets('full', 6);
const round5 = game.fixtures.filter((f) => f.round === 5);
const mine = round5.find((f) => f.homeId === TEST_CLUB || f.awayId === TEST_CLUB)!;
const other = round5.find((f) => f !== mine)!;
const someone = Object.keys(game.players)[0]!;
const another = Object.keys(game.players)[1]!;
const at = { minute: 30, half: 1, importance: 2, side: 'home' } as const;

describe('the report of a played match (resumo-rodada.md, "Súmula")', () => {
  it('every event of the sheet, in the same order, each with the word of its kind', () => {
    const report = matchReport(game, mine.id, sheets[mine.id], TEST_CLUB, 'pt-BR')!;
    const sheet = sheets[mine.id]!;
    expect(report.missing).toBe(false);
    expect(report.events).toHaveLength(sheet.events.length);
    for (const [i, event] of sheet.events.entries()) {
      const line = report.events[i]!;
      expect(line).toEqual(eventLine(game, playedFixture(game, mine.id)!, event, 'pt-BR'));
      expect(line.kind.length).toBeGreaterThan(0);
      const minute = event.added ? `${event.minute}+${event.added}'` : `${event.minute}'`;
      expect(line.minute).toBe(minute);
    }
  });

  it('the meta line, the board read in full, the result of my club, the stats and the place', () => {
    const fixture = playedFixture(game, mine.id)!;
    const report = matchReport(game, mine.id, sheets[mine.id], TEST_CLUB, 'pt-BR')!;
    const name = (id: string) => game.clubs[id]!.def.shortName;
    expect(report.meta).toBe(`Rodada 5 · ${matchDate(fixture.date, 'pt-BR')}`);
    expect(report.scoreA11y).toBe(
      `Placar: ${name(fixture.homeId)} ${fixture.result.score[0]}, ${name(fixture.awayId)} ${fixture.result.score[1]}`,
    );
    expect(report.mine).toBe(fixture.homeId === TEST_CLUB ? 'home' : 'away');
    expect(report.result).toMatch(/^[WDL]$/);
    const { home, away } = fixture.result.stats;
    expect(report.stats.rows.map((r) => [r.label, r.home, r.away])).toEqual([
      ['Finalizações', String(home.shots), String(away.shots)],
      ['Finalizações no gol', String(home.onTarget), String(away.onTarget)],
      ['Posse de bola', `${home.possession}%`, `${away.possession}%`],
      ['Cartões amarelos', String(home.yellows), String(away.yellows)],
      ['Cartões vermelhos', String(home.reds), String(away.reds)],
    ]);
    expect(report.stats.caption).toBe(
      `Estatísticas do jogo: ${name(fixture.homeId)} contra ${name(fixture.awayId)}`,
    );
    const stadium = game.clubs[fixture.homeId]!.def.stadium.name;
    const count = new Intl.NumberFormat('pt-BR').format(fixture.result.attendance);
    expect(report.place).toBe(`${stadium} · Público: ${count}`);
  });

  it('a match of two other clubs: no result badge and no bold side', () => {
    const report = matchReport(game, other.id, sheets[other.id], TEST_CLUB, 'pt-BR')!;
    expect(report.mine).toBeUndefined();
    expect(report.result).toBeUndefined();
  });

  it('the best on the pitch with the rating of the sheet, one decimal in the language', () => {
    const fixture = playedFixture(game, mine.id)!;
    const sheet: MatchSheet = { ...sheets[mine.id]!, motmRating: 7.25 };
    const report = (lang: 'pt-BR' | 'en') =>
      matchReport(game, mine.id, sheet, TEST_CLUB, lang)!.motm;
    expect(fixture.result.motm).toBeDefined();
    const name = game.players[fixture.result.motm!]!.name.display;
    expect(report('pt-BR')).toEqual({ name, rating: 'nota 7,3' });
    expect(report('en')).toEqual({ name, rating: 'rating 7.3' });
  });

  it('a match ended early: the note names the club left short of players (the loser)', () => {
    const fixture = playedFixture(game, mine.id)!;
    const lost = fixture.homeId === TEST_CLUB ? ([0, 3] as const) : ([3, 0] as const);
    const ended = {
      ...game,
      fixtures: game.fixtures.map((f) =>
        f.id === mine.id ? { ...f, result: { ...f.result!, score: lost, abandoned: true } } : f,
      ),
    } as GameState;
    const report = matchReport(ended, mine.id, sheets[mine.id], TEST_CLUB, 'pt-BR')!;
    expect(report.abandoned).toBe(
      t('match.abandoned', 'pt-BR', { club: game.clubs[TEST_CLUB]!.def.shortName }),
    );
    // The board shows the awarded score.
    expect([report.home.goals, report.away.goals]).toEqual([...lost]);
  });

  it('a match played to the end: no note', () => {
    const fixture = playedFixture(game, mine.id)!;
    expect(fixture.result.abandoned).toBe(false);
    const report = matchReport(game, mine.id, sheets[mine.id], TEST_CLUB, 'pt-BR')!;
    expect(report.abandoned).toBeUndefined();
    expect(report.home).toMatchObject({
      name: game.clubs[fixture.homeId]!.def.shortName,
      goals: fixture.result.score[0],
    });
  });

  it('a club of the fixture missing from the state fails the report, for the sheet to catch', () => {
    const clubs = { ...game.clubs };
    delete clubs[mine.homeId];
    const broken = { ...game, clubs } as GameState;
    expect(() => matchReport(broken, mine.id, sheets[mine.id], TEST_CLUB, 'pt-BR')).toThrow();
  });

  it('a fixture not played, or unknown, has no report', () => {
    const next = game.fixtures.find((f) => f.round === 6)!;
    expect(matchReport(game, next.id, undefined, TEST_CLUB, 'pt-BR')).toBeUndefined();
    expect(matchReport(game, 'nobody', undefined, TEST_CLUB, 'pt-BR')).toBeUndefined();
  });
});

describe('the report without its match sheet (resumo-rodada.md, "Súmula", item 6)', () => {
  it('the goals of the result take the place of the events, and the rest stays', () => {
    const fixture = playedFixture(game, mine.id)!;
    const full = matchReport(game, mine.id, sheets[mine.id], TEST_CLUB, 'pt-BR')!;
    const report = matchReport(game, mine.id, undefined, TEST_CLUB, 'pt-BR')!;
    expect(report.missing).toBe(true);
    expect(report.events).toHaveLength(fixture.result.goals.length);
    for (const line of report.events) expect(line.kind).toBe(t('report.event.goal', 'pt-BR'));
    const goals = [...fixture.result.goals].sort(
      (a, b) => a.minute - b.minute || (a.added ?? 0) - (b.added ?? 0),
    );
    expect(report.events.map((l) => l.text)).toEqual(
      goals.map((g) => game.players[g.scorer]!.name.display),
    );
    // The stats, the place and the board come from the result: the same.
    expect(report.stats).toEqual(full.stats);
    expect(report.place).toBe(full.place);
    expect(report.scoreA11y).toBe(full.scoreA11y);
    // The best on the pitch without the rating, which only the sheet has.
    if (fixture.result.motm !== undefined) {
      expect(report.motm).toEqual({ name: game.players[fixture.result.motm]!.name.display });
    }
  });

  it('a sheet of another match counts as none', () => {
    const report = matchReport(game, mine.id, sheets[other.id], TEST_CLUB, 'pt-BR')!;
    expect(report.missing).toBe(true);
  });
});

describe('each kind of event (resumo-rodada.md, the table of item 5)', () => {
  const fixture = playedFixture(game, mine.id)!;
  const line = (event: MatchSheetEvent, state: GameState = game) =>
    eventLine(state, fixture, event, 'pt-BR');
  const name = (id: string) => game.players[id]!.name.display;

  it('a goal: the scorer, the short kind and the assist', () => {
    const goal = line({
      ...at,
      added: 2,
      type: 'goal',
      scorer: someone,
      assist: another,
      kind: 'freeKick',
      score: [1, 0],
    });
    expect(goal).toMatchObject({
      minute: "30+2'",
      minuteA11y: 'minuto 30 mais 2 de acréscimo',
      kind: 'Gol',
      text: name(someone),
      note: 'falta',
      noteA11y: 'de falta',
      detail: `assistência de ${name(another)}`,
      club: game.clubs[fixture.homeId]!.def.shortName,
    });
    expect(goal.icon).toBeUndefined();
    const open = line({ ...at, type: 'goal', scorer: someone, kind: 'open', score: [1, 0] });
    expect(open.note).toBeUndefined();
    expect(open.detail).toBeUndefined();
  });

  it('a missed penalty, a red (direct or a second yellow), an injury and a substitution', () => {
    expect(
      line({ ...at, type: 'penaltyMissed', taker: someone, outcome: 'saved' } as MatchSheetEvent),
    ).toMatchObject({ kind: 'Pênalti perdido', text: name(someone) });
    expect(line({ ...at, type: 'red', player: someone, reason: 'direct' })).toMatchObject({
      icon: 'card',
      tone: 'red',
      kind: 'Vermelho',
    });
    expect(line({ ...at, type: 'red', player: someone, reason: 'secondYellow' }).kind).toBe(
      'Vermelho, 2º amarelo',
    );
    expect(
      line({ ...at, type: 'injury', player: someone, severity: 'light' } as MatchSheetEvent),
    ).toMatchObject({ icon: 'injury', kind: 'Lesão', text: name(someone) });
    expect(
      line({
        ...at,
        side: 'away',
        type: 'substitution',
        in: someone,
        out: another,
        reason: 'fatigue',
      }),
    ).toMatchObject({
      icon: 'swap',
      kind: 'Troca',
      text: `Entra ${name(someone)}, sai ${name(another)}`,
      club: game.clubs[fixture.awayId]!.def.shortName,
    });
  });

  it('a yellow that suspends says so only with the full realism', () => {
    const yellow: MatchSheetEvent = {
      ...at,
      type: 'yellow',
      player: someone,
      triggersSuspension: true,
    };
    expect(line(yellow)).toMatchObject({
      icon: 'card',
      tone: 'yellow',
      kind: 'Amarelo e suspensão',
    });
    expect(line({ ...yellow, triggersSuspension: false }).kind).toBe('Amarelo');
    const simplified = { ...game, rules: { ...game.rules, realism: 'simplified' as const } };
    expect(line(yellow, simplified).kind).toBe('Amarelo');
  });

  it('a player no longer in the state: a neutral word, never an id', () => {
    expect(
      line({ ...at, type: 'injury', player: 'gone', severity: 'light' } as MatchSheetEvent).text,
    ).toBe(t('match.player.unknown', 'pt-BR'));
  });
});
