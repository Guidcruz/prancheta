import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { getStandings, type GameState, type PlayerId } from '@engine';
import type { CareerSave, CareerService, CareerState } from '@lib/career';
import type { Lang } from '@lib/config';
import type { ErrorLog } from '@lib/errors';
import { loadGameParams } from '@lib/params';
import { t, tPlural } from '@lib/i18n';
import CareerFrame from './CareerFrame.svelte';
import type { TabItem } from './components/TabBar.svelte';
import { NAV_EXTRA, NAV_SETTINGS, NAV_TUTORIAL } from './components/nav-items';
import { fanReading, nextMatch } from './club';
import { hrefOf } from './router';
import ClubView from './screens/ClubView.svelte';
import PlayerSheet from './screens/PlayerSheet.svelte';
import SquadView from './screens/SquadView.svelte';
import { sortPlayers, squadPlayers, type SquadSort } from './squad';
import { TEST_CLUB, testCareer, withFans, withPlayer } from './testing/game';

/*
 * QA of T-028 (US-015, US-016, US-026): the Clube and Elenco tabs and the player card rendered
 * on the server (no DOM in the tests), on real careers, for each state of clube.md, elenco.md and
 * jogador.md, in the three languages, with no raw text key. Touch, the real dialog, the history,
 * the focus, the widths and the motion are for the E2E (tests/e2e/club-squad.spec.ts).
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const noop = () => undefined;
const shown = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const RAW_KEY =
  /(?:^|[>\s"'])(?:nav|action|play|career|error|screen|club|squad|player|position|status|fans|match|table|result|attr|trait)\.[A-Za-z][\w.-]*(?=[<\s"'])/;
function expectNoRawKey(body: string, label: string): void {
  const text = body
    .replace(/<svg.*?<\/svg>/gs, '')
    .replace(/<style.*?<\/style>/gs, '')
    .replace(/(?:class|href|id|style|for|name|value|data-[a-z]+)="[^"]*"/g, '');
  expect(text.match(RAW_KEY)?.[0], `${label}: raw key on screen`).toBeUndefined();
  expect(text, `${label}: unfilled {placeholder}`).not.toMatch(/\{[a-z]+\}/i);
}
const primaries = (body: string) => (body.match(/class="btn botao primary/g) ?? []).length;

const more = (lang: Lang): TabItem[] =>
  [...NAV_EXTRA, ...NAV_SETTINGS, NAV_TUTORIAL].map((d) => ({
    id: d.id,
    icon: d.icon,
    label: t(d.labelKey, lang),
    href: hrefOf(d.id),
  }));

const round5 = testCareer('full', 5);
const healthy = (game: GameState) =>
  game.squads[TEST_CLUB]!.reduce(
    (g, id) => withPlayer(g, id, { injuryRounds: 0, suspendedGames: 0 }),
    game,
  );

const club = (game: GameState, lang: Lang = 'pt-BR', extra: { loading?: boolean } = {}) =>
  render(ClubView, { props: { lang, game, clubId: TEST_CLUB, more: more(lang), ...extra } }).body;

/** The HTML of one block of the Clube screen. */
function block(body: string, name: 'next' | 'fans' | 'table'): string {
  const start = body.indexOf(`data-block="${name}"`);
  expect(start, name).toBeGreaterThan(0);
  const ends = ['next', 'fans', 'table']
    .map((other) => body.indexOf(`data-block="${other}"`, start + 1))
    .filter((i) => i > start);
  const more = body.indexOf('class="more');
  return body.slice(start, Math.min(...ends, more > 0 ? more : body.length));
}

/** A game whose table cannot be computed (a played match without a score): a bug in a read. */
function brokenTable(game: GameState): GameState {
  const played = game.fixtures.findIndex((f) => f.result !== undefined);
  return {
    ...game,
    fixtures: game.fixtures.map((f, i) => (i === played ? ({ ...f, result: {} } as never) : f)),
  };
}

