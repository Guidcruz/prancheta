<script lang="ts" module>
  import type { PositionZone } from './PositionMark.svelte';

  /** What an item of the legend draws before its text (decorative). */
  export type TableLegendSample =
    | { readonly kind: 'zone'; readonly zone: PositionZone; readonly position: number | string }
    | { readonly kind: 'movement' };

  export interface TableLegendItem {
    readonly sample: TableLegendSample;
    /** Already translated ("Líder: o 1º colocado"). */
    readonly text: string;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import PositionMark from './PositionMark.svelte';

  /**
   * TableLegend: the key under a standings table (tabela.md, "Legenda"): one line per mark, in
   * `caption`, the sample drawn in its own column and hidden from screen readers (the zone and the
   * change are already words on each row), the text next to it. The heading is hidden: the list is
   * found by it, the eye finds it under the table.
   */
  interface Props {
    /** The hidden heading ("Legenda da tabela"). */
    title: string;
    level?: 2 | 3;
    items: readonly TableLegendItem[];
  }
  const { title, level = 2, items }: Props = $props();
  const id = $props.id();
</script>

<section class="legend" aria-labelledby="{id}-title">
  <svelte:element this={`h${level}`} id="{id}-title" class="visually-hidden">{title}</svelte:element
  >
  <ul>
    {#each items as item, i (i)}
      <li class="caption">
        <span class="sample" aria-hidden="true">
          {#if item.sample.kind === 'zone'}
            <PositionMark position={item.sample.position} zone={item.sample.zone} />
          {:else}
            <Icon name="arrow-up" size={12} />
            <Icon name="arrow-down" size={12} />
          {/if}
        </span>
        <span class="text">{item.text}</span>
      </li>
    {/each}
  </ul>
</section>

<style>
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--ink-muted);
  }
  /* The samples share one column, so every text starts at the same place. */
  .sample {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: calc(var(--space-1) / 2);
    min-inline-size: var(--space-8);
    color: var(--ink-muted);
  }
  .text {
    min-width: 0;
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
