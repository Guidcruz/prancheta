import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { getStandings, type GameState } from '@engine';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import PositionMark from './components/PositionMark.svelte';
import ScrollTable from './components/ScrollTable.svelte';
import TableLegend from './components/TableLegend.svelte';
import TableView from './screens/TableView.svelte';
import { movements } from './table';
import { TEST_CLUB, testCareer } from './testing/game';

/*
 * QA of T-031 (US-023): the Tabela tab rendered on the server (no DOM in the tests), on real
 * careers, for each state of tabela.md (pre-season, round 1, during the season, season over,
 * Simplificado), in the three languages, with no raw text key. The widths, the scroll, the
 * focus, the motion and the colours are for the E2E (tests/e2e/standings.spec.ts).
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const shown = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const RAW_KEY = /(?:^|[>\s"'])(?:table|club|result|round)\.[A-Za-z][\w.-]*(?=[<\s"'])/;
function expectNoRawKey(body: string, label: string): void {
  const text = body
    .replace(/<svg.*?<\/svg>/gs, '')
    .replace(/<style.*?<\/style>/gs, '')
    .replace(/(?:class|href|id|style|for|name|value|data-[a-z]+)="[^"]*"/g, '');
  expect(text.match(RAW_KEY)?.[0], `${label}: raw key on screen`).toBeUndefined();
  expect(text, `${label}: unfilled {placeholder}`).not.toMatch(/\{[a-z]+\}/i);
}

const screen = (game: GameState, lang: Lang = 'pt-BR') =>
  render(TableView, { props: { lang, game, clubId: TEST_CLUB } }).body;

/** The `<tr>` of the body, in order. */
const bodyRows = (body: string) =>
  body.split('<tbody>')[1]!.split('</tbody>')[0]!.split('<tr').slice(1);

const preseason = testCareer('full', 1);
const round1 = testCareer('full', 2);
const round3 = testCareer('full', 4);
const over = testCareer('full', 39);
const simplified = testCareer('simplified', 4);

describe('Tabela (T-031): every state in the three languages', () => {
  for (const lang of LANGS) {
    for (const [label, game] of [
      ['pre-season', preseason],
      ['round 1', round1],
      ['round 3', round3],
      ['season over', over],
      ['simplified', simplified],
    ] as const) {
      it(`${lang}, ${label}: no raw key, 20 rows, the caption label outside the box`, () => {
        const body = screen(game, lang);
        expectNoRawKey(body, `${lang} ${label}`);
        expect((body.match(/<th scope="row"/g) ?? []).length).toBe(20);
        // The visible caption is a label above the scrolling box (aria-hidden); the table's own
        // caption is hidden and is the one read (and the region's name): read once.
        expect(body).toMatch(
          /<div class="label caption[^"]*" aria-hidden="true"[^>]*>[^<]+<\/div>/,
        );
        expect(body).toMatch(/<caption[^>]*visually-hidden/);
        expect(body.indexOf('class="label caption')).toBeLessThan(body.indexOf('class="box '));
        // Read only: nothing in the table is a link or a button.
        const table = body.slice(body.indexOf('<table'), body.indexOf('</table>'));
        expect(table).not.toMatch(/<(a|button)\b/);
        expect(table).not.toContain('aria-sort');
      });
    }
  }
});

