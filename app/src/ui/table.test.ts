import { describe, expect, it } from 'vitest';
import { RELEGATION_SPOTS, getStandings } from '@engine';
import type { Lang } from '@lib/config';
import { t, tPlural } from '@lib/i18n';
import { positionChange } from './round';
import {
  TABLE_COLUMNS,
  legendItems,
  movements,
  openingScroll,
  percentText,
  pointsShare,
  readTable,
  relegationStart,
  rowView,
  tableCaption,
  tableColumns,
  tableStage,
  zoneOf,
} from './table';
import { TEST_CLUB, testCareer } from './testing/game';

/*
 * The Tabela as pure reads (docs/design/telas/tabela.md, "Medidas para o E2E", the Vitest asks of
 * T-031): the zone by position and RELEGATION_SPOTS, the champion only with the season over, no
 * zone before round 1, no change up to round 1, the percentage with 0 games, and the scroll that
 * opens the tab on the coach's row, with no DOM.
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const preseason = testCareer('full', 1);
const round1 = testCareer('full', 2);
const round3 = testCareer('full', 4);
const over = testCareer('full', 39);

describe('tableStage', () => {
  it('is pre-season before round 1, season during it and over at round 39', () => {
    expect(tableStage(preseason)).toBe('preseason');
    expect(tableStage(round1)).toBe('season');
    expect(tableStage(round3)).toBe('season');
    expect(tableStage(over)).toBe('over');
  });
});

describe('zoneOf', () => {
  it('the first is the leader and the last RELEGATION_SPOTS are the relegation zone', () => {
    const rows = 20;
    expect(zoneOf(1, rows, 'season')).toBe('leader');
    for (let p = 2; p <= rows - RELEGATION_SPOTS; p++) {
      expect(zoneOf(p, rows, 'season'), String(p)).toBeUndefined();
    }
    for (let p = rows - RELEGATION_SPOTS + 1; p <= rows; p++) {
      expect(zoneOf(p, rows, 'season'), String(p)).toBe('relegation');
    }
    expect(relegationStart(rows)).toBe(17);
  });

  it('reads the number of rows from the table, never a written 20', () => {
    expect(zoneOf(14, 18, 'season')).toBeUndefined();
    expect(zoneOf(15, 18, 'season')).toBe('relegation');
    expect(relegationStart(18)).toBe(15);
  });

  it('the champion only with the season over; the relegation zone stays', () => {
    expect(zoneOf(1, 20, 'over')).toBe('champion');
    expect(zoneOf(1, 20, 'season')).toBe('leader');
    expect(zoneOf(20, 20, 'over')).toBe('relegation');
  });

  it('no zone before round 1', () => {
    for (let p = 1; p <= 20; p++) expect(zoneOf(p, 20, 'preseason')).toBeUndefined();
  });
});

describe('movements', () => {
  it('none before round 1 and none after round 1 (the table before it is all zeros)', () => {
    expect(movements(preseason).size).toBe(0);
    expect(movements(round1).size).toBe(0);
  });

  it('after round 3, the change of every club is the round summary one, and only when not 0', () => {
    const changes = movements(round3);
    expect(changes.size).toBeGreaterThan(0);
    for (const row of getStandings(round3)) {
      const change = positionChange(round3, row.clubId, 3)!;
      if (change === 0) expect(changes.has(row.clubId), row.clubId).toBe(false);
      else expect(changes.get(row.clubId), row.clubId).toBe(change);
    }
  });

  it('the season over keeps the change of round 38', () => {
    const changes = movements(over);
    for (const row of getStandings(over)) {
      const change = positionChange(over, row.clubId, 38)!;
      expect(changes.get(row.clubId) ?? 0, row.clubId).toBe(change);
    }
  });
});

describe('pointsShare and percentText', () => {
  it('points over the points played; none with 0 games', () => {
    expect(pointsShare({ points: 0, played: 0 })).toBeUndefined();
    expect(pointsShare({ points: 7, played: 4 })).toBeCloseTo(7 / 12);
    expect(pointsShare({ points: 0, played: 3 })).toBe(0);
    expect(pointsShare({ points: 9, played: 3 })).toBe(1);
  });

  it('a whole percentage in the language', () => {
    expect(percentText(7 / 12, 'pt-BR')).toBe('58%');
    expect(percentText(7 / 12, 'en')).toBe('58%');
    expect(percentText(7 / 12, 'es').replace(/\s/g, ' ')).toBe('58 %');
    expect(percentText(1, 'pt-BR')).toBe('100%');
  });
});

describe('readTable', () => {
  it('the rows are the getStandings ones, in its order, with the coach marked', () => {
    const read = readTable(round3, TEST_CLUB);
    expect(read.lines.map((l) => l.row)).toEqual(getStandings(round3));
    expect(read.lines.filter((l) => l.mine).map((l) => l.row.clubId)).toEqual([TEST_CLUB]);
    expect(read.round).toBe(3);
  });

  it('pre-season: 20 rows at 0 points, no zone, no change', () => {
    const read = readTable(preseason, TEST_CLUB);
    expect(read.stage).toBe('preseason');
    expect(read.round).toBe(0);
    expect(read.lines).toHaveLength(20);
    for (const line of read.lines) {
      expect(line.row.points).toBe(0);
      expect(line.zone).toBeUndefined();
      expect(line.change).toBeUndefined();
    }
  });

  it('after round 1: the zones, and no change', () => {
    const read = readTable(round1, TEST_CLUB);
    expect(read.lines.map((l) => l.zone ?? '')).toEqual([
      'leader',
      ...Array<string>(15).fill(''),
      ...Array<string>(4).fill('relegation'),
    ]);
    expect(read.lines.every((l) => l.change === undefined)).toBe(true);
  });

  it('season over: the first is the champion', () => {
    const read = readTable(over, TEST_CLUB);
    expect(read.stage).toBe('over');
    expect(read.round).toBe(38);
    expect(read.lines[0]!.zone).toBe('champion');
    expect(read.lines.slice(16).every((l) => l.zone === 'relegation')).toBe(true);
  });
});

describe('the texts of a row', () => {
  for (const lang of LANGS) {
    it(`${lang}: numbers, signed goal difference, percentage and the last results`, () => {
      const read = readTable(round3, TEST_CLUB);
      for (const line of read.lines) {
        const view = rowView(round3, line, lang);
        const { row } = line;
        expect(view.name).toBe(round3.clubs[row.clubId]!.def.shortName);
        expect(view.stats.slice(0, 7)).toEqual([
          row.points,
          row.played,
          row.wins,
          row.draws,
          row.losses,
          row.goalsFor,
          row.goalsAgainst,
        ]);
        expect(view.stats[7]).toBe(
          new Intl.NumberFormat(lang, { signDisplay: 'exceptZero' }).format(row.goalDifference),
        );
        expect(view.stats[8]).toBe(percentText(row.points / (row.played * 3), lang));
        expect(Array.isArray(view.form)).toBe(true);
        const badges = view.form as readonly { short?: string; label: string }[];
        expect(badges.map((b) => b.short)).toEqual(
          row.form.map((r) => t(`result.${r}.short`, lang)),
        );
        expect(badges.map((b) => b.label)).toEqual(row.form.map((r) => t(`result.${r}`, lang)));
      }
    });

    it(`${lang}: the change as a signed number and the summary's sentence`, () => {
      const read = readTable(round3, TEST_CLUB);
      for (const line of read.lines) {
        const view = rowView(round3, line, lang);
        if (line.change === undefined) {
          expect(view.movement).toBeUndefined();
          continue;
        }
        const n = Math.abs(line.change);
        expect(view.movement).toEqual({
          direction: line.change > 0 ? 'up' : 'down',
          text: new Intl.NumberFormat(lang, { signDisplay: 'exceptZero' }).format(line.change),
          a11y: tPlural(line.change > 0 ? 'round.table.up' : 'round.table.down', n, lang),
        });
      }
    });

    it(`${lang}: "—" with words for screen readers with 0 games`, () => {
      const view = rowView(preseason, readTable(preseason, TEST_CLUB).lines[0]!, lang);
      const none = { text: '—', sr: t('club.form.none', lang) };
      expect(view.stats[8]).toEqual(none);
      expect(view.form).toEqual(none);
      expect(view.stats[7]).toBe('0');
      expect(view.zone).toBeUndefined();
    });

    it(`${lang}: the zone's word, the champion's at the end`, () => {
      const during = readTable(round3, TEST_CLUB).lines.map((l) => rowView(round3, l, lang));
      expect(during[0]!.zone).toEqual({ kind: 'leader', label: t('table.zone.leader', lang) });
      expect(during[19]!.zone).toEqual({
        kind: 'relegation',
        label: t('table.zone.relegation', lang),
      });
      expect(during[10]!.zone).toBeUndefined();
      const final = rowView(over, readTable(over, TEST_CLUB).lines[0]!, lang);
      expect(final.zone).toEqual({ kind: 'leader', label: t('table.zone.champion', lang) });
    });

    it(`${lang}: the caption of each stage`, () => {
      expect(tableCaption(readTable(preseason, TEST_CLUB), preseason, lang)).toBe(
        t('club.table.preseason', lang),
      );
      expect(tableCaption(readTable(round3, TEST_CLUB), round3, lang)).toBe(
        t('table.caption', lang, { round: 3 }),
      );
      expect(tableCaption(readTable(over, TEST_CLUB), over, lang)).toBe(
        t('table.caption.final', lang, { season: over.year }),
      );
    });

    it(`${lang}: the columns in the order of US-023, the full name of each`, () => {
      const columns = tableColumns(lang);
      expect(columns.map((c) => c.id)).toEqual(['club', ...TABLE_COLUMNS]);
      expect(columns[0]).toEqual({ id: 'club', label: t('table.col.club', lang) });
      for (const column of columns.slice(1)) {
        expect(column.label).toBe(t(`table.col.${column.id}`, lang));
        expect(column.full).toBe(t(`table.col.${column.id}.full`, lang));
        expect(column.numeric).toBe(column.id !== 'form');
      }
    });

    it(`${lang}: the legend from round 1, with the champion at the end`, () => {
      expect(legendItems(readTable(preseason, TEST_CLUB), lang)).toEqual([]);
      expect(legendItems(readTable(round1, TEST_CLUB), lang)).toEqual([
        {
          sample: { kind: 'zone', zone: 'leader', position: 1 },
          text: t('table.legend.leader', lang),
        },
        {
          sample: { kind: 'zone', zone: 'relegation', position: 17 },
          text: t('table.legend.relegation', lang, { count: RELEGATION_SPOTS }),
        },
        { sample: { kind: 'movement' }, text: t('table.legend.movement', lang) },
      ]);
      expect(legendItems(readTable(over, TEST_CLUB), lang)[0]!.text).toBe(
        t('table.legend.champion', lang),
      );
    });
  }
});

describe('openingScroll', () => {
  // 360×740: header to 72px, "Jogar rodada" from 620px; rows of 47px.
  const base = { headerBottom: 72, viewBottom: 620, maxScroll: 900 };

  it('stays at the top when the row is whole between the header and "Jogar rodada"', () => {
    expect(openingScroll({ ...base, rowTop: 150, rowBottom: 197 })).toBe(0);
    expect(openingScroll({ ...base, rowTop: 573, rowBottom: 620 })).toBe(0);
  });

  it('puts a row below the first screen in the middle of the area', () => {
    const scroll = openingScroll({ ...base, rowTop: 900, rowBottom: 947 });
    // Past the header, the area is the window down to "Jogar rodada": [scroll, scroll + 620].
    expect(scroll).toBe(Math.round(923.5 - 310));
    expect(900 - scroll).toBeGreaterThanOrEqual(0);
    expect(947 - scroll).toBeLessThanOrEqual(620);
  });

  it('a very low window: the middle of the area with the header still in sight', () => {
    // Area [72, 150] at the top; the row from 120 to 167 is cut by "Jogar rodada".
    const scroll = openingScroll({ ...base, viewBottom: 150, rowTop: 120, rowBottom: 167 });
    expect(scroll).toBeGreaterThan(0);
    expect(scroll).toBeLessThan(72);
    // Area [72, scroll + 150] in the page: its middle is the row's.
    expect((72 + scroll + 150) / 2).toBeCloseTo(143.5, 0);
  });

  it('never past what the page can scroll, nor below 0', () => {
    expect(openingScroll({ ...base, rowTop: 1500, rowBottom: 1547, maxScroll: 800 })).toBe(800);
    expect(openingScroll({ ...base, rowTop: 1500, rowBottom: 1547, maxScroll: -5 })).toBe(0);
  });
});
