<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * LineupGroup: a titled list under the pitch, "Banco" or "Não relacionados" (escalacao.md).
   * Heading, the count next to it ("6 de 7"), the column headers aligned with the numbers of the
   * LineupRow, and the rows (`children`, a list of LineupRow). A list, not a table: each row is
   * one button whose accessible name already says every number.
   */
  interface Props {
    /** "Banco" (`lineup.bench.title`). */
    title: string;
    /** "6 de 7" (`lineup.bench.count`), optional. */
    count?: string;
    /** "Nota", "Cond." (`squad.col.*`), in the order of the rows' cells; visual only. */
    columns?: readonly string[];
    /** Heading level inside the screen. */
    level?: 2 | 3;
    children: Snippet;
  }
  const { title, count, columns = [], level = 2, children }: Props = $props();
  const id = $props.id();
</script>

<section class="group" aria-labelledby="{id}-t">
  <div class="head">
    <svelte:element this={`h${level}`} class="subtitulo title" id="{id}-t">
      {title}
      {#if count}<span class="caption count">{count}</span>{/if}
    </svelte:element>
    {#each columns as column (column)}
      <span class="caption column" aria-hidden="true">{column}</span>
    {/each}
    {#if columns.length > 0}<span class="tail" aria-hidden="true"></span>{/if}
  </div>
  <ul class="rows">
    {@render children()}
  </ul>
</section>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    padding-inline: var(--space-2);
  }
  .title {
    display: flex;
    flex: 1 1 auto;
    align-items: baseline;
    gap: var(--space-2);
    margin: 0;
    min-inline-size: 0;
  }
  .count,
  .column {
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
  /* Same widths as LineupRow's cells and tail, plus the row's border. */
  .column {
    flex: none;
    inline-size: calc(var(--space-8) + var(--space-2));
    text-align: end;
  }
  .tail {
    flex: none;
    inline-size: calc(var(--space-6) + 2px);
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: calc(var(--space-1) / 2);
    margin: 0;
    padding: 0;
  }
</style>
