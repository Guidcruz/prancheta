<script lang="ts" module>
  /** The zones a position can be marked with (design-system.md, "Marca de zona da tabela"). */
  export type PositionZone = 'leader' | 'relegation';
</script>

<script lang="ts">
  /**
   * PositionMark: the position of a row of the standings. Without a zone, the number in `numero`
   * `ink`; in a zone, the number inside a small box with the pair of a StatusBadge (the leader
   * and the champion with the `derby`/`prospect` pair, the relegation zone with the `loss` one;
   * proposal 29, approved by the CEO). Shape and colour only reinforce: the zone is said by the
   * word on the row and by the legend, so the mark has no text or accessible name of its own,
   * and the number is read as text.
   */
  interface Props {
    /** The position, as a number or already formatted. */
    position: number | string;
    zone?: PositionZone;
  }
  const { position, zone }: Props = $props();
</script>

<span class="mark numero {zone ?? 'plain'}" data-zone={zone}>{position}</span>

<style>
  /* The same box with or without a zone, so the numbers of every row line up. */
  .mark {
    display: inline-flex;
    justify-content: center;
    box-sizing: border-box;
    min-inline-size: var(--space-6);
    padding-inline: var(--space-1);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  /* Pairs checked by `npm run tokens` in both themes (the StatusBadge's): no new colour. */
  .leader {
    background: var(--floodlight);
    color: var(--on-floodlight);
  }
  .relegation {
    background: var(--danger-soft);
    border-color: var(--danger);
    color: var(--ink);
  }
</style>
