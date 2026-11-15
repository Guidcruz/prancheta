<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { ClubId, FixtureId, GameState, MatchSheet } from '@engine';
  import type { Lang } from '@lib/config';
  import { t } from '@lib/i18n';
  import MatchCard from '../components/MatchCard.svelte';
  import { roundMatches } from '../calendar';
  import { matchDate } from '../club';
  import { isDerby, otherCardLabel, shortNameOf } from '../round';
  import { pushSheet, sheetField, sheetOnTop } from '../sheet-history';
  import MatchReport from './MatchReport.svelte';

  /**
   * The Rodada subscreen of the Calendário (docs/design/telas/calendario.md, "Conteúdo da
   * Rodada"; US-024, US-019): the date of a round already played and its ten matches, the coach's
   * first and the other nine in the order of the calendar (CEO decision 5), all with the same
   * form: names and goals, the "Clássico" badge and the note of a match ended early. Each card is
   * a button that opens the match report of T-083 over the subscreen, with the same history as in
   * the round summary (`pushSheet`): back closes it and stays here, forward to its entry opens it
   * again, and closing it gives the focus back to the card that opened it. The goals' scorers are
   * in the report, one tap away (CEO decision 2). The frame draws the header (back, "Rodada 5",
   * "Mais") and checks the round is played before showing this; on mount the focus goes to that
   * title. Server-renderable: the props are the whole input.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    round: number;
    /** The stored match sheets of the season (`career.matchSheets`), for the match report. */
    sheets?: Readonly<Record<FixtureId, MatchSheet>>;
    /** The id of the frame's title (`h1`), which takes the focus on mount and names the list. */
    titleId: string;
    /** Logs a match report that failed to build (lib/errors, without personal data). */
    onerror?: (error: unknown) => void;
  }
  const { lang, game, clubId, round, sheets = {}, titleId, onerror }: Props = $props();

  // The frame shows the Rodada only for a round played (`roundFromAddress`): none is a bug.
  const matches = $derived.by(() => {
    const read = roundMatches(game, clubId, round);
    if (read === undefined) throw new Error(`round ${round} is not played`);
    return read;
  });
  const name = (id: ClubId) => shortNameOf(game, id);
  const mineOf = (homeId: ClubId, awayId: ClubId): 'home' | 'away' | undefined =>
    homeId === clubId ? 'home' : awayId === clubId ? 'away' : undefined;

  // ---------------------------------------------------------- the match report (T-083; US-019)

  const REPORT = 'report';
  let root: HTMLElement | undefined = $state();
  /** The match whose report is open; `undefined`: closed. */
  let reportId: FixtureId | undefined = $state();
  /** `history.back()` was asked and its popstate has not come yet: a second close waits. */
  let closingReport = false;

  function openReport(id: FixtureId): void {
    if (reportId !== undefined) return;
    pushSheet(REPORT, { fixture: id });
    reportId = id;
  }

  async function reportClosed(): Promise<void> {
    const id = reportId;
    reportId = undefined;
    await tick();
    // Always to the card that opened it: the native dialog gives the focus back to whatever had
    // it, and a report opened by forward had none.
    if (id !== undefined) {
      root?.querySelector<HTMLElement>(`li[data-fixture="${CSS.escape(id)}"] button`)?.focus();
    }
  }

  function closeReport(): void {
    // A double tap on the X: the first back is on its way; a second one would leave the Rodada.
    if (closingReport) return;
    // Back removes the sheet's entry; the popstate then closes the sheet.
    if (sheetOnTop(REPORT)) {
      closingReport = true;
      history.back();
    } else void reportClosed();
  }

  onMount(() => {
    // Entering the subscreen: the focus on its title, as on every change of screen.
    document.getElementById(titleId)?.focus();
    // Mounted on the report's entry (forward to it, or "Tentar de novo" of the boundary).
    reportId = sheetField(REPORT, 'fixture');
    const onPop = () => {
      closingReport = false;
      const id = sheetField(REPORT, 'fixture');
      if (id === undefined) {
        if (reportId !== undefined) void reportClosed();
      } else if (id !== reportId) {
        // Forward to the report's entry: it opens again on its match.
        reportId = id;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
</script>

<div class="calendar-round" data-round={round} bind:this={root}>
  <p class="caption date">{matchDate(matches[0]!.date, lang)}</p>
  <div class="cards-wrap">
    <ul class="cards" aria-labelledby={titleId}>
      {#each matches as match (match.id)}
        <li data-fixture={match.id}>
          <MatchCard
            home={{
              club: game.clubs[match.homeId]!.def,
              name: name(match.homeId),
              goals: match.result.score[0],
            }}
            away={{
              club: game.clubs[match.awayId]!.def,
              name: name(match.awayId),
              goals: match.result.score[1],
            }}
            mine={mineOf(match.homeId, match.awayId)}
            badges={isDerby(game, match) ? [{ kind: 'derby', label: t('match.derby', lang) }] : []}
            note={match.result.abandoned ? t('match.abandoned.short', lang) : undefined}
            onclick={() => openReport(match.id)}
            a11yLabel={otherCardLabel(game, match, lang)}
            instance={`calendar-round-${match.id}`}
          />
        </li>
      {/each}
    </ul>
  </div>
</div>

<MatchReport
  {lang}
  {game}
  {clubId}
  fixtureId={reportId}
  sheet={reportId === undefined ? undefined : sheets[reportId]}
  onclose={closeReport}
  {onerror}
/>

<style>
  .calendar-round {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-block: var(--space-2) var(--space-4);
  }
  .date {
    margin: 0;
    color: var(--ink-muted);
  }
  .cards-wrap {
    container-type: inline-size;
  }
  .cards {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* Two columns once the list has 480px (breakpoint-card, design-system.md, "Card em duas
     colunas"): a phone lying down, the desktop. A CSS variable cannot sit in @container. */
  @container (min-width: 480px) {
    .cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
