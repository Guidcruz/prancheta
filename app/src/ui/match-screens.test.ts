import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { LiveMatch } from '@lib/career';
import type { Lang } from '@lib/config';
import { t } from '@lib/i18n';
import Button from './components/Button.svelte';
import CommentaryFeed from './components/CommentaryFeed.svelte';
import PlayRoundButton from './components/PlayRoundButton.svelte';
import Scoreboard from './components/Scoreboard.svelte';
import { isMatchHash, playModeOptions, storedOutcome, watchModeOf } from './match-flow';
import MatchScreen from './screens/MatchScreen.svelte';
import { TEST_CLUB } from './testing/game';
import { testMatches } from './testing/matches';

/*
 * The narrated match of T-032 (partida.md; componentes.md, "Casca da T-032 e da T-085") rendered
 * on the server: the screen at the kick-off in both modes and three languages, with no raw key,
 * no primary while the ball rolls and the three controls; the split "Jogar rodada"; the compact and
 * pressed Button; the live Scoreboard; the CommentaryFeed. The clock, the pause, Pular, the back
 * gesture, widths and motion are for the Vitest of ui/match/ and for the E2E
 * (tests/e2e/match.spec.ts).
 */

const LANGS: readonly Lang[] = ['pt-BR', 'es', 'en'];
const shown = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const RAW_KEY = /(?:^|[>\s"'])(?:round|match|play|report|newGame)\.[A-Za-z][\w.-]*(?=[<\s"'])/;
function expectNoRawKey(body: string, label: string): void {
  const text = body
    .replace(/<svg.*?<\/svg>/gs, '')
    .replace(/<style.*?<\/style>/gs, '')
    .replace(/(?:class|href|id|style|for|name|value|data-[a-z]+)="[^"]*"/g, '');
  expect(text.match(RAW_KEY)?.[0], `${label}: raw key on screen`).toBeUndefined();
  expect(text, `${label}: unfilled {placeholder}`).not.toMatch(/\{[a-z]+\}/i);
}
const noop = () => undefined;
const primaries = (body: string) => (body.match(/class="btn botao primary/g) ?? []).length;

const mine = testMatches().find(
  (m) => m.match.home.clubId === TEST_CLUB || m.match.away.clubId === TEST_CLUB,
)!;
const live: LiveMatch = {
  fixtureId: mine.match.fixtureId,
  side: mine.match.home.clubId === TEST_CLUB ? 'home' : 'away',
  match: mine.match,
  result: mine.result,
};

function screen(lang: Lang = 'pt-BR', mode: 'full' | 'highlights' = 'highlights'): string {
  return render(MatchScreen, {
    props: {
      lang,
      game: mine.game,
      live,
      mode,
      speed: 'normal',
      onspeed: noop,
      onfinish: () => Promise.resolve('saved' as const),
      onsummary: noop,
      onleave: noop,
    },
  }).body;
}

describe('the match screen at the kick-off (partida.md, "Conteúdo")', () => {
  for (const lang of LANGS) {
    it(`${lang}: the round as the heading, the board at 0 × 0 and 0', the kick-off line, the bar`, () => {
      const body = screen(lang);
      expect(body).toContain(`<main class="match`);
      expect(body).toContain(shown(t('round.title', lang, { round: 1 })));
      expect(body).toMatch(/<h1[^>]*id="match-title"/);
      expect(body).toContain(shown(t('match.live.kickoff', lang)));
      expect(body).toContain(shown(t('match.phase.first', lang)));
      expect(body).toContain(`>0'</span>`);
      expect(body).toContain(shown(t('match.pause', lang)));
      expect(body).toContain(shown(t('match.fast', lang)));
      expect(body).toContain(shown(t('match.skip', lang)));
      expect(body).toContain('aria-pressed="false"');
      expect(body).toContain('aria-live="polite"');
      expect(body).toContain(
        shown(
          t('match.score.a11y', lang, {
            home: mine.game.clubs[mine.match.home.clubId]!.def.shortName,
            homeGoals: 0,
            away: mine.game.clubs[mine.match.away.clubId]!.def.shortName,
            awayGoals: 0,
          }),
        ),
      );
      // No primary while the ball rolls; "Pausada" only reserved (hidden) before a pause, never read
      // and never in the place of the phase; no navigation.
      expect(primaries(body.split('<dialog')[0]!)).toBe(0);
      expect(body).toMatch(/class="[^"]*\bpaused\b[^"]*\boff\b/);
      expect(body).not.toMatch(/class="[^"]*\bphase\b[^"]*\boff\b/);
      expect(body).not.toContain(`, ${shown(t('match.paused', lang))}<`);
      expect(body).not.toContain('<nav');
      expectNoRawKey(body, lang);
    });
  }

  it('both modes start the same; the sheet "Sair da partida?" is closed', () => {
    for (const mode of ['full', 'highlights'] as const) {
      const body = screen('pt-BR', mode);
      expect(body).toContain(`data-mode="${mode}"`);
      expect(body).toContain(shown(t('match.leave.title', 'pt-BR')));
      expect(body).not.toMatch(/<dialog[^>]* open/);
    }
  });
});

describe('the split "Jogar rodada" (proposal 33)', () => {
  const mode = { label: 'Só resultado', a11yLabel: 'Mudar o tipo de partida', onopen: noop };

  it('ready: the label is the name, the mode below describes it, the segment opens a dialog', () => {
    const body = render(PlayRoundButton, { props: { label: 'Jogar rodada', mode } }).body;
    expect(body).toMatch(/<div class="split float ready/);
    expect(body).toMatch(/class="play float ready[^"]*joined/);
    expect(body).toContain('aria-label="Jogar rodada"');
    expect(body).toMatch(/aria-describedby="[^"]+"/);
    expect(body).toContain('>Só resultado<');
    expect(body).toContain('aria-haspopup="dialog"');
    expect(body).toContain('aria-label="Mudar o tipo de partida"');
  });

  it('blocked: the reason takes the place of the mode; busy: the segment goes away', () => {
    const blocked = render(PlayRoundButton, {
      props: { label: 'Jogar rodada', state: 'blocked', hint: 'Escalação incompleta', mode },
    }).body;
    expect(blocked).toContain('>Escalação incompleta<');
    expect(blocked).not.toContain('>Só resultado<');
    expect(blocked).toContain('aria-haspopup="dialog"');
    const busy = render(PlayRoundButton, {
      props: { label: 'Jogar rodada', state: 'busy', busyLabel: 'Calculando', mode },
    }).body;
    expect(busy).not.toContain('aria-haspopup');
    expect(busy).not.toContain('class="split');
    // Without a mode, the button of T-023, unchanged.
    const plain = render(PlayRoundButton, { props: { label: 'Jogar rodada' } }).body;
    expect(plain).not.toContain('split');
    expect(plain).not.toContain('aria-label=');
  });
});

describe('Button compact and pressed (proposal 38)', () => {
  it('compact keeps the height; pressed says aria-pressed; minWidth is the width given', () => {
    const on = render(Button, {
      props: { compact: true, pressed: true, children: (() => 'Rápido') as never },
    }).body;
    expect(on).toMatch(/class="btn botao secondary[^"]*compact[^"]*on/);
    expect(on).toContain('aria-pressed="true"');
    const off = render(Button, { props: { pressed: false, children: (() => 'x') as never } }).body;
    expect(off).toContain('aria-pressed="false"');
    expect(off).not.toMatch(/class="[^"]*\bon\b/);
    const plain = render(Button, { props: { children: (() => 'x') as never } }).body;
    expect(plain).not.toContain('aria-pressed');
    const wide = render(Button, { props: { minWidth: 118, children: (() => 'x') as never } }).body;
    expect(wide).toContain('min-width: 118px');
  });
});

describe('the live Scoreboard (proposal 37)', () => {
  const side = (goals: number) => ({ club: mine.game.clubs[TEST_CLUB]!.def, name: 'Leões', goals });

  it('the live line in place of the badge, read after the group; the hidden live region', () => {
    const body = render(Scoreboard, {
      props: {
        home: side(1),
        away: side(0),
        versus: '×',
        size: 'md',
        a11yLabel: 'Placar: Leões 1, Leões 0',
        badge: { kind: 'win', label: 'Vitória' },
        live: {
          minute: "45+2'",
          minuteA11y: 'minuto 45 mais 2',
          phase: '1º tempo',
          pausedText: 'Pausada',
          paused: true,
        },
        announcement: 'Gol de Leões',
      },
    }).body;
    expect(body).toContain(`>45+2'</span>`);
    expect(body).toContain('>Pausada<');
    expect(body).toMatch(/\bphase\b[^"]*\boff\b[^>]*>1º tempo</);
    expect(body).not.toContain('Vitória');
    expect(body).toContain('minuto 45 mais 2, 1º tempo, Pausada');
    expect(body).toMatch(/aria-live="polite" aria-atomic="true">Gol de Leões</);
  });

  it('running, the word stays in the layout, hidden and unread; the phase shows', () => {
    const body = render(Scoreboard, {
      props: {
        home: side(0),
        away: side(0),
        versus: '×',
        size: 'md',
        a11yLabel: 'Placar',
        live: { minute: "23'", minuteA11y: 'minuto 23', phase: '1º tempo', pausedText: 'Pausada' },
      },
    }).body;
    expect(body).toMatch(/\bpaused\b[^"]*\boff\b[^>]*>Pausada</);
    expect(body).not.toMatch(/\bphase\b[^"]*\boff\b/);
    expect(body).toContain('minuto 23, 1º tempo<');
  });
});

describe('the CommentaryFeed', () => {
  it('the most recent first, the goal line, the phases with no club, one sentence per line', () => {
    const body = render(CommentaryFeed, {
      props: {
        title: 'Narração da partida',
        scroll: true,
        items: [
          {
            id: 'e5',
            minute: "23'",
            minuteA11y: 'minuto 23',
            tone: 'goal',
            kind: 'Gol',
            text: 'Fulano',
            note: 'pênalti',
            noteA11y: 'de pênalti',
            club: 'Leões',
            crest: mine.game.clubs[TEST_CLUB]!.def,
          },
          {
            id: 'e3',
            minute: "10'",
            minuteA11y: 'minuto 10',
            icon: 'card',
            tone: 'yellow',
            kind: 'Amarelo',
            text: 'Beltrano',
            club: 'Leões',
            crest: mine.game.clubs[TEST_CLUB]!.def,
          },
          { id: 'e0', minute: "0'", minuteA11y: 'minuto 0', tone: 'phase', kind: 'Rola a bola!' },
        ],
      },
    }).body;
    expect(body).toContain('<ol class="lines');
    expect(body).toContain('reversed');
    expect(body.indexOf('data-line="e5"')).toBeLessThan(body.indexOf('data-line="e0"'));
    expect(body).toMatch(/class="line goal/);
    // The club comes right after the minute; the crest is decorative; the phases have none.
    expect(body).toContain('minuto 23, Leões, Gol, Fulano, de pênalti<');
    expect(body).toContain('minuto 10, Leões, Amarelo, Beltrano<');
    expect(body).toContain('minuto 0, Rola a bola!<');
    expect(body.match(/class="crest xs[^"]*"[^>]*aria-hidden="true"/g)).toHaveLength(2);
    // The icon opens the text, inside the first line, not in a column of its own.
    expect(body).toMatch(/class="main[^"]*"[^>]*>(<!--[^>]*-->)*<span class="icon yellow/);
    expect(body).toContain('tabindex="0"');
    expect(body).not.toContain('aria-live');
  });
});

describe('the flow helpers (match-flow.ts)', () => {
  it('only #/match is the match; "Só resultado" never opens it', () => {
    expect(isMatchHash('#/match')).toBe(true);
    expect(isMatchHash('#match')).toBe(true);
    expect(isMatchHash('#/round')).toBe(false);
    expect(watchModeOf('result')).toBeUndefined();
    expect(watchModeOf('highlights')).toBe('highlights');
    expect(watchModeOf('full')).toBe('full');
  });

  it('a round stored before the failure is never played again (storedOutcome)', () => {
    const save = mine.game;
    const at = (round: number) => ({ save: { game: { ...save, round } } }) as never;
    // Still on the match's round: play it.
    expect(storedOutcome(5, at(5))).toBeUndefined();
    expect(storedOutcome(5, {})).toBeUndefined();
    // Past it: the round is applied, stored or with its write refused.
    expect(storedOutcome(5, at(6))).toBe('saved');
    expect(storedOutcome(5, { ...(at(6) as object), unsaved: 'quota-exceeded' } as never)).toBe(
      'unsaved',
    );
    // Round 38, the season over after it.
    expect(storedOutcome(38, at(39))).toBe('saved');
  });

  it('the sheet offers the three modes, "Animada completa" first, whatever the career’s mode (T-085)', () => {
    for (const mode of ['full', 'highlights', 'result'] as const) {
      expect(playModeOptions(mode, 'pt-BR').map((o) => o.value)).toEqual([
        'full',
        'highlights',
        'result',
      ]);
    }
    expect(playModeOptions('full', 'pt-BR').map((o) => o.value)).toEqual([
      'full',
      'highlights',
      'result',
    ]);
    expect(playModeOptions('highlights', 'es')[1]).toEqual({
      value: 'highlights',
      title: t('newGame.match.highlights', 'es'),
      description: t('newGame.match.highlights.body', 'es'),
    });
  });
});
