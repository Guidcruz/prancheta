<script lang="ts">
  import { onMount } from 'svelte';
  import type { ClubId, GameState } from '@engine';
  import type { Lang } from '@lib/config';
  import { t } from '@lib/i18n';
  import ScrollTable from '../components/ScrollTable.svelte';
  import TableLegend from '../components/TableLegend.svelte';
  import TableRow from '../components/TableRow.svelte';
  import {
    legendItems,
    openingScroll,
    readTable,
    rowView,
    tableCaption,
    tableColumns,
  } from '../table';

  /**
   * The Tabela tab (docs/design/telas/tabela.md; US-023): the whole standings, read only. The
   * club column stays fixed (up to 60% of the box, CEO decision 5) while the numbers scroll
   * sideways inside the box; each row has the change of the last round and, in a zone, the mark
   * on the position and the zone's word; the legend explains them, from round 1. The tab opens
   * with the coach's row in sight (CEO decision 7): when it is not whole between the header and
   * "Jogar rodada", the page jumps, with no animation, until the row is in the middle of that
   * area. The arrows come in with one short movement when the tab opens (CEO decision 6).
   * Server-renderable: the props are the whole input; `getStandings` never throws, so an error
   * here is a bug, for the frame's boundary.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
  }
  const { lang, game, clubId }: Props = $props();

  const read = $derived(readTable(game, clubId));
  const rows = $derived(read.lines.map((line) => rowView(game, line, lang)));
  const columns = $derived(tableColumns(lang));
  const caption = $derived(tableCaption(read, game, lang));
  const legend = $derived(legendItems(read, lang));

  let root: HTMLElement | undefined = $state();

  /** The top of the floating "Jogar rodada" in the window, or its height (desktop: no button). */
  function viewBottom(): number {
    for (const button of document.querySelectorAll<HTMLElement>('button.play.float')) {
      if (button.getClientRects().length > 0) return button.getBoundingClientRect().top;
    }
    return window.innerHeight;
  }

  onMount(() => {
    const row = root?.querySelector<HTMLElement>('tr[aria-current="true"]');
    if (row === undefined || row === null) return;
    // The tab opens at the top (it may come from a scrolled tab), then jumps if it must.
    window.scrollTo({ top: 0, behavior: 'instant' });
    const box = row.getBoundingClientRect();
    const header = document.querySelector<HTMLElement>('header.header');
    const top = openingScroll({
      rowTop: box.top,
      rowBottom: box.bottom,
      headerBottom: header === null ? 0 : header.getBoundingClientRect().bottom,
      viewBottom: viewBottom(),
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    });
    if (top > 0) window.scrollTo({ top, behavior: 'instant' });
  });
</script>

<div class="table-screen" bind:this={root}>
  <ScrollTable {caption} showCaption {columns} fixedMax={60}>
    {#each rows as row (row.clubId)}
      <TableRow
        layout="full"
        position={row.position}
        club={game.clubs[row.clubId]!.def}
        name={row.name}
        stats={row.stats}
        form={row.form}
        zone={row.zone}
        movement={row.movement}
        isMine={row.isMine}
        mineLabel={t('table.mine', lang)}
        instance="table"
        animate
      />
    {/each}
  </ScrollTable>
  {#if legend.length > 0}
    <TableLegend title={t('table.legend.title', lang)} items={legend} />
  {/if}
</div>

<style>
  .table-screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-block-start: var(--space-4);
  }
</style>
