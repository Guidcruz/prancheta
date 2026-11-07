<script lang="ts">
  import type { ShieldClub } from '@lib/generators/shield';
  import Crest from './Crest.svelte';

  /**
   * TableRow (LinhaTabela): one row of the standings, inside a ScrollTable (or any table with the
   * same columns). The first cell is the row header, fixed at the left: position, crest and
   * name. The coach's club has a marker bar and bold text besides the background, `aria-current`,
   * and `mineLabel` for screen readers. Numbers in `tabular-nums`. The Tabela screen (T-031) adds
   * the movement arrow and the zone mark; the Clube screen uses the compact row as it is.
   */
  interface Props {
    position: number;
    club: ShieldClub;
    /** Short name. */
    name: string;
    /** The numbers after the club, in the order of the table's columns. */
    stats: readonly (number | string)[];
    isMine?: boolean;
    /** "Seu clube" (table.mine), read after the name of the coach's club. */
    mineLabel?: string;
    /** Instance suffix for the crest (the same club twice on a page). */
    instance?: string;
  }
  const { position, club, name, stats, isMine = false, mineLabel, instance }: Props = $props();
</script>

<tr class:mine={isMine} aria-current={isMine ? 'true' : undefined}>
  <th scope="row" class="club">
    <span class="cell">
      <span class="numero pos">{position}</span>
      <Crest {club} size="sm" {instance} />
      <span class="name {isMine ? 'body-strong' : 'body'}">{name}</span>
      {#if isMine && mineLabel}<span class="visually-hidden">{mineLabel}</span>{/if}
    </span>
  </th>
  {#each stats as stat, i (i)}
    <td class="numero stat">{stat}</td>
  {/each}
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
  /* The whole fixed cell (content, padding, the marker bar and the fold line) never takes more
     than half the table's box (ScrollTable is the container; componentes.md, "Coluna fixa das
     tabelas"): start padding, bar, end padding and the 1px line come off the 50cqi. */
  .cell {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    max-inline-size: calc(50cqi - var(--space-2) - var(--space-1) - var(--space-2) - 1px);
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
    text-align: end;
    font-variant-numeric: tabular-nums;
  }
  /* The coach's club: background, bold and a bar at the left edge (not only colour). */
  .mine th,
  .mine td {
    background: var(--surface-2);
  }
  .mine .club {
    border-inline-start-color: var(--grass);
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
