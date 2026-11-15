import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '@engine';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import { testMatches } from '../testing/matches';
import { announcement, commentaryItem, phaseLabel, type NarrationContext } from './narration';
import { matchSteps, type LineState } from './steps';

/*
 * The texts of the narrated match (docs/design/telas/partida.md, "Narração em texto" and "Pausa
 * dramática"): the start of a goal and of a chance of the same kind are the same line and the same
 * wait (nothing gives away the outcome); the words of the kind are the match report's; the
 * announcements say the outcome, never the start; every line in the three languages, with no raw
 * key and no unfilled placeholder.
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const matches = testMatches();
const ctxOf = (m: (typeof matches)[number], lang: Lang = 'pt-BR'): NarrationContext => ({
  game: m.game,
  homeId: m.match.home.clubId,
  awayId: m.match.away.clubId,
  lang,
});
const at = { minute: 23, half: 1 } as const;
const line = (source: LineState['source'], stage: LineState['stage'], id = 'x'): LineState => ({
  id,
  source,
  stage,
  clock: at,
});

describe('the start of a play gives no hint of the outcome', () => {
  const m = matches[0]!;
  const shooter = m.match.home.sheet.lineup.starters.find((id) => id !== null)!;
  const base = { ...at, side: 'home' as const };

  it.each(['open', 'freeKick'] as const)(
    '%s: a goal and a chance start with the same line',
    (kind) => {
      for (const lang of LANGS) {
        const ctx = ctxOf(m, lang);
        const goal: MatchEvent = {
          ...base,
          importance: 3,
          type: 'goal',
          scorer: shooter,
          assist: m.match.home.sheet.lineup.starters.find((id) => id !== null && id !== shooter)!,
          kind,
          score: [1, 0],
        };
        for (const outcome of ['saved', 'post', 'wide'] as const) {
          const chance: MatchEvent = {
            ...base,
            importance: 2,
            type: 'chance',
            shooter,
            kind,
            outcome,
            pGoal: 0.3,
          };
          expect(commentaryItem(line(goal, 'build'), ctx)).toEqual(
            commentaryItem(line(chance, 'build'), ctx),
          );
          const [goalStart] = matchSteps([goal], 'full');
          const [chanceStart] = matchSteps([chance], 'full');
          expect(goalStart!.timing).toBe(chanceStart!.timing);
          expect(goalStart!.announce).toBeUndefined();
          expect(chanceStart!.announce).toBeUndefined();
        }
        const start = commentaryItem(line(goal, 'build'), ctx);
        expect(start.kind).not.toBe(t('report.event.goal', lang));
        expect(start.tone).toBeUndefined();
        expect(start.detail).toBeUndefined();
      }
    },
  );

  it('the outcome of a goal says "Gol", the scorer, the kind and the assist; a chance says how it ended', () => {
    const ctx = ctxOf(m);
    const goal: MatchEvent = {
      ...base,
      importance: 3,
      type: 'goal',
      scorer: shooter,
      kind: 'freeKick',
      score: [1, 0],
    };
    const item = commentaryItem(line(goal, 'final'), ctx);
    expect(item).toMatchObject({
      tone: 'goal',
      kind: 'Gol',
      text: m.game.players[shooter]!.name.display,
      note: 'falta',
      noteA11y: 'de falta',
      minute: "23'",
      minuteA11y: 'minuto 23',
    });
    const miss: MatchEvent = {
      ...base,
      importance: 2,
      type: 'chance',
      shooter,
      kind: 'open',
      outcome: 'post',
      pGoal: 0.1,
    };
    expect(commentaryItem(line(miss, 'final'), ctx)).toMatchObject({
      kind: 'Finalização',
      text: `${m.game.players[shooter]!.name.display} acerta a trave.`,
    });
  });
});

describe('every line of real matches, in the three languages', () => {
  it('has the word of its kind, no raw key and no unfilled placeholder', () => {
    for (const m of matches.slice(0, 20)) {
      for (const lang of LANGS) {
        const ctx = ctxOf(m, lang);
        for (const step of matchSteps(m.result.events, 'full')) {
          if (step.line === undefined) continue;
          const item = commentaryItem(step.line, ctx);
          const text = [item.kind, item.text, item.note, item.detail, item.club, item.minute].join(
            ' ',
          );
          expect(item.kind.length, step.line.source.type).toBeGreaterThan(0);
          expect(text).not.toMatch(/\{\w+\}/);
          expect(text).not.toMatch(/\b(match|report|tactic)\.[a-z]/);
          // The phases have no club; a tactic change names it in its own text.
          if (item.tone === 'phase' || step.line.source.type === 'tacticChange') {
            expect(item.club).toBeUndefined();
          } else expect(item.club).toBeTruthy();
          if (step.announce !== undefined) {
            const sentence = announcement(step.announce, ctx)!;
            expect(sentence).toBeTruthy();
            expect(sentence).not.toMatch(/\{\w+\}/);
          }
        }
      }
    }
  });

  it('the words of the kind of the match report: Gol, Pênalti perdido, Amarelo, Vermelho, Lesão, Troca', () => {
    const kinds = new Map<string, string>();
    for (const m of matches) {
      const ctx = ctxOf(m);
      for (const step of matchSteps(m.result.events, 'full')) {
        if (step.line?.stage !== 'final') continue;
        kinds.set(step.line.source.type, commentaryItem(step.line, ctx).kind);
      }
    }
    expect(kinds.get('goal')).toBe(t('report.event.goal', 'pt-BR'));
    expect(kinds.get('substitution')).toBe(t('report.event.sub', 'pt-BR'));
    expect(kinds.get('injury')).toBe(t('report.event.injury', 'pt-BR'));
    expect([
      t('report.event.yellow', 'pt-BR'),
      t('report.event.yellowSuspended', 'pt-BR'),
    ]).toContain(kinds.get('yellow'));
    expect(kinds.get('kickoff')).toBe('Rola a bola!');
    expect(kinds.get('halftime')).toBe('Intervalo');
    expect(kinds.get('secondHalf')).toBe('Começa o 2º tempo');
    expect(kinds.get('fulltime')).toBe('Fim de jogo');
  });
});

describe('a match ended early ("Jogo encerrado")', () => {
  const m = matches[0]!;
  const home = m.game.clubs[m.match.home.clubId]!.def.shortName;
  const away = m.game.clubs[m.match.away.clubId]!.def.shortName;
  const end = (score: [number, number]): Extract<MatchEvent, { type: 'fulltime' }> => ({
    minute: 30,
    half: 1,
    importance: 3,
    type: 'fulltime',
    score,
    abandoned: true,
  });

  it.each(LANGS)(
    '%s: the line names the club short of players; the announcement has the awarded score',
    (lang) => {
      const ctx = ctxOf(m, lang);
      // The home side ended short (it lost 0 × 3); then the away side (3 × 0).
      for (const [score, club] of [
        [[0, 3], home],
        [[3, 0], away],
      ] as const) {
        const item = commentaryItem(line(end([...score]), 'final'), ctx);
        expect(item).toMatchObject({
          tone: 'phase',
          kind: t('match.live.fulltime', lang),
          text: t('match.live.fulltime.abandoned', lang, { club }),
        });
        expect(item.club).toBeUndefined();
        expect(announcement(end([...score]), ctx)).toBe(
          t('match.live.fulltime.a11y', lang, {
            home,
            homeGoals: score[0],
            away,
            awayGoals: score[1],
          }),
        );
      }
      // A whole match has no such sentence.
      const whole: MatchEvent = { ...end([1, 1]), abandoned: false };
      expect(commentaryItem(line(whole, 'final'), ctx).text).toBeUndefined();
    },
  );
});

describe('announcements', () => {
  const m = matches.find((x) => x.result.events.some((e) => e.type === 'goal'))!;
  const ctx = ctxOf(m);

  it('the goal: club, scorer, minute in words and the score', () => {
    const goal = m.result.events.find((e) => e.type === 'goal')!;
    if (goal.type !== 'goal') throw new Error();
    const club =
      m.game.clubs[goal.side === 'home' ? m.match.home.clubId : m.match.away.clubId]!.def.shortName;
    const home = m.game.clubs[m.match.home.clubId]!.def.shortName;
    const away = m.game.clubs[m.match.away.clubId]!.def.shortName;
    expect(announcement(goal, ctx)).toBe(
      `Gol de ${club}, ${m.game.players[goal.scorer]!.name.display}, minuto ${goal.minute}${
        goal.added === undefined ? '' : ` mais ${goal.added} de acréscimo`
      }. ${home} ${goal.score[0]}, ${away} ${goal.score[1]}.`,
    );
  });

  it('nothing for a chance, a yellow, a substitution, a tactic change or a stoppage', () => {
    for (const e of m.result.events) {
      if (
        [
          'chance',
          'yellow',
          'substitution',
          'tacticChange',
          'stoppage',
          'kickoff',
          'injury',
        ].includes(e.type)
      ) {
        expect(announcement(e, ctx), e.type).toBeUndefined();
      }
    }
  });

  it('the phases of the live line', () => {
    expect(['first', 'half', 'second', 'end'].map((p) => phaseLabel(p as never, 'pt-BR'))).toEqual([
      '1º tempo',
      'Intervalo',
      '2º tempo',
      'Fim de jogo',
    ]);
  });
});
