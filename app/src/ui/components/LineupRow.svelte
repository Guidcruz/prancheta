<script lang="ts">
  import Icon from './Icon.svelte';
  import StatusBadge, { type StatusBadgeItem } from './StatusBadge.svelte';
  import type { ChipState } from './LineupChip.svelte';

  /**
   * LineupRow: a player of the bench or of "Não relacionados" under the pitch (escalacao.md), or
   * an empty bench place. The whole row is one button, at least 44px: a tap picks the player or
   * receives the picked one, as on the pitch; the drag starts here too. Position code, name,
   * situation badges (icon plus text), and the numbers on the right in `tabular-nums` (Nota and,
   * in Realismo completo, Cond.). A refused move shows its reason under the row (`message`).
   */
  interface Props {
    /** "ATA"; for an empty bench place, nothing. */
    positionCode?: string;
    /** Built by the screen (`lineup.row.a11y` or `lineup.bench.emptyA11y`). */
    a11yLabel: string;
    /**
     * Absent: a free place ("Vaga no banco", "Deixar de fora"), shown with `emptyLabel`. A free
     * place only receives a player: it is never picked and has no `aria-pressed`.
     */
    name?: string;
    /** "Vaga no banco" (`lineup.bench.empty`). */
    emptyLabel?: string;
    badges?: readonly StatusBadgeItem[];
    /** The numbers, in the order of the group's column headers. */
    cells?: readonly number[];
    state?: ChipState;
    /** Reason of a refused move, shown under the row ("Lesionado: não pode ser escalado"). */
    message?: string;
    /** Index of the place for the drag's hit test (`data-place`, e.g. "bench-3", "out-2"). */
    place?: string;
    describedby?: string;
    onclick?: (event: MouseEvent) => void;
    onpointerdown?: (event: PointerEvent) => void;
  }
  const {
    positionCode,
    a11yLabel,
    name,
    emptyLabel,
    badges = [],
    cells = [],
    state = 'idle',
    message,
    place,
    describedby,
    onclick,
    onpointerdown,
  }: Props = $props();
  const id = $props.id();
  const empty = $derived(name === undefined);
</script>

<li class="item">
  <button
    type="button"
    class="row {state}"
    class:empty
    data-place={place}
    aria-label={a11yLabel}
    aria-pressed={empty ? undefined : state === 'selected'}
    aria-describedby={[message ? `${id}-m` : '', describedby ?? ''].join(' ').trim() || undefined}
    {onclick}
    {onpointerdown}
  >
    <span class="rotulo pos">{positionCode ?? ''}</span>
    <span class="main">
      <span class="body-strong name">{empty ? emptyLabel : name}</span>
      {#if badges.length > 0}
        <span class="badges">
          {#each badges as badge (badge.kind)}<StatusBadge {...badge} />{/each}
        </span>
      {/if}
    </span>
    {#each cells as cell, i (i)}<span class="numero cell">{cell}</span>{/each}
    <span class="tail" aria-hidden="true">
      {#if state === 'selected'}<Icon name="check" size={18} />{:else if state === 'target'}<Icon
          name="swap"
          size={18}
        />{/if}
    </span>
  </button>
  {#if message}
    <p class="caption message" id="{id}-m">
      <Icon name="warning" size={14} /><span>{message}</span>
    </p>
  {/if}
</li>

<style>
  .item {
    list-style: none;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    inline-size: 100%;
    min-block-size: var(--touch);
    padding: var(--space-1) var(--space-2);
    border: 2px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--ink);
    text-align: start;
    touch-action: manipulation;
    user-select: none;
    -webkit-touch-callout: none;
    cursor: pointer;
  }
  .row:hover {
    background: var(--surface-2);
  }
  .row:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .pos {
    display: inline-grid;
    place-items: center;
    flex: none;
    min-inline-size: calc(var(--space-8) + var(--space-1));
    padding: calc(var(--space-1) / 2) var(--space-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    color: var(--ink-muted);
  }
  .empty .pos {
    border-style: dashed;
  }
  .main {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: calc(var(--space-1) / 2);
    min-inline-size: 0;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty .name {
    color: var(--ink-muted);
    font-weight: inherit;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  /* Same width as the group's column headers (LineupGroup). */
  .cell {
    flex: none;
    inline-size: calc(var(--space-8) + var(--space-2));
    text-align: end;
  }
  .tail {
    display: grid;
    flex: none;
    place-items: center;
    inline-size: var(--space-6);
    color: var(--ink);
  }
  .selected {
    border-color: var(--floodlight);
    background: var(--surface-2);
  }
  .target {
    border-color: var(--grass);
    background: var(--grass-soft);
  }
  .target .pos {
    color: var(--ink);
  }
  .origin {
    border-color: var(--line);
    border-style: dashed;
  }
  .refused {
    border-color: var(--danger);
  }
  .message {
    display: flex;
    align-items: flex-start;
    gap: var(--space-1);
    margin: 0;
    padding: 0 var(--space-2) var(--space-2) calc(var(--space-8) + var(--space-1) + var(--space-4));
    color: var(--ink);
  }
  .message :global(svg) {
    color: var(--danger);
    margin-block-start: 1px;
  }
</style>
