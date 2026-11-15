<script lang="ts">
  import Crest from './Crest.svelte';
  import StatusBadge, { type StatusBadgeItem } from './StatusBadge.svelte';
  import type { MatchSide } from './MatchCard.svelte';

  /** The live line of the board during the match (T-032; proposal 37), texts already made. */
  export interface ScoreboardLive {
    /** "45+2'". */
    minute: string;
    /** "minuto 45 mais 2 de acréscimo". */
    minuteA11y: string;
    /** "1º tempo". */
    phase: string;
    /** "Pausada", beside the phase, only while the match is paused. */
    paused?: string;
  }

  /**
   * Scoreboard (Placar; design-system.md, "Placar (Scoreboard)"): home on the left, away on the
   * right, each with crest and short name, the goals in the middle with the separator of the
   * content, and the result badge (the whole word) under the goals. `surface-1`, `ink`; no result
   * colour on the board itself. `lg` (crest 48px, goals in `placar-xl`) on the round summary,
   * `md` (crest 32px, goals in `display-lg`) on the match report and, for `lg`, under
   * `breakpoint-short`. Names break into up to two lines, never cut. Nothing moves.
   *
   * With `a11yLabel` the board is a group with that name and its visible parts are hidden from
   * screen readers. With `hidden` the row (crests, names, goals and badge) is hidden, when another
   * element already says the result (the summary's heading); the `meta` line above it (venue and
   * stadium) is still read, since nothing else says it.
   *
   * Live (T-032; design-system.md, "Placar", proposal 37): `live` takes the place of the badge
   * under the goals (never both): the minute in `numero`, the phase in `caption` and, paused, the
   * word "Pausada" in `body-strong` (the text is the cue, no new colour). It is read after the
   * group's name. `announcement` is the last sentence for screen readers, in a hidden region
   * `aria-live="polite"` that is always there while live; the minute is never announced.
   */
  interface Props {
    home: MatchSide;
    away: MatchSide;
    /** The separator between the goals (match.score.versus), never read. */
    versus: string;
    /** The coach's side: its name in `body-strong`, the other in `body`. */
    mine?: 'home' | 'away';
    /** The line above, in `caption` ("Em casa · Estádio ..."). */
    meta?: string;
    /** The result badge, with the whole word, under the goals. */
    badge?: StatusBadgeItem;
    size?: 'lg' | 'md';
    a11yLabel?: string;
    hidden?: boolean;
    live?: ScoreboardLive;
    announcement?: string;
    /** Instance suffix for the crests (the same club twice on a page). */
    instance?: string;
  }
  const {
    home,
    away,
    versus,
    mine,
    meta,
    badge,
    size = 'lg',
    a11yLabel,
    hidden = false,
    live,
    announcement,
    instance,
  }: Props = $props();
  /** A group named by `a11yLabel` (not with `hidden`, which leaves the meta line to be read). */
  const named = $derived(a11yLabel !== undefined && !hidden);
  const metaHidden = $derived(named ? 'true' : undefined);
  const rowHidden = $derived(named || hidden ? 'true' : undefined);
</script>

{#snippet side(team: MatchSide, which: 'home' | 'away')}
  <div class="side {which}">
    <Crest
      club={team.club}
      size={size === 'lg' ? 'md' : 'sm'}
      instance={instance ? `${instance}-${which}` : undefined}
    />
    <span class="name {mine === which ? 'body-strong' : 'body'}">{team.name}</span>
  </div>
{/snippet}

<div
  class="scoreboard {size}"
  role={named ? 'group' : undefined}
  aria-label={named ? a11yLabel : undefined}
>
  {#if meta}<p class="caption meta" aria-hidden={metaHidden}>{meta}</p>{/if}
  <div class="row" aria-hidden={rowHidden}>
    {@render side(home, 'home')}
    <div class="center">
      <p class="score {size === 'lg' ? 'placar-xl' : 'display-lg'}">
        <span class="goals" data-side="home">{home.goals ?? ''}</span>
        <span class="versus" aria-hidden="true">{versus}</span>
        <span class="goals" data-side="away">{away.goals ?? ''}</span>
      </p>
      {#if live}
        <p class="live">
          <span class="numero minute">{live.minute}</span>
          <span class="caption phase">{live.phase}</span>
          {#if live.paused}<span class="body-strong paused">{live.paused}</span>{/if}
        </p>
      {:else if badge}<StatusBadge {...badge} />{/if}
    </div>
    {@render side(away, 'away')}
  </div>
  {#if live}
    {#if named}
      <!-- The live line as read, after the group's name: the visible one is in the hidden row. -->
      <p class="visually-hidden">
        {[live.minuteA11y, live.phase, live.paused].filter(Boolean).join(', ')}
      </p>
    {/if}
    <p class="visually-hidden" aria-live="polite" aria-atomic="true">{announcement ?? ''}</p>
  {/if}
</div>

<style>
  .scoreboard {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    color: var(--ink);
  }
  p {
    margin: 0;
  }
  .meta {
    color: var(--ink-muted);
    text-align: center;
  }
  /* Three columns: side, goals, side. The sides share what the goals leave. */
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: start;
    gap: var(--space-2);
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    text-align: center;
  }
  .name {
    max-width: 100%;
    /* Two lines at most, broken at a hyphen or a space; a word longer than the column breaks
       anywhere only as a last resort (componentes.md: never an ellipsis). */
    overflow-wrap: break-word;
    hyphens: manual;
  }
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .score {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .live {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: baseline;
    column-gap: var(--space-2);
    font-variant-numeric: tabular-nums;
  }
  .phase {
    color: var(--ink-muted);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .lg .side :global(svg) {
    width: var(--size-medallion-md);
    height: auto;
  }
  .md .side :global(svg) {
    width: var(--size-medallion-sm);
    height: auto;
  }
  /* breakpoint-short (design-system.md, "Altura baixa"): a phone lying down draws the `lg` board
     as the `md` one. A CSS variable cannot sit in @media, so the 480px is written here. */
  @media (max-height: 480px) {
    .lg .side :global(svg) {
      width: var(--size-medallion-sm);
    }
    .lg .score {
      font: var(--type-display-lg);
      font-variant-numeric: tabular-nums;
    }
    .lg .row {
      align-items: center;
    }
  }
</style>
