import {
  RELEGATION_SPOTS,
  getStandings,
  type ClubId,
  type GameState,
  type StandingRow,
} from '@engine';
import type { Lang } from '@lib/config';
import { seasonOver } from '@lib/career';
import { t } from '@lib/i18n';
import type { TableColumn } from './components/ScrollTable.svelte';
import type { StatusBadgeItem } from './components/StatusBadge.svelte';
import type { TableLegendItem } from './components/TableLegend.svelte';
import type { TableCell, TableForm, TableMovement, TableZone } from './components/TableRow.svelte';
import { formBadges, preseason, signed } from './club';
import { changeLine } from './round';

/*
 * What the Tabela tab reads of the career (docs/design/telas/tabela.md, "O que a tela lê"; US-023):
 * the standings of `getStandings`, the zone of each row, the change of position in the last round
 * and the percentage. Pure reads of the GameState through the engine's contract; nothing here
 * computes a rule of the game (the order and the tie-breaks are the engine's). The texts come from
 * the content (`t`), never from here.
 */

/** Where the season stands for the table: before round 1, during it, or over (round 39). */
export type TableStage = 'preseason' | 'season' | 'over';

export function tableStage(game: GameState): TableStage {
  if (seasonOver(game)) return 'over';
  return preseason(game) ? 'preseason' : 'season';
}

/** The zone of a row (tabela.md, "Zonas"): the first place and the last `RELEGATION_SPOTS`. */
export type Zone = 'leader' | 'champion' | 'relegation';

/**
 * The zone of `position` in a table of `rows` rows: none before round 1; the first is the leader
 * (the champion once the season is over); the last {@link RELEGATION_SPOTS} are the relegation
 * zone. The number of rows comes from the table itself, never from a written 20.
 */
export function zoneOf(position: number, rows: number, stage: TableStage): Zone | undefined {
  if (stage === 'preseason') return undefined;
  if (position === 1) return stage === 'over' ? 'champion' : 'leader';
  if (position > rows - RELEGATION_SPOTS) return 'relegation';
  return undefined;
}

/** The first position of the relegation zone (17 with 20 clubs), for the legend's sample. */
export const relegationStart = (rows: number): number => rows - RELEGATION_SPOTS + 1;

/**
 * The change of position of every club in the last round played (`r = game.round − 1`): the
 * table after `r` against the table after `r − 1`, as the round summary does (`positionChange`).
 * Positive up, negative down; clubs that kept their place are not in the map. Nothing before
 * round 2 is played (the table before round 1 is all zeros; tabela.md, "Mudança de posição").
 */
export function movements(game: GameState): ReadonlyMap<ClubId, number> {
  const changes = new Map<ClubId, number>();
  const round = game.round - 1;
  if (round <= 1) return changes;
  const before = new Map(getStandings(game, round - 1).map((r) => [r.clubId, r.position]));
  for (const row of getStandings(game, round)) {
    const was = before.get(row.clubId);
    if (was !== undefined && was !== row.position) changes.set(row.clubId, was - row.position);
  }
  return changes;
}

/** The share of the points played that were won (`points / (played × 3)`); none without games. */
export function pointsShare(row: Pick<StandingRow, 'points' | 'played'>): number | undefined {
  return row.played === 0 ? undefined : row.points / (row.played * 3);
}

/** One row of the table as the screen draws it, before the texts. */
export interface TableLine {
  readonly row: StandingRow;
  readonly zone?: Zone;
  /** Places moved in the last round (never 0: a row that kept its place has none). */
  readonly change?: number;
  readonly mine: boolean;
}

/** The standings as the Tabela reads them. */
export interface TableRead {
  readonly stage: TableStage;
  /** The last round played (0 before round 1, 38 with the season over). */
  readonly round: number;
  readonly lines: readonly TableLine[];
}

/** The table of the season, with the zones and the changes of the last round. */
export function readTable(game: GameState, clubId: ClubId): TableRead {
  const stage = tableStage(game);
  const rows = getStandings(game);
  const changes = movements(game);
  const lines = rows.map((row): TableLine => {
    const zone = zoneOf(row.position, rows.length, stage);
    const change = changes.get(row.clubId);
    return {
      row,
      ...(zone === undefined ? {} : { zone }),
      ...(change === undefined ? {} : { change }),
      mine: row.clubId === clubId,
    };
  });
  return { stage, round: Math.max(0, game.round - 1), lines };
}

/** The column ids after the club, in the order of the table (US-023; temporada.md). */
export const TABLE_COLUMNS = [
  'points',
  'played',
  'wins',
  'draws',
  'losses',
  'goalsFor',
  'goalsAgainst',
  'goalDiff',
  'percent',
  'form',
] as const;

/** The header of the table: the club, then the short label shown with the full name read. */
export function tableColumns(lang: Lang): TableColumn[] {
  return [
    { id: 'club', label: t('table.col.club', lang) },
    ...TABLE_COLUMNS.map((id) => ({
      id,
      label: t(`table.col.${id}`, lang),
      full: t(`table.col.${id}.full`, lang),
      numeric: id !== 'form',
    })),
  ];
}

