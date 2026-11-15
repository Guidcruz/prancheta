<script lang="ts" module>
  export interface TableColumn {
    id: string;
    /** Header text, short ("Cond."), already translated. */
    label: string;
    /** The full name when `label` is an abbreviation ("Condição física"), for screen readers. */
    full?: string;
    /** Numbers: right-aligned, `tabular-nums`. The first column is never numeric. */
    numeric?: boolean;
    /** The column the rows are sorted by, and in which direction (`aria-sort`). */
    sort?: 'ascending' | 'descending';
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * ScrollTable: a real table whose first column (the club, the player) stays fixed while the
   * numbers scroll sideways inside the box, never the page (design-system.md; US-016). The
   * header has `aria-sort` on the sorted column; sorting itself is the screen's (a
   * SegmentedControl above the table). The box is a named, focusable region only so the keyboard
   * can scroll it; the rows bring their own targets. The rows come as a snippet of `<tr>`
   * (TableRow, PlayerRow, GroupRow). With `showCaption` the name is also shown above the box,
   * outside the scroll, as an aria-hidden label (the hidden `caption` is what is read).
   */
  interface Props {
    /** The table's name ("Elenco do Flamingo, 25 jogadores"); also shown above the box when `showCaption`. */
    caption: string;
    showCaption?: boolean;
    columns: readonly TableColumn[];
    /**
     * The most the fixed column may take of the box, in % (design-system.md, "Coluna fixa das
     * tabelas que rolam"): 50 by default (Elenco), 60 in the Tabela. The box exposes it as
     * `--fixed-max` in `cqi`, and the rows read their limit from it.
     */
    fixedMax?: number;
    children: Snippet;
  }
  const { caption, showCaption = false, columns, fixedMax = 50, children }: Props = $props();
  const id = $props.id();
</script>

<!-- The visible label sits outside the scrolling box, so it stays in view while the columns scroll.
     It is aria-hidden: the table's own (hidden) caption is the one screen readers read, and the
     region's name. -->
{#if showCaption}
  <div class="label caption" aria-hidden="true" data-scroll-table-label>{caption}</div>
{/if}
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="box scroll-table"
  role="region"
  aria-labelledby="{id}-caption"
  tabindex="0"
  style:--fixed-max="{fixedMax}cqi"
>
  <table>
    <caption id="{id}-caption" class="visually-hidden">
      {caption}
    </caption>
    <thead>
      <tr>
        {#each columns as column, i (column.id)}
          <th
            scope="col"
            class="rotulo"
            class:first={i === 0}
            class:numeric={column.numeric && i > 0}
            aria-sort={column.sort}
          >
            {#if column.full}
              <abbr title={column.full}>
                <span aria-hidden="true">{column.label}</span>
                <span class="visually-hidden">{column.full}</span>
              </abbr>
            {:else}
              {column.label}
            {/if}
            {#if column.sort}
              <span class="arrow" aria-hidden="true">{column.sort === 'ascending' ? '▲' : '▼'}</span
              >
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {@render children()}
    </tbody>
  </table>
</div>

<style>
  .box {
    container-type: inline-size;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-1);
  }
  .box:focus-visible {
    outline-offset: -2px;
  }
  table {
    inline-size: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }
  .label {
    padding: 0 var(--space-3) var(--space-2);
    text-align: start;
    color: var(--ink-muted);
  }
  th {
    /* The containing block of the hidden full name: without it the text escapes the box's
       clipping and widens the page at 360px. */
    position: relative;
    padding: var(--space-2);
    border-block-end: 1px solid var(--line);
    background: var(--surface-1);
    color: var(--ink-muted);
    text-align: start;
    white-space: nowrap;
  }
  /* The fixed header cell over the fixed column; a line at its right edge marks the fold. */
  .first {
    position: sticky;
    inset-inline-start: 0;
    z-index: 2;
    padding-inline-start: var(--space-3);
  }
  .box :global(tbody th[scope='row']),
  .first {
    border-inline-end: 1px solid var(--line);
  }
  .numeric {
    text-align: end;
  }
  abbr {
    text-decoration: none;
  }
  .arrow {
    margin-inline-start: var(--space-1);
    color: var(--ink);
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
