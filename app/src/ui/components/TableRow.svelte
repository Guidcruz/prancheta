<script lang="ts" module>
  import type { StatusBadgeItem } from './StatusBadge.svelte';

  /** A number cell; `{ text, sr }` when the visible text needs words for screen readers ("—"). */
  export type TableCell = number | string | { readonly text: string; readonly sr: string };

  /** The change of position in the last round (`full` only). */
  export interface TableMovement {
    readonly direction: 'up' | 'down';
    /** "+2", "−1", already formatted in the language. */
    readonly text: string;
    /** "Subiu 2 posições" (round.table.up.*), read instead of the arrow and the number. */
    readonly a11y: string;
  }

  /** The zone of the row (`full` only): the mark on the position and the word under the name. */
  export interface TableZone {
    readonly kind: 'leader' | 'relegation';
    /** "Líder", "Campeão", "Rebaixamento" (table.zone.*). */
    readonly label: string;
  }

  /** The last results (letter only, oldest first), or "—" with the words for screen readers. */
  export type TableForm =
    readonly StatusBadgeItem[] | { readonly text: string; readonly sr: string };
</script>

<script lang="ts">
  import type { ShieldClub } from '@lib/generators/shield';
  import Crest from './Crest.svelte';
  import Icon from './Icon.svelte';
  import PositionMark from './PositionMark.svelte';
  import StatusBadge from './StatusBadge.svelte';

  /**
   * TableRow (LinhaTabela): one row of the standings, inside a ScrollTable (or any table with the
   * same columns). The first cell is the row header, fixed at the left. The coach's club has a
   * marker bar and bold text besides the background, `aria-current`, and `mineLabel` for screen
   * readers. Numbers in `tabular-nums`.
   *
   * `compact` (the Clube's mini table): position, crest and name on one line. `full` (the Tabela,
   * T-031; tabela.md, "A linha"): the position block (PositionMark, with the change of the last
   * round under it), the crest and the name with the zone's word under it, every row two lines
   * of text tall, and the last results in a last cell. The cell is read in the order position,
   * name, "seu clube", zone and change; the crest, the arrow and the "+2" are hidden from screen
   * readers.
   */
  interface Props {
    position: number;
    club: ShieldClub;
    /** Short name. */
    name: string;
    /** The numbers after the club, in the order of the table's columns. */
    stats: readonly TableCell[];
    isMine?: boolean;
    /** "Seu clube" (table.mine), read after the name of the coach's club. */
    mineLabel?: string;
    /** Instance suffix for the crest (the same club twice on a page). */
    instance?: string;
    layout?: 'compact' | 'full';
    movement?: TableMovement;
    zone?: TableZone;
    /** The last cell (`full` only); absent, the row has no such cell. */
    form?: TableForm;
    /** The arrow comes in with a short movement when the row mounts (`full` only). */
    animate?: boolean;
  }
  const {
    position,
    club,
    name,
    stats,
    isMine = false,
    mineLabel,
    instance,
    layout = 'compact',
    movement,
    zone,
    form,
    animate = false,
  }: Props = $props();
</script>