/** The visible caption: the round, the pre-season sentence, or the final standings. */
export function tableCaption(read: TableRead, game: GameState, lang: Lang): string {
  if (read.stage === 'preseason') return t('club.table.preseason', lang);
  if (read.stage === 'over') return t('table.caption.final', lang, { season: game.year });
  return t('table.caption', lang, { round: read.round });
}

/** "67%" in the language, with no decimal place. */
export function percentText(share: number, lang: Lang): string {
  return new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(share);
}

/** The props of one TableRow `full`, every text ready. */
export interface TableRowView {
  readonly clubId: ClubId;
  readonly position: number;
  readonly name: string;
  readonly isMine: boolean;
  readonly stats: readonly TableCell[];
  readonly form: TableForm;
  readonly zone?: TableZone;
  readonly movement?: TableMovement;
}

/** The texts of one line (tabela.md, "A linha"): numbers, sign, percentage, form and words. */
export function rowView(game: GameState, line: TableLine, lang: Lang): TableRowView {
  const { row } = line;
  const none = { text: '—', sr: t('club.form.none', lang) };
  const share = pointsShare(row);
  const form: TableForm =
    row.form.length === 0 ? none : (formBadges(row.form, lang) as readonly StatusBadgeItem[]);
  const zone: TableZone | undefined =
    line.zone === undefined
      ? undefined
      : {
          kind: line.zone === 'relegation' ? 'relegation' : 'leader',
          label: t(`table.zone.${line.zone}`, lang),
        };
  const change = line.change;
  const movement: TableMovement | undefined =
    change === undefined
      ? undefined
      : {
          direction: change > 0 ? 'up' : 'down',
          text: signed(change, lang),
          a11y: changeLine(change, lang).text,
        };
  return {
    clubId: row.clubId,
    position: row.position,
    name: game.clubs[row.clubId]?.def.shortName ?? row.clubId,
    isMine: line.mine,
    stats: [
      row.points,
      row.played,
      row.wins,
      row.draws,
      row.losses,
      row.goalsFor,
      row.goalsAgainst,
      signed(row.goalDifference, lang),
      share === undefined ? none : percentText(share, lang),
    ],
    form,
    ...(zone === undefined ? {} : { zone }),
    ...(movement === undefined ? {} : { movement }),
  };
}

/**
 * The legend under the table (tabela.md, "Legenda"): the leader's (or champion's) mark, the
 * relegation mark with the first number of the zone, and the arrows. None before round 1 (no
 * zone and no arrow to explain).
 */
export function legendItems(read: TableRead, lang: Lang): TableLegendItem[] {
  if (read.stage === 'preseason') return [];
  const rows = read.lines.length;
  return [
    {
      sample: { kind: 'zone', zone: 'leader', position: 1 },
      text: t(read.stage === 'over' ? 'table.legend.champion' : 'table.legend.leader', lang),
    },
    {
      sample: { kind: 'zone', zone: 'relegation', position: relegationStart(rows) },
      text: t('table.legend.relegation', lang, { count: RELEGATION_SPOTS }),
    },
    { sample: { kind: 'movement' }, text: t('table.legend.movement', lang) },
  ];
}

/** Where things are when the tab opens, in px (tabela.md, "Abre mostrando o meu clube"). */
export interface OpeningLayout {
  /** The coach's row, in page coordinates (from the top of the document). */
  readonly rowTop: number;
  readonly rowBottom: number;
  /** The end of the screen header, in page coordinates (it scrolls away with the page). */
  readonly headerBottom: number;
  /**
   * The bottom of the visible area in window coordinates: the top of the floating "Jogar
   * rodada" on the phone, the height of the window on the desktop (fixed, it does not scroll).
   */
  readonly viewBottom: number;
  /** How far the page can scroll. */
  readonly maxScroll: number;
}

/**
 * The scroll of the page when the tab opens: 0 when the coach's row is whole between the header
 * and "Jogar rodada" at the top; otherwise the scroll that puts the row in the middle of that
 * area (the header scrolls away, so the area starts at the top of the window once the page has
 * scrolled past it), clamped to what the page can scroll. No animation: the caller jumps.
 */
export function openingScroll(layout: OpeningLayout): number {
  const { rowTop, rowBottom, headerBottom, viewBottom, maxScroll } = layout;
  if (rowTop >= headerBottom && rowBottom <= viewBottom) return 0;
  const middle = (rowTop + rowBottom) / 2;
  // Scrolled past the header, the area is [s, s + viewBottom]: its middle is the row's.
  let scroll = middle - viewBottom / 2;
  // Still under the header, the area is [headerBottom, s + viewBottom].
  if (scroll < headerBottom) scroll = 2 * middle - headerBottom - viewBottom;
  return Math.round(Math.min(Math.max(scroll, 0), Math.max(maxScroll, 0)));
}
