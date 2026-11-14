import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Player } from '@engine';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import { benchRows } from './lineup';
import LineupView from './screens/LineupView.svelte';
import PlayerSheet from './screens/PlayerSheet.svelte';
import SquadView from './screens/SquadView.svelte';
import { playerCard, positionReading, shownSecondary, sortPlayers, squadPlayers } from './squad';
import { TEST_CLUB, withPlayer } from './testing/game';
import { lineupFixture, secondaryFixture, type SecondaryFixture } from './testing/lineup';
import { testCareer } from './testing/game';

/*
 * The secondary position on the card, in the Elenco and in the lineup's rows (T-081; jogador.md,
 * elenco.md and escalacao.md, "Posição secundária"), on the fixture of the E2E: a defensive
 * midfielder with secondary CB, an attacking midfielder without one and a goalkeeper, in the
 * three languages. Widths, CSS and the real dialog are for the E2E (tests/e2e/secondary-card).
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const noop = () => undefined;
const fx: SecondaryFixture = secondaryFixture(lineupFixture(testCareer('full', 1)));
const { game, sheet } = fx;
const keeper: Player = fx.starters[0]!;
const volante = fx.onSecondary;
const meia = fx.benchPlain;
const lower = (text: string, lang: Lang) => text.toLocaleLowerCase(lang);

const card = (g: typeof game, id: string, lang: Lang) =>
  render(PlayerSheet, {
    props: {
      lang,
      game: g,
      clubId: TEST_CLUB,
      playerId: id,
      hasPrev: true,
      hasNext: true,
      onprev: noop,
      onnext: noop,
      onclose: noop,
    },
  }).body;

const squad = (g: typeof game, lang: Lang) =>
  render(SquadView, {
    props: {
      lang,
      game: g,
      clubId: TEST_CLUB,
      sort: 'position',
      players: sortPlayers(squadPlayers(g, TEST_CLUB), 'position'),
      onsort: noop,
      onopen: noop,
    },
  }).body;

/** The HTML of the row of a player of the squad table, up to its end. */
const rowOf = (body: string, p: Player) => {
  const at = body.indexOf(p.name.display);
  const start = body.lastIndexOf('<tr', at);
  return body.slice(start, body.indexOf('</tr>', at));
};
const tags = (html: string) => [
  ...html.matchAll(/<span class="rotulo tag[^"]*"[^>]*>(.*?)<\/span>/g),
];

describe('the fixture of the secondary position of the card', () => {
  it('has a DM with secondary CB, an AM without one and a goalkeeper', () => {
    expect(volante).toMatchObject({ position: 'DM', secondaryPosition: 'CB' });
    expect(meia).toMatchObject({ position: 'AM', secondaryPosition: null });
    expect(keeper.position).toBe('GK');
  });
});

describe('what the screens read (shownSecondary, positionReading)', () => {
  it('shows the secondary of an outfield player, never a goalkeeper’s or an absent one', () => {
    expect(shownSecondary(volante)).toBe('CB');
    expect(shownSecondary(meia)).toBeUndefined();
    expect(shownSecondary({ ...keeper, secondaryPosition: 'CB' })).toBeUndefined();
  });

  for (const lang of LANGS) {
    it(`${lang}: the reading is the approved sentence, the secondary in lower case`, () => {
      expect(positionReading(volante, lang)).toBe(
        t('squad.secondaryPosition.a11y', lang, {
          natural: t('position.DM', lang),
          secondary: lower(t('position.CB', lang), lang),
        }),
      );
      expect(positionReading(meia, lang)).toBe(t('position.AM', lang));
      expect(positionReading(keeper, lang)).toBe(t('position.GK', lang));
    });
  }

  it('pt-BR: "Volante, também joga de zagueiro"', () => {
    expect(positionReading(volante, 'pt-BR')).toBe('Volante, também joga de zagueiro');
  });
});

describe('the player card (jogador.md, "Posição secundária")', () => {
  for (const lang of LANGS) {
    it(`${lang}: a dl with the label, the neutral hidden tag, the position and the hint`, () => {
      const view = playerCard(game, TEST_CLUB, volante.id, lang)!;
      expect(view.secondary).toEqual({
        code: t('position.CB.short', lang),
        name: t('position.CB', lang),
      });
      const body = card(game, volante.id, lang);
      const dl = /<dl class="pair[^"]*">(.*?)<\/dl>/s.exec(body)?.[1] ?? '';
      expect(dl).toContain(`>${t('player.secondaryPosition', lang)}</dt>`);
      expect(dl).toContain(`<dt class="caption muted`);
      const secondary = tags(dl);
      expect(secondary).toHaveLength(1);
      expect(secondary[0]![0]).toContain('aria-hidden="true"');
      expect(secondary[0]![0]).not.toMatch(/sector-/);
      expect(secondary[0]![0]).toMatch(/\bsm\b/);
      expect(dl).toContain(`<span>${t('position.CB', lang)}</span>`);
      expect(body).toContain(t('player.secondaryPosition.hint', lang));
      // The header's tag keeps the natural position and its sector.
      expect(body).toMatch(/class="rotulo tag[^"]*sector-mid[^"]*"[^>]*>/);
    });

    it(`${lang}: no block for a player without a secondary nor for a goalkeeper`, () => {
      const forced = withPlayer(game, keeper.id, { secondaryPosition: 'CB' });
      for (const [g, id] of [
        [game, meia.id],
        [game, keeper.id],
        [forced, keeper.id],
      ] as const) {
        const body = card(g, id, lang);
        expect(body).not.toContain(`>${t('player.secondaryPosition', lang)}<`);
        expect(body).not.toContain(t('player.secondaryPosition.hint', lang));
        expect(body).not.toContain('class="pair');
        expect(playerCard(g, TEST_CLUB, id, lang)!.secondary).toBeUndefined();
      }
    });
  }
});

