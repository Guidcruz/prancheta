<script lang="ts" module>
  /** A number cell; `{ text, sr }` when the visible text needs words for screen readers ("—"). */
  export type PlayerCell = number | string | { readonly text: string; readonly sr: string };
</script>

<script lang="ts">
  import StatusBadge, { type StatusBadgeItem } from './StatusBadge.svelte';

  /**
   * PlayerRow (CardJogador, variant `row`): one athlete in the squad table, inside a ScrollTable.
   * The fixed first cell is the row header: position code, name and the situation badges
   * (injured, suspended, "promessa") under the name, icon plus text. The name is the button that
   * opens the full card; a tap anywhere on the row does the same (a pointer shortcut; the
   * keyboard and screen readers use the button). At least 44px tall. The potential never
   * reaches this component: only the "promessa" badge, when the engine says so.
   */
  interface Props {
    name: string;
    /** "ATA", already translated (position.ST.short). */
    positionCode: string;
    /** "Atacante" (position.ST), for screen readers. */
    positionLabel: string;
    badges?: readonly StatusBadgeItem[];
    /** The numbers after the player, in the order of the table's columns. */
    cells: readonly PlayerCell[];
    /** Opens the full card; the screen gives it its own entry in the history. */
    onopen: () => void;
  }
  const { name, positionCode, positionLabel, badges = [], cells, onopen }: Props = $props();
  const text = (cell: PlayerCell) => (typeof cell === 'object' ? cell.text : String(cell));
</script>

<!-- The row's click is a pointer shortcut; the name button is the keyboard and screen-reader way. -->
<tr class="row" onclick={onopen}>
  <th scope="row" class="player">
    <span class="cell">
      <span class="rotulo pos" aria-hidden="true">{positionCode}</span>
      <span class="who">
        <span class="visually-hidden">{positionLabel}</span>
        <button
          type="button"
          class="body-strong name"
          onclick={(event) => {
            event.stopPropagation();
            onopen();
          }}>{name}</button
        >
        {#if badges.length > 0}
          <span class="badges">
            {#each badges as badge (badge.kind)}
              <StatusBadge {...badge} />
            {/each}
          </span>
        {/if}
      </span>
    </span>
  </th>
  {#each cells as cell, i (i)}
    <td class="numero stat">
      {#if typeof cell === 'object'}
        <span aria-hidden="true">{cell.text}</span>
        <span class="visually-hidden">{cell.sr}</span>
      {:else}
        {text(cell)}
      {/if}
    </td>
  {/each}
</tr>

<style>
  .row {
    cursor: pointer;
  }
  th,
  td {
    block-size: var(--touch);
    padding: var(--space-1) var(--space-2);
    border-block-end: 1px solid var(--line);
    background: var(--surface-1);
    text-align: start;
    font-weight: inherit;
  }
  .row:hover th,
  .row:hover td {
    background: var(--surface-2);
  }
  .player {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
    padding-inline-start: var(--space-3);
  }
  /* The fixed column never takes more than half the table's box (ScrollTable is the
     container), the cell's padding and the fold line included (elenco.md, E2E measure 3: at
     360px, 45cqi plus the padding came to 51%). Long names end in an ellipsis; the card shows
     them whole. */
  .cell {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    max-inline-size: calc(50cqi - var(--space-3) - var(--space-2) - 1px);
  }
  .pos {
    flex: none;
    min-inline-size: calc(var(--space-8) + var(--space-1));
    padding: calc(var(--space-1) / 2) var(--space-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    color: var(--ink-muted);
    text-align: center;
  }
  .who {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(var(--space-1) / 2);
    min-width: 0;
  }
  /* The button keeps the 44px target over the whole cell height. */
  .name {
    max-inline-size: 100%;
    /* A short name ("Léo") still makes a 44px target. */
    min-inline-size: var(--touch);
    min-block-size: var(--touch);
    margin-block: calc(var(--space-1) * -1);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink);
    text-align: start;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .badges:not(:empty) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    padding-block-end: var(--space-1);
  }
  .badges {
    max-inline-size: 100%;
  }
  .stat {
    /* The containing block of the hidden "sem jogos": it stays inside the box's clipping. */
    position: relative;
    text-align: end;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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
