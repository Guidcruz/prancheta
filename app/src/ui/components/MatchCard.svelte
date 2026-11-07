<script lang="ts" module>
  import type { ShieldClub } from '@lib/generators/shield';

  export interface MatchSide {
    /** A ClubDef fits: only the crest fields are read. */
    club: ShieldClub;
    /** The short name, as in every list. */
    name: string;
    /** Goals, when the match was played. */
    goals?: number;
  }
</script>

<script lang="ts">
  import Crest from './Crest.svelte';
  import Icon from './Icon.svelte';
  import StatusBadge, { type StatusBadgeItem } from './StatusBadge.svelte';

  /**
   * MatchCard (CardPartida): one match, home on top and away below, the coach's club in bold.
   * Venue in text ("Em casa", "Fora"), never only by order; a derby carries the "Clássico" badge;
   * a played match of the coach's club carries the V/E/D badge. With `href` the whole card is one
   * link (to the Calendário, from the Clube screen), at least 44px tall.
   */
  interface Props {
    home: MatchSide;
    away: MatchSide;
    /** "Rodada 5 · dom., 10 de mai.", already translated and formatted. */
    meta: string;
    /** "Em casa" / "Fora de casa": the coach's venue, in text. */
    venueLabel?: string;
    /** Which side is the coach's club (bold, and the venue refers to it). */
    mine?: 'home' | 'away';
    /** The "Clássico" badge (kind `derby`), or a result badge (`win`, `draw`, `loss`). */
    badges?: readonly StatusBadgeItem[];
    href?: string;
    onclick?: (event: MouseEvent) => void;
    /** Accessible name of the link, when the visible text is not enough. */
    a11yLabel?: string;
    /** Instance suffix for the crests (the same club twice on a page). */
    instance?: string;
  }
  const {
    home,
    away,
    meta,
    venueLabel,
    mine,
    badges = [],
    href,
    onclick,
    a11yLabel,
    instance,
  }: Props = $props();
  const played = $derived(home.goals !== undefined && away.goals !== undefined);
</script>

{#snippet side(team: MatchSide, which: 'home' | 'away')}
  <span class="team" class:mine={mine === which}>
    <Crest club={team.club} size="sm" instance={instance ? `${instance}-${which}` : undefined} />
    <span class="name {mine === which ? 'body-strong' : 'body'}">{team.name}</span>
    {#if played}<span class="numero goals">{team.goals}</span>{/if}
  </span>
{/snippet}

{#snippet inner()}
  <span class="caption meta">{meta}</span>
  <span class="teams">
    {@render side(home, 'home')}
    {@render side(away, 'away')}
  </span>
  {#if venueLabel || badges.length > 0}
    <span class="foot">
      {#if venueLabel}<span class="body venue">{venueLabel}</span>{/if}
      {#each badges as badge (badge.kind)}
        <StatusBadge {...badge} />
      {/each}
    </span>
  {/if}
  {#if href}<span class="go"><Icon name="chevron-right" size={20} /></span>{/if}
{/snippet}

{#if href}
  <a class="match link" {href} {onclick} aria-label={a11yLabel}>{@render inner()}</a>
{:else}
  <div class="match">{@render inner()}</div>
{/if}

<style>
  .match {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: var(--touch);
    padding: var(--space-3);
    padding-inline-end: calc(var(--space-3) + var(--space-6));
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-2);
    color: var(--ink);
    text-decoration: none;
  }
  .link:hover {
    border-color: var(--ink-muted);
  }
  .meta,
  .venue {
    color: var(--ink-muted);
  }
  .teams {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .team {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .goals {
    font-variant-numeric: tabular-nums;
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .go {
    position: absolute;
    inset-inline-end: var(--space-3);
    inset-block-start: 50%;
    translate: 0 -50%;
    color: var(--ink-muted);
  }
</style>