describe('the table', () => {
  it('the header: Clube, then the 10 columns with the short label and the full name', () => {
    const body = screen(round3);
    const head = body.slice(body.indexOf('<thead>'), body.indexOf('</thead>'));
    expect((head.match(/scope="col"/g) ?? []).length).toBe(11);
    const ids = ['points', 'played', 'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst'];
    let at = head.indexOf(t('table.col.club', 'pt-BR'));
    for (const id of [...ids, 'goalDiff', 'percent', 'form']) {
      const full = head.indexOf(`<abbr title="${shown(t(`table.col.${id}.full`, 'pt-BR'))}"`, at);
      expect(full, id).toBeGreaterThan(at);
      at = full;
    }
  });

  it('the rows in the order of getStandings, the coach once with aria-current and "seu clube"', () => {
    const body = screen(round3);
    const rows = bodyRows(body);
    const standings = getStandings(round3);
    for (const [i, row] of standings.entries()) {
      expect(rows[i], row.clubId).toContain(shown(round3.clubs[row.clubId]!.def.shortName));
    }
    const mine = rows.filter((r) => r.includes('aria-current="true"'));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toContain(shown(round3.clubs[TEST_CLUB]!.def.shortName));
    expect(mine[0]).toContain(t('table.mine', 'pt-BR'));
    expect(mine[0]).toContain('body-strong');
  });

  it('the fixed column may take 60% of the box', () => {
    expect(screen(round3)).toContain('--fixed-max: 60cqi');
  });

  it('pre-season: no zone, no change, no legend, the pre-season caption, "—" read as no games', () => {
    const body = screen(preseason);
    expect(body).toContain(t('club.table.preseason', 'pt-BR'));
    expect(body).not.toContain('data-zone=');
    expect(body).not.toContain('class="move caption up');
    expect(body).not.toContain('class="move caption down');
    expect(body).not.toContain(t('table.legend.title', 'pt-BR'));
    expect((body.match(new RegExp(t('club.form.none', 'pt-BR'), 'g')) ?? []).length).toBe(40);
  });

  it('round 1: the zones and the legend, no change', () => {
    const body = screen(round1);
    const rows = bodyRows(body);
    expect(rows[0]).toContain('data-zone="leader"');
    expect(rows[0]).toContain(t('table.zone.leader', 'pt-BR'));
    for (const row of rows.slice(1, 16)) expect(row).not.toContain('data-zone=');
    for (const row of rows.slice(16)) {
      expect(row).toContain('data-zone="relegation"');
      expect(row).toContain(t('table.zone.relegation', 'pt-BR'));
    }
    expect(body).not.toMatch(/class="move caption (up|down)/);
    expect(body).toContain(t('table.legend.title', 'pt-BR'));
    expect(body).toContain(t('table.legend.leader', 'pt-BR'));
    expect(body).toContain(t('table.legend.relegation', 'pt-BR', { count: 4 }));
    expect(body).toContain(t('table.legend.movement', 'pt-BR'));
  });

  it('round 3: the arrows of the clubs that moved, with the sentence for screen readers', () => {
    const body = screen(round3);
    const rows = bodyRows(body);
    const changes = movements(round3);
    for (const [i, row] of getStandings(round3).entries()) {
      const change = changes.get(row.clubId);
      if (change === undefined) {
        expect(rows[i], row.clubId).not.toMatch(/class="move caption (up|down)/);
        continue;
      }
      expect(rows[i], row.clubId).toContain(`class="move caption ${change > 0 ? 'up' : 'down'}`);
      expect(rows[i], row.clubId).toContain('animate');
    }
  });

  it('season over: the champion, its legend and the final caption', () => {
    const body = screen(over);
    expect(body).toContain(t('table.caption.final', 'pt-BR', { season: over.year }));
    expect(bodyRows(body)[0]).toContain(t('table.zone.champion', 'pt-BR'));
    expect(body).toContain(t('table.legend.champion', 'pt-BR'));
    expect(body).not.toContain(t('table.legend.leader', 'pt-BR'));
  });
});

describe('the shell of T-031', () => {
  it('ScrollTable keeps 50% by default (the Elenco)', () => {
    const body = render(ScrollTable, {
      props: { caption: 'x', columns: [{ id: 'a', label: 'A' }], children: (() => {}) as never },
    }).body;
    expect(body).toContain('--fixed-max: 50cqi');
  });

  it('PositionMark: the zone as a box, never with text of its own', () => {
    const plain = render(PositionMark, { props: { position: 7 } }).body;
    expect(plain).toContain('>7<');
    expect(plain).not.toContain('data-zone');
    const leader = render(PositionMark, { props: { position: 1, zone: 'leader' } }).body;
    expect(leader).toContain('data-zone="leader"');
    expect(leader.replace(/<[^>]+>/g, '').trim()).toBe('1');
  });

  it('TableLegend: a hidden heading and the samples hidden from screen readers', () => {
    const body = render(TableLegend, {
      props: {
        title: 'Legenda',
        items: [
          { sample: { kind: 'zone', zone: 'relegation', position: 17 }, text: 'Rebaixamento' },
          { sample: { kind: 'movement' }, text: 'Setas' },
        ],
      },
    }).body;
    expect(body).toMatch(/<h2[^>]*class="visually-hidden[^>]*>Legenda(<!---->)?<\/h2>/);
    expect((body.match(/class="sample[^"]*" aria-hidden="true"/g) ?? []).length).toBe(2);
    expect(body).toContain('data-zone="relegation"');
  });
});
