<script lang="ts">
  import type { ShieldClub } from '@lib/generators/shield';
  import Button from './Button.svelte';
  import Crest from './Crest.svelte';
  import Icon from './Icon.svelte';

  /**
   * CareerCard: a career saved on the device (docs/design/telas/inicio.md, saves.md).
   * - `featured`: the most recent career on the home screen, with "Continuar" as the screen's
   *   primary button.
   * - `row`: the others; the whole row continues the career (one target, at least 44px), and the
   *   "more" button beside it opens the career's actions (delete; export with T-020).
   * Every text arrives translated; the dates and the progress line are formatted by the screen.
   */
  interface Props {
    variant?: 'featured' | 'row';
    /** The club as frozen in the save (`CareerSummary.club`). */
    club: ShieldClub;
    /** The club's short name, as written on the card. */
    clubName: string;
    /** "Temporada 1 · próxima rodada: 12" (career.progress / career.seasonOver). */
    progress: string;
    /** "Jogada em 7 de nov." (home.career.lastPlayed). */
    lastPlayed: string;
    /** A short status in text ("Atual", "Versão mais nova"...), shown as a badge. */
    badge?: string;
    badgeTone?: 'neutral' | 'warning' | 'danger';
    /** A line under the card explaining a problem with the save (text, never only colour). */
    notice?: string;
    /** Label of the continue button (`featured`): "Continuar" or the problem's own action. */
    continueLabel: string;
    /** Accessible name of the whole row (`row`): "Continuar a carreira do Flamingo". */
    continueA11yLabel?: string;
    /** Opening this career right now. */
    busy?: boolean;
    busyLabel?: string;
    /** No continue action at all (e.g. storage unavailable): the card only informs. */
    disabled?: boolean;
    oncontinue?: () => void;
    /** Accessible name of the "more" button: "Mais ações da carreira do Flamingo". */
    actionsLabel?: string;
    /** Without it there is no "more" button. */
    onactions?: () => void;
  }
  const {
    variant = 'row',
    club,
    clubName,
    progress,
    lastPlayed,
    badge,
    badgeTone = 'neutral',
    notice,
    continueLabel,
    continueA11yLabel,
    busy = false,
    busyLabel,
    disabled = false,
    oncontinue,
    actionsLabel,
    onactions,
  }: Props = $props();
  const noticeId = $props.id();
</script>

{#snippet moreButton()}
  {#if onactions}
    <button type="button" class="more" aria-label={actionsLabel} onclick={onactions}>
      <Icon name="more" />
    </button>
  {/if}
{/snippet}

{#snippet badgeChip(id?: string)}
  {#if badge}
    <span class="badge rotulo {badgeTone}" {id}>
      {#if badgeTone !== 'neutral'}<Icon name="warning" size={14} />{/if}
      {badge}
    </span>
  {/if}
{/snippet}

{#snippet rowContent()}
  <Crest {club} size="md" />
  <span class="text">
    <span class="body-strong name">{clubName}</span>
    <span class="body progress" id="{noticeId}-progress">{progress}</span>
    <span class="caption muted" id="{noticeId}-last">{lastPlayed}</span>
    <!-- Under the text, so a long badge never squeezes the line at 360px. -->
    {@render badgeChip(`${noticeId}-badge`)}
  </span>
  {#if !disabled}
    <span class="chev"><Icon name="chevron-right" size={20} /></span>
  {/if}
{/snippet}

<article class="card {variant}">
  {#if variant === 'featured'}
    <div class="top">
      <Crest {club} size="lg" />
      <div class="text">
        <h3 class="subtitulo name">{clubName}</h3>
        <p class="body progress">{progress}</p>
        <p class="caption muted">{lastPlayed}</p>
      </div>
      {@render moreButton()}
    </div>
    {@render badgeChip()}
    {#if notice}
      <p class="body notice" id={noticeId}><Icon name="warning" size={18} />{notice}</p>
    {/if}
    {#if !disabled}
      <div class="go">
        <Button variant="primary" fullWidth {busy} {busyLabel} icon="play" onclick={oncontinue}
          >{continueLabel}</Button
        >
      </div>
    {/if}
  {:else}
    <div class="line">
      {#if disabled}
        <!-- Nothing to open from here (Carreiras e backup): plain content, not a disabled button. -->
        <div class="hit static">{@render rowContent()}</div>
      {:else}
        <!-- The name is the action; the lines of the card describe it (season, round, date, badge). -->
        <button
          type="button"
          class="hit"
          aria-label={continueA11yLabel}
          aria-describedby={[
            `${noticeId}-progress`,
            `${noticeId}-last`,
            badge && `${noticeId}-badge`,
            notice && noticeId,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-busy={busy || undefined}
          onclick={busy ? undefined : oncontinue}
        >
          {@render rowContent()}
        </button>
      {/if}
      {@render moreButton()}
    </div>
    {#if notice}
      <p class="body notice" id={noticeId}><Icon name="warning" size={18} />{notice}</p>
    {/if}
  {/if}
</article>

<style>
  .card {
    background: var(--surface-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-card);
    color: var(--ink);
  }
  .featured {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    /* The most recent career: a grass edge on top, decorative (the order already says it). */
    border-top: 3px solid var(--grass);
  }
  .top {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
  }
  .text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  h3,
  p {
    margin: 0;
  }
  .name {
    overflow-wrap: anywhere;
  }
  .progress {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--ink-muted);
  }
  .line {
    display: flex;
    align-items: center;
  }
  .hit {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: 1;
    min-width: 0;
    min-height: var(--touch);
    padding: var(--space-3) var(--space-2) var(--space-3) var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .hit:hover:not(.static) {
    background: var(--surface-2);
  }
  .hit.static {
    cursor: default;
  }
  .hit[aria-busy='true'] {
    cursor: progress;
  }
  .chev {
    display: flex;
    color: var(--ink-muted);
  }
  .more {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--touch);
    height: var(--touch);
    flex: none;
    padding: 0;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--ink);
    cursor: pointer;
  }
  .row .more {
    margin-right: var(--space-1);
  }
  .more:hover {
    background: var(--surface-2);
  }
  .text .badge {
    margin-top: var(--space-1);
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    align-self: flex-start;
    flex: none;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--ink);
  }
  .badge.warning {
    background: var(--floodlight);
    color: var(--on-floodlight);
  }
  .badge.danger {
    background: var(--danger-soft);
    color: var(--ink);
  }
  .notice {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
    color: var(--ink);
  }
  .notice :global(svg) {
    margin-top: var(--space-1);
    color: var(--danger);
  }
  .row .notice {
    padding: 0 var(--space-4) var(--space-3);
  }
  /* Desktop breakpoint (docs/02-architecture.md, 3). No token yet: componentes.md, proposal 1. */
  @media (min-width: 900px) {
    .go {
      display: flex;
      justify-content: flex-end;
    }
    .go :global(.btn) {
      width: auto;
      min-width: calc(var(--touch) * 5);
    }
  }
</style>