describe('the Elenco row (elenco.md, "Posição secundária")', () => {
  for (const lang of LANGS) {
    it(`${lang}: two hidden tags, the second neutral and small, no visible text, the name reads both`, () => {
      const html = rowOf(squad(game, lang), volante);
      const found = tags(html);
      expect(found.map((m) => m[1])).toEqual([
        t('position.DM.short', lang),
        t('position.CB.short', lang),
      ]);
      expect(found[0]![0]).toContain('sector-mid');
      expect(found[1]![0]).not.toContain('sector-');
      expect(found[1]![0]).toMatch(/\bsm\b/);
      for (const m of found) expect(m[0]).toContain('aria-hidden="true"');
      expect(html).toContain(`>${positionReading(volante, lang)}</span>`);
      // No short form such as "também ZAG" (squad.secondaryPosition.short does not exist).
      expect(html.replace(/<span class="visually-hidden[^>]*>.*?<\/span>/gs, '')).not.toMatch(
        /também|también|also/,
      );
    });

    it(`${lang}: one tag for the attacking midfielder and for the goalkeeper`, () => {
      const body = squad(game, lang);
      expect(tags(rowOf(body, meia))).toHaveLength(1);
      expect(tags(rowOf(body, keeper))).toHaveLength(1);
      const forced = squad(withPlayer(game, keeper.id, { secondaryPosition: 'CB' }), lang);
      expect(tags(rowOf(forced, keeper))).toHaveLength(1);
    });
  }

  it('the order "Posição" does not change: the group is the natural position', () => {
    const body = squad(game, 'pt-BR');
    const group = body.indexOf(t('position.DM.group', 'pt-BR'));
    const next = body.indexOf(t('position.AM.group', 'pt-BR'));
    const at = body.indexOf(volante.name.display);
    expect(group).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(group);
    expect(at).toBeLessThan(next);
    expect(body.indexOf(t('position.CB.group', 'pt-BR'))).toBeLessThan(group);
  });
});

describe('the lineup row (escalacao.md, "Sigla secundária nas linhas")', () => {
  const rows = (lang: Lang) => benchRows(game, sheet, {}, lang);
  const byId = (lang: Lang, id: string) =>
    rows(lang).find((r) => r.place.part === 'bench' && sheet.lineup.bench[r.place.index] === id)!;

  for (const lang of LANGS) {
    it(`${lang}: the row of (b) has the secondary code and the accessible name of the elenco`, () => {
      const b = byId(lang, fx.benchSecondary.id);
      expect(b.positionCode).toBe(t('position.FB.short', lang));
      expect(b.secondaryCode).toBe(t('position.CB.short', lang));
      const reading = positionReading(fx.benchSecondary, lang);
      expect(b.a11yLabel).toContain(`${fx.benchSecondary.name.full}, ${reading}, `);
      expect(reading).toContain(lower(t('position.CB', lang), lang));
      const c = byId(lang, fx.benchPlain.id);
      expect(c.secondaryCode).toBeUndefined();
      expect(c.a11yLabel).toContain(`, ${t('position.AM', lang)}, `);
    });

    it(`${lang}: rendered, (b) has two codes, the second hidden and neutral, and (c) one`, () => {
      const body = render(LineupView, {
        props: { lang, game, clubId: TEST_CLUB, sheet, tiredBelow: 79, states: {} },
      }).body;
      const placeHtml = (key: string) => {
        const at = body.indexOf(`data-place="${key}"`);
        return body.slice(at, body.indexOf('</button>', at));
      };
      const second = /<span class="second[^"]*">(.*?)<!----><\/span>/s.exec(placeHtml('bench-2'));
      expect(second).not.toBeNull();
      expect(second![1]).toContain('aria-hidden="true"');
      expect(second![1]).not.toContain('sector-');
      expect(second![1]).toContain(`>${t('position.CB.short', lang)}<`);
      expect(placeHtml('bench-4')).not.toContain('class="second');
    });
  }
});