<tr class:mine={isMine} class:full={layout === 'full'} aria-current={isMine ? 'true' : undefined}>
  <th scope="row" class="club">
    {#if layout === 'full'}
      <span class="cell">
        <span class="spot">
          <PositionMark {position} zone={zone?.kind} />
          <span
            class="move caption {movement?.direction ?? ''}"
            class:animate={animate && movement !== undefined}
            aria-hidden="true"
          >
            {#if movement}
              <Icon name={movement.direction === 'up' ? 'arrow-up' : 'arrow-down'} size={12} />
              <span class="change">{movement.text}</span>
            {/if}
          </span>
        </span>
        <Crest {club} size="sm" {instance} />
        <span class="names">
          <span class="name {isMine ? 'body-strong' : 'body'}">{name}</span>
          {#if isMine && mineLabel}<span class="visually-hidden">{mineLabel}</span>{/if}
          <span class="zone caption">{zone?.label ?? ''}</span>
        </span>
        {#if movement}<span class="visually-hidden">{movement.a11y}</span>{/if}
      </span>
    {:else}
      <span class="cell">
        <span class="numero pos">{position}</span>
        <Crest {club} size="sm" {instance} />
        <span class="name {isMine ? 'body-strong' : 'body'}">{name}</span>
        {#if isMine && mineLabel}<span class="visually-hidden">{mineLabel}</span>{/if}
      </span>
    {/if}
  </th>
  {#each stats as stat, i (i)}
    <td class="numero stat">
      {#if typeof stat === 'object'}
        <span aria-hidden="true">{stat.text}</span>
        <span class="visually-hidden">{stat.sr}</span>
      {:else}
        {stat}
      {/if}
    </td>
  {/each}
  {#if layout === 'full' && form !== undefined}
    <td class="form">
      {#if 'sr' in form}
        <span class="numero" aria-hidden="true">{form.text}</span>
        <span class="visually-hidden">{form.sr}</span>
      {:else}
        <span class="results">
          {#each form as badge, i (i)}
            <StatusBadge {...badge} letterOnly />
          {/each}
        </span>
      {/if}
    </td>
  {/if}
</tr>

<style>
  tr {
    block-size: var(--touch);
  }
  th,
  td {
    padding: var(--space-1) var(--space-2);
    border-block-end: 1px solid var(--line);
    background: var(--surface-1);
    text-align: start;
    font-weight: inherit;
  }
  .club {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
    padding-inline-start: var(--space-2);
    border-inline-start: var(--space-1) solid transparent;
  }
  .cell {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  /* Inside a ScrollTable the whole fixed cell (content, padding, the marker bar and the fold
     line) never takes more than the box's limit (`--fixed-max`: half the box by default, 60% in
     the Tabela; componentes.md, "Coluna fixa das tabelas que rolam"): start padding, bar, end
     padding and the 1px line come off it. Outside one (the Clube's mini table, which does not
     scroll) the name takes the room that is left. */
  :global(.scroll-table) .cell {
    max-inline-size: calc(
      var(--fixed-max, 50cqi) - var(--space-2) - var(--space-1) - var(--space-2) - 1px
    );
  }
  .pos {
    flex: none;
    min-inline-size: var(--space-6);
    text-align: end;
    font-variant-numeric: tabular-nums;
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stat {
    /* The containing block of the hidden words of a "—": it stays inside the box's clipping. */
    position: relative;
    text-align: end;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  /* The coach's club: background, bold and a bar at the left edge (not only colour). */
  .mine th,
  .mine td {
    background: var(--surface-2);
  }
  .mine .club {
    border-inline-start-color: var(--grass);
  }

  /* ------------------------------------------------------------------ full (the Tabela, T-031) */

  /* Position block, crest after space-1, name after space-2 (tabela.md, "A linha"). */
  .full .cell {
    gap: 0;
  }
  .full .spot {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    inline-size: var(--space-8);
    margin-inline-end: var(--space-1);
  }
  .full .names {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin-inline-start: var(--space-2);
  }
  /* The line of the change and the line of the zone keep their height when empty, so every row
     is two lines of text tall, with or without them (no row "jumps"). */
  .move,
  .zone {
    min-block-size: 1lh;
    white-space: nowrap;
  }
  .move {
    display: flex;
    align-items: center;
    gap: calc(var(--space-1) / 2);
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
  .change {
    color: var(--ink);
  }
  .zone {
    display: block;
    color: var(--ink-muted);
  }
  .form {
    position: relative;
    white-space: nowrap;
  }
  .results {
    display: flex;
    gap: var(--space-1);
  }
  /* A short movement of the arrow when the tab opens (CEO decision 6 of tabela.md): 4px towards
     its direction (the rise comes from below, the fall from above) and the opacity, 300 ms,
     ease-out, once, every row together. The duration is written here until the motion tokens
     exist (componentes.md, proposal 2); with `prefers-reduced-motion` the arrow is still, already
     in place (app.css also stops every animation). */
  @media (prefers-reduced-motion: no-preference) {
    .animate.up {
      animation: rise 300ms ease-out 1;
    }
    .animate.down {
      animation: fall 300ms ease-out 1;
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(var(--space-1));
    }
  }
  @keyframes fall {
    from {
      opacity: 0;
      transform: translateY(calc(var(--space-1) * -1));
    }
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