describe('the Clube screen (clube.md; US-015, US-026)', () => {
  for (const lang of LANGS) {
    it(`${lang}: every state has the club, no raw key and no primary button of its own`, () => {
      const injured = withPlayer(healthy(round5), round5.squads[TEST_CLUB]![0]!, {
        injuryRounds: 2,
      });
      const states: Record<string, string> = {
        round5: club(round5, lang),
        preseason: club(testCareer('full', 1), lang),
        seasonOver: club(testCareer('full', 39), lang),
        simplified: club(testCareer('simplified', 5), lang),
        absences: club(injured, lang),
        blockError: club(brokenTable(round5), lang),
      };
      for (const [name, body] of Object.entries(states)) {
        expect(body, name).toContain(shown(round5.clubs[TEST_CLUB]!.def.shortName));
        expectNoRawKey(body, `${lang}/${name}`);
        // The primary of the tab is "Jogar rodada", in the frame.
        expect(primaries(body), `${lang}/${name}`).toBe(0);
      }
      const loading = club(round5, lang, { loading: true });
      expect(loading).toContain(shown(t('club.loading', lang)));
      expect(loading).not.toContain('data-block=');
      expectNoRawKey(loading, `${lang}/loading`);
    });
  }

  it('round 5: the next opponent with the venue in text, linking to the Calendário', () => {
    const body = club(round5);
    const next = nextMatch(round5, TEST_CLUB)!;
    const html = block(body, 'next');
    expect(html).toContain(shown(round5.clubs[next.opponentId]!.def.shortName));
    expect(html).toContain(t(`match.venue.${next.venue}`, 'pt-BR'));
    expect(html).toContain(t('club.next.meta', 'pt-BR', { round: 5, date: '' }).trim());
    expect(html).toMatch(/<a class="match link[^"]*" href="#\/calendar"/);
    expect(html).toContain(`aria-label="${shown(t('club.next.actionA11y', 'pt-BR'))}"`);
  });

  it('round 5: the position of getStandings, the points line and the last results as V/E/D', () => {
    const body = club(round5);
    const mine = getStandings(round5).find((r) => r.clubId === TEST_CLUB)!;
    const html = block(body, 'table');
    expect(html).toContain(`data-position="${mine.position}"`);
    expect(html).toContain(t('club.table.position', 'pt-BR', { position: mine.position }));
    expect(html).toContain(
      `${tPlural('club.table.points', mine.points, 'pt-BR')} ${tPlural('club.table.played', 4, 'pt-BR')}`,
    );
    // Three rows, the coach's one marked beyond colour.
    expect(html.match(/<th scope="row"/g)).toHaveLength(3);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain(t('table.mine', 'pt-BR'));
    expect(html).toMatch(/href="#\/table"/);
    // One letter badge per played match, with the whole word for screen readers.
    expect(html.match(/class="badge rotulo (?:win|draw|loss)/g)).toHaveLength(4);
    for (const r of mine.form) expect(html).toContain(t(`result.${r}`, 'pt-BR'));
  });

  it('the thermometer: Math.round of the club fans, "de 100" and the mood word; the bar is hidden', () => {
    for (const fans of [7.4, 19.5, 50, 79.6, 100]) {
      const game = withFans(round5, TEST_CLUB, fans);
      const html = block(club(game), 'fans');
      const reading = fanReading(fans);
      expect(html).toContain(`>${reading.value}</span>`);
      expect(html).toContain(t('fans.scale', 'pt-BR'));
      expect(html).toContain(t(`fans.mood.${reading.mood}`, 'pt-BR'));
      expect(html).toContain('class="bar svelte');
      expect(html).toMatch(/class="bar[^"]*" aria-hidden="true"/);
      expect(html).not.toContain('role="meter"');
      expect(html).toContain('aria-describedby=');
    }
  });

  it('keeps the order Próximo jogo, Torcida, Classificação in the DOM', () => {
    const body = club(round5);
    const at = (name: string) => body.indexOf(`data-block="${name}"`);
    expect(at('next')).toBeLessThan(at('fans'));
    expect(at('fans')).toBeLessThan(at('table'));
  });

  it('the foot has the entries of the "Mais" menu, in its order', () => {
    const body = club(round5);
    const foot = body.slice(body.indexOf('class="more'));
    let from = 0;
    for (const entry of more('pt-BR')) {
      const at = foot.indexOf(`href="${entry.href}"`, from);
      expect(at, entry.id).toBeGreaterThan(from);
      from = at;
    }
    expect(foot).toContain(t('nav.more', 'pt-BR'));
  });

  it('pre-season: round 1, the thermometer at fans.start, position "—" and no result yet', () => {
    const before = testCareer('full', 1);
    const body = club(before);
    expect(block(body, 'next')).toContain(
      t('club.next.meta', 'pt-BR', { round: 1, date: '' }).trim(),
    );
    const fans = block(body, 'fans');
    expect(fans).toContain('>60</span>');
    expect(fans).toContain(t('fans.mood.excited', 'pt-BR'));
    const table = block(body, 'table');
    expect(table).toContain('—');
    expect(table).not.toContain('data-position=');
    expect(table).toContain(shown(t('club.table.preseason', 'pt-BR')));
    expect(table).toContain(t('club.form.none', 'pt-BR'));
    expect(table.match(/<th scope="row"/g)).toHaveLength(3);
  });

  it('season over: no match card nor absences; the line of the season and the final table stay', () => {
    const over = testCareer('full', 39);
    const injured = withPlayer(over, over.squads[TEST_CLUB]![0]!, { injuryRounds: 2 });
    const body = club(injured);
    const next = block(body, 'next');
    expect(next).toContain(shown(t('club.next.none', 'pt-BR')));
    expect(next).not.toContain('class="match');
    expect(next).not.toContain('href="#/squad"');
    expect(next).toMatch(/href="#\/calendar"/);
    expect(body).toContain(t('career.seasonOver', 'pt-BR', { season: over.year }));
    expect(block(body, 'table')).toContain('data-position=');
  });

  it('Realismo completo: the absences line links to the Elenco; none when nobody is out', () => {
    const squad = round5.squads[TEST_CLUB]!;
    let game = withPlayer(healthy(round5), squad[0]!, { injuryRounds: 3 });
    game = withPlayer(game, squad[1]!, { suspendedGames: 1 });
    const next = block(club(game), 'next');
    expect(next).toContain('Desfalques: 1 lesionado, 1 suspenso');
    expect(next).toMatch(/href="#\/squad"/);
    expect(block(club(healthy(round5)), 'next')).not.toContain('href="#/squad"');
  });

  it('Realismo simplificado: never the absences line', () => {
    const simplified = testCareer('simplified', 5);
    const game = withPlayer(simplified, simplified.squads[TEST_CLUB]![0]!, { injuryRounds: 3 });
    const next = block(club(game), 'next');
    expect(next).not.toContain('Desfalques');
    expect(next).not.toContain('href="#/squad"');
  });

  it('a derby carries the "Clássico" badge with its icon', () => {
    const rivals = round5.clubs[TEST_CLUB]!.def.rivals;
    const derby = round5.fixtures.find(
      (f) =>
        (f.homeId === TEST_CLUB && rivals.includes(f.awayId)) ||
        (f.awayId === TEST_CLUB && rivals.includes(f.homeId)),
    )!;
    const html = block(club({ ...round5, round: derby.round }), 'next');
    expect(html).toContain('badge rotulo derby');
    expect(html).toContain(t('match.derby', 'pt-BR'));
  });

  it('a block that fails is an ErrorState with "Tentar de novo"; the others stay', () => {
    const body = club(brokenTable(round5));
    const table = block(body, 'table');
    expect(table).toContain('error block');
    expect(table).toContain(shown(t('club.error.block.title', 'pt-BR')));
    expect(table).toContain(shown(t('club.error.block.body', 'pt-BR')));
    expect(table).toContain(t('action.retry', 'pt-BR'));
    expect(block(body, 'next')).toContain('class="match');
    expect(block(body, 'fans')).toContain(t('fans.scale', 'pt-BR'));
    expect(body.match(/role="alert"/g)).toHaveLength(1);
  });

  it('opens the career frame on the Clube tab', () => {
    const save = {
      careerId: '00000000-0000-4000-8000-000000000028',
      career: { clubId: TEST_CLUB },
      game: round5,
    } as unknown as CareerSave;
    const career: CareerState = {
      status: 'open',
      save,
      busy: false,
      roundsLost: 0,
      missingSheetRounds: [],
    };
    const body = render(CareerFrame, {
      props: {
        career,
        service: { params: loadGameParams() } as unknown as CareerService,
        log: {} as ErrorLog,
        lang: 'pt-BR',
        onhome: noop,
      },
    }).body;
    expect(body).toContain('data-block="next"');
    expect(body).not.toContain(t('screen.soon', 'pt-BR'));
  });
});

const squadView = (game: GameState, sort: SquadSort = 'position', lang: Lang = 'pt-BR') =>
  render(SquadView, {
    props: {
      lang,
      game,
      clubId: TEST_CLUB,
      sort,
      players: sortPlayers(squadPlayers(game, TEST_CLUB), sort),
      onsort: noop,
      onopen: noop,
    },
  }).body;

/** The text of the header cells, in order. */
const headers = (body: string) =>
  [...body.matchAll(/<th scope="col"[^>]*>(.*?)<\/th>/gs)].map((m) =>
    m[1]!
      .replace(/<span class="visually-hidden[^"]*">.*?<\/span>/gs, '')
      .replace(/<[^>]+>/g, '')
      .trim(),
  );

describe('the Elenco screen (elenco.md; US-016)', () => {
  for (const lang of LANGS) {
    it(`${lang}: every state has the 25 players and no raw key`, () => {
      const states: Record<string, string> = {
        position: squadView(round5, 'position', lang),
        overall: squadView(round5, 'overall', lang),
        condition: squadView(round5, 'condition', lang),
        preseason: squadView(testCareer('full', 1), 'position', lang),
        simplified: squadView(testCareer('simplified', 5), 'position', lang),
      };
      for (const [name, body] of Object.entries(states)) {
        expect(body.match(/<th scope="row"/g), name).toHaveLength(25);
        expectNoRawKey(body, `${lang}/${name}`);
        expect(primaries(body), name).toBe(0);
      }
      const loading = render(SquadView, {
        props: {
          lang,
          game: round5,
          clubId: TEST_CLUB,
          sort: 'position',
          players: [],
          onsort: noop,
          onopen: noop,
          loading: true,
        },
      }).body;
      expect(loading).toContain(shown(t('squad.loading', lang)));
      expect(loading).not.toContain('<table');
    });
  }

  it('Realismo completo: Nota, Cond., Moral, Forma and Idade; three sorts', () => {
    const body = squadView(round5);
    expect(headers(body)).toEqual(['Jogador', 'Nota', 'Cond.', 'Moral', 'Forma', 'Idade']);
    expect(body.match(/type="radio"/g)).toHaveLength(3);
    expect(body).toContain('>Condição<');
    // Each row: position code, name, then the numbers.
    const player = squadPlayers(round5, TEST_CLUB)[0]!;
    expect(body).toContain(shown(player.name.display));
    expect(body).toContain(t(`position.${player.position}.short`, 'pt-BR'));
    expect(body).toContain(t(`position.${player.position}`, 'pt-BR'));
    // The caption is visible and counts the squad.
    expect(body).toContain(
      shown(
        tPlural('squad.caption', 25, 'pt-BR', { club: round5.clubs[TEST_CLUB]!.def.shortName }),
      ),
    );
    expect(body).not.toMatch(/<caption[^>]*visually-hidden/);
  });

  it('Realismo simplificado: no "Cond." column and no "Condição" sort', () => {
    const body = squadView(testCareer('simplified', 5));
    expect(headers(body)).toEqual(['Jogador', 'Nota', 'Moral', 'Forma', 'Idade']);
    expect(body.match(/type="radio"/g)).toHaveLength(2);
    expect(body).not.toContain('>Condição<');
    expect(body).not.toContain(t('squad.col.condition.full', 'pt-BR'));
  });

  it('Posição: a group row per position and no aria-sort; Nota descending; Condição ascending', () => {
    const position = squadView(round5, 'position');
    expect(position.match(/scope="colgroup"/g)).toHaveLength(6);
    expect(position).not.toContain('aria-sort');
    const overall = squadView(round5, 'overall');
    expect(overall).not.toContain('scope="colgroup"');
    expect(overall.match(/aria-sort="descending"/g)).toHaveLength(1);
    expect(overall).toMatch(
      /aria-sort="descending"[^>]*>(?:<!--[^>]*-->)*<abbr title="Nota geral"/,
    );
    const condition = squadView(round5, 'condition');
    expect(condition.match(/aria-sort="ascending"/g)).toHaveLength(1);
    expect(condition).toMatch(
      /aria-sort="ascending"[^>]*>(?:<!--[^>]*-->)*<abbr title="Condição física"/,
    );
  });

  it('the situation in icon and text: "Lesionado, 3 rodadas", "Suspenso" and "Promessa"', () => {
    const squad = round5.squads[TEST_CLUB]!;
    let game = withPlayer(healthy(round5), squad[0]!, { injuryRounds: 3 });
    game = withPlayer(game, squad[1]!, { suspendedGames: 1 });
    const body = squadView(game);
    expect(body).toMatch(
      /badge rotulo injured[^>]*>(?:<!--[^>]*-->)*<svg[\s\S]*?Lesionado, 3 rodadas/,
    );
    expect(body).toMatch(/badge rotulo suspended[^>]*>(?:<!--[^>]*-->)*<svg[\s\S]*?Suspenso/);
    const simplified = squadView({ ...game, rules: { realism: 'simplified' } });
    expect(simplified).not.toContain('badge rotulo injured');
    expect(simplified).not.toContain('badge rotulo suspended');
  });

  it('pre-season: the form is "—", read as "sem jogos"; the condition is 100 for everybody', () => {
    const body = squadView(testCareer('full', 1));
    expect(body.match(/<span aria-hidden="true">—<\/span>/g)).toHaveLength(25);
    expect(body.match(new RegExp(t('squad.form.none', 'pt-BR'), 'g'))).toHaveLength(25);
    expect(squadPlayers(testCareer('full', 1), TEST_CLUB).every((p) => p.condition === 100)).toBe(
      true,
    );
  });
});

const sheet = (
  game: GameState,
  playerId: PlayerId | undefined,
  extra: { hasPrev?: boolean; hasNext?: boolean } = {},
  lang: Lang = 'pt-BR',
) =>
  render(PlayerSheet, {
    props: {
      lang,
      game,
      clubId: TEST_CLUB,
      playerId,
      hasPrev: extra.hasPrev ?? true,
      hasNext: extra.hasNext ?? true,
      onprev: noop,
      onnext: noop,
      onclose: noop,
    },
  }).body;

describe('the player card (jogador.md; US-016)', () => {
  const striker = squadPlayers(round5, TEST_CLUB).find((p) => p.position === 'ST')!;

  for (const lang of LANGS) {
    it(`${lang}: the card, a stale id and the simplified card have no raw key`, () => {
      expectNoRawKey(sheet(round5, striker.id, {}, lang), `${lang}/card`);
      expectNoRawKey(sheet(round5, 'nobody', {}, lang), `${lang}/stale`);
      const simplified = testCareer('simplified', 5);
      const id = squadPlayers(simplified, TEST_CLUB)[0]!.id;
      expectNoRawKey(sheet(simplified, id, {}, lang), `${lang}/simplified`);
    });
  }

  it('a dialog named by the name of the row, with the avatar, 6 attributes, the trait and the season', () => {
    const body = sheet(round5, striker.id);
    expect(body).toMatch(/<dialog[^>]*aria-labelledby/);
    expect(body).toContain(`>${shown(striker.name.display)}</h2>`);
    const attributes = body.slice(body.indexOf(t('player.attributes.title', 'pt-BR')));
    expect(attributes.match(/<dt class="body label/g)!.length).toBeGreaterThanOrEqual(6);
    expect(body).toContain(t('attr.finishing', 'pt-BR'));
    expect(body).toContain(t(`trait.${striker.trait}`, 'pt-BR'));
    expect(body).toContain(t('player.season.games', 'pt-BR'));
    expect(body).toContain(t('player.season.goals', 'pt-BR'));
    expect(body).toContain(t('player.condition', 'pt-BR'));
    // The avatar is drawn by code: an svg with no text and no image.
    const avatar = /<span class="avatar xl[^"]*">(.*?)<\/span>/s.exec(body)![1]!;
    expect(avatar).toContain('<svg');
    expect(avatar).not.toMatch(/<text|<image/);
    // "Anterior" and "Próximo" in the fixed foot, no primary.
    expect(body).toContain('>Anterior<');
    expect(body).toContain('>Próximo<');
    expect(primaries(body)).toBe(0);
  });

  it('the first has "Anterior" disabled and the last "Próximo"', () => {
    const disabled = (body: string) =>
      [...body.matchAll(/<button[^>]*?(disabled)?[^>]*>(?:(?!<\/button>).)*?(Anterior|Próximo)/gs)]
        .filter((m) => m[0].includes('disabled'))
        .map((m) => m[2]);
    expect(disabled(sheet(round5, striker.id, { hasPrev: false }))).toEqual(['Anterior']);
    expect(disabled(sheet(round5, striker.id, { hasNext: false }))).toEqual(['Próximo']);
    expect(disabled(sheet(round5, striker.id))).toEqual([]);
  });

  it('Realismo simplificado: no condition line', () => {
    const simplified = testCareer('simplified', 5);
    const id = squadPlayers(simplified, TEST_CLUB)[0]!.id;
    const body = sheet(simplified, id);
    expect(body).not.toContain(`>${t('player.condition', 'pt-BR')}<`);
    expect(body).toContain(t('player.morale', 'pt-BR'));
  });

  it('a stale id shows the ErrorState inside the sheet, which keeps its close button', () => {
    const body = sheet(round5, 'nobody');
    expect(body).toContain(shown(t('player.error.title', 'pt-BR')));
    expect(body).toContain(shown(t('player.error.body', 'pt-BR')));
    expect(body).toContain(`aria-label="${t('nav.close', 'pt-BR')}"`);
  });

  it('a card that fails to build shows the ErrorState inside the sheet (jogador.md, "Erro")', () => {
    const { finishing, ...rest } = striker.attributes;
    expect(finishing).toBeDefined();
    const broken = withPlayer(round5, striker.id, { attributes: rest });
    const body = sheet(broken, striker.id);
    expect(body).toContain('error block');
    expect(body).toContain(shown(t('player.error.title', 'pt-BR')));
    expect(body).toContain(`aria-label="${t('nav.close', 'pt-BR')}"`);
    expect(body).not.toContain('class="card');
    // "Anterior" and "Próximo" have nothing to move from.
    expect(body.match(/<button[^>]*disabled/g)).toHaveLength(2);
  });

  it('a nickname titles the card and the full name sits once under it', () => {
    const nick = withPlayer(round5, striker.id, {
      name: { ...striker.name, display: 'Paçoca', full: 'Lenon Pinheiro Souza' },
    });
    const body = sheet(nick, striker.id);
    expect(body).toContain('>Paçoca</h2>');
    expect(body.match(/Lenon Pinheiro Souza/g)).toHaveLength(1);
    expect(body).toMatch(/<p class="caption muted[^"]*">Lenon Pinheiro Souza<\/p>/);
  });

  it.each([
    ['Valmir Serrano', 'VALMIR SERRANO'],
    ['Valmír Serrano', 'Valmir Serrano'],
    ['Jean-Pierre', 'Jean Pierre'],
  ])(
    'no second line when the full name is the display (%s, %s), accents, case and hyphens aside',
    (display, fullName) => {
      const same = withPlayer(round5, striker.id, {
        name: { ...striker.name, display, full: fullName },
      });
      const body = sheet(same, striker.id);
      expect(body).toContain(`>${shown(display)}</h2>`);
      expect(body).not.toContain(`>${shown(fullName)}</p>`);
    },
  );

  it('the potential never reaches the HTML: a sentinel value shows nowhere (US-016)', () => {
    const SENTINEL = 4242;
    const game = withPlayer(round5, striker.id, { potential: SENTINEL });
    expect(game.players[striker.id]!.potential).toBe(SENTINEL);
    const row = squadView(game);
    const card = sheet(game, striker.id);
    // Control: the player is on both.
    expect(row).toContain(shown(striker.name.display));
    expect(card).toContain(shown(striker.name.display));
    expect(row).not.toContain(String(SENTINEL));
    expect(card).not.toContain(String(SENTINEL));
  });

  it('closed: an empty sheet', () => {
    const body = sheet(round5, undefined);
    expect(body).toContain('<dialog');
    expect(body).not.toContain('class="card');
  });
});
