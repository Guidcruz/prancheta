<script lang="ts">
  import { onMount } from 'svelte';
  import type { ClubId, GameState } from '@engine';
  import type { Lang } from '@lib/config';
  import { t } from '@lib/i18n';
  import MatchCard from '../components/MatchCard.svelte';
  import { calendarHalves, calendarScroll, cardView, clubCalendar, listTarget } from '../calendar';
  import { shortNameOf } from '../round';

  /**
   * The Calendário tab (docs/design/telas/calendario.md; US-024): the 38 rounds of the coach's
   * club in two halves, one MatchCard per round, the same card as the Clube's next match (CEO
   * decision 3). A played round is a button that opens the Rodada subscreen (`onopen`); a round
   * still to play is only to read, and the next one carries the "Próximo jogo" highlight. The tab
   * opens with the card of the next round in the middle of the area between the header and "Jogar
   * rodada", or, back from a Rodada (`origin`), with the card of that round in sight and focused
   * (CEO decision 4; no floating shortcut). Jumps, never animates. Server-renderable: the props
   * are the whole input; the reads never throw, so an error here is a bug, for the frame's
   * boundary.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    /** The round the player came back from (the Rodada): its card is shown and focused. */
    origin?: number;
    onopen: (round: number) => void;
  }
  const { lang, game, clubId, origin, onopen }: Props = $props();

  const halves = $derived(calendarHalves(clubCalendar(game, clubId)));
  const name = (id: ClubId) => shortNameOf(game, id);
  const uid = $props.id();

  let root: HTMLElement | undefined = $state();

  /** The top of the floating "Jogar rodada" in the window, or its height (desktop: no button). */
  function viewBottom(): number {
    for (const button of document.querySelectorAll<HTMLElement>('button.play.float')) {
      if (button.getClientRects().length > 0) return button.getBoundingClientRect().top;
    }
    return window.innerHeight;
  }

  onMount(() => {
    const round = listTarget(game, origin);
    const item = root?.querySelector<HTMLElement>(`li[data-round="${round}"]`);
    if (item === undefined || item === null) return;
    // The tab opens at the top (it may come from a scrolled tab), then jumps to the card.
    window.scrollTo({ top: 0, behavior: 'instant' });
    const box = item.getBoundingClientRect();
    const header = document.querySelector<HTMLElement>('header.header');
    const top = calendarScroll({
      rowTop: box.top,
      rowBottom: box.bottom,
      headerBottom: header === null ? 0 : header.getBoundingClientRect().bottom,
      viewBottom: viewBottom(),
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    });
    if (top > 0) window.scrollTo({ top, behavior: 'instant' });
    // Back from a Rodada: the focus on the card it was opened from.
    if (origin !== undefined)
      item.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  });
</script>

<div class="calendar" bind:this={root}>
  {#each ['first', 'second'] as const as half (half)}
    <section class="half" aria-labelledby="{uid}-{half}">
      <h2 class="subtitulo" id="{uid}-{half}">{t(`calendar.half.${half}`, lang)}</h2>
      <div class="cards-wrap">
        <ol class="cards">
          {#each halves[half] as entry (entry.fixture.id)}
            {@const fixture = entry.fixture}
            {@const view = cardView(game, entry, lang)}
            <li data-round={entry.round} data-fixture={fixture.id}>
              <MatchCard
                home={{
                  club: game.clubs[fixture.homeId]!.def,
                  name: name(fixture.homeId),
                  goals: view.homeGoals,
                }}
                away={{
                  club: game.clubs[fixture.awayId]!.def,
                  name: name(fixture.awayId),
                  goals: view.awayGoals,
                }}
                meta={view.meta}
                venueLabel={view.venueLabel}
                mine={entry.venue}
                badges={view.badges}
                note={view.note}
                highlight={view.highlight}
                onclick={view.a11yLabel === undefined ? undefined : () => onopen(entry.round)}
                a11yLabel={view.a11yLabel}
                instance={`calendar-${entry.round}`}
              />
            </li>
          {/each}
        </ol>
      </div>
    </section>
  {/each}
</div>

<style>
  .calendar {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding-block: var(--space-4);
  }
  .half {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  h2 {
    margin: 0;
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
     colunas"), in the order of the round: a phone lying down, the desktop. A CSS variable cannot
     sit in @container. */
  @container (min-width: 480px) {
    .cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
