<script lang="ts" module>
  /** One statistic: its name and the two numbers, already formatted ("54%"). */
  export interface StatsRow {
    label: string;
    home: string;
    away: string;
  }
</script>

<script lang="ts">
  /**
   * MatchStatsTable (componentes.md, "Casca da T-030 e da T-083"): the statistics of a match in a
   * plain table that never scrolls, three columns: the home number, the name of the statistic and
   * the away number. The headers are the clubs' short names; the caption is read, not shown. The
   * numbers in `tabular-nums`, centred; the larger one gets no colour (simple before pretty).
   */
  interface Props {
    caption: string;
    home: string;
    away: string;
    rows: readonly StatsRow[];
  }
  const { caption, home, away, rows }: Props = $props();
</script>

<table class="stats">
  <caption class="visually-hidden">{caption}</caption>
  <thead>
    <tr>
      <th scope="col" class="caption club">{home}</th>
      <td></td>
      <th scope="col" class="caption club">{away}</th>
    </tr>
  </thead>
  <tbody>
    {#each rows as row (row.label)}
      <tr>
        <td class="numero number">{row.home}</td>
        <th scope="row" class="body label">{row.label}</th>
        <td class="numero number">{row.away}</td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .stats {
    width: 100%;
    /* Fixed columns: the numbers keep their width whatever the names in the header. */
    table-layout: fixed;
    border-collapse: collapse;
  }
  .club {
    width: 25%;
    padding: 0 0 var(--space-2);
    color: var(--ink-muted);
    text-align: center;
    vertical-align: bottom;
    overflow-wrap: break-word;
  }
  .number,
  .label {
    padding: var(--space-2) 0;
    border-top: 1px solid var(--line);
    text-align: center;
  }
  .number {
    font-variant-numeric: tabular-nums;
  }
  .label {
    padding-inline: var(--space-2);
    font-weight: inherit;
    overflow-wrap: break-word;
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
