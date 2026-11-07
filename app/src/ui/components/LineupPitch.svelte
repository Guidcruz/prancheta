<script lang="ts" module>
  import type { ChipMark, ChipState } from './LineupChip.svelte';
  import type { Sector } from './sectors';

  /** One of the 11 slots, in the order of `FORMATION_SLOTS[formation]`, as the screen builds it. */
  export interface PitchSlot {
    /**
     * "ZAG": the code of the player's natural position (`position.<P>.short`), not the slot's;
     * absent for an empty slot (escalacao.md, "Cor de setor no LineupChip").
     */
    positionCode?: string;
    /** `SECTOR_OF[player.position]`; absent for an empty slot. */
    sector?: Sector;
    /** Built by the screen with `lineup.slot.a11y` or `lineup.slot.emptyA11y`. */
    a11yLabel: string;
    /** Absent: empty slot. */
    name?: string;
    overall?: number;
    /** Realismo completo only. */
    condition?: number;
    mark?: ChipMark;
    captain?: boolean;
    state?: ChipState;
  }
</script>

<script lang="ts">
  import type { Formation } from '@engine';
  import LineupChip from './LineupChip.svelte';
  import { PITCH_LAYOUT } from './pitch-layout';

  /**
   * LineupPitch: the lineup pitch in the DOM, not canvas (escalacao.md, "Desenho do campo"). An
   * 8 × 10 grid on the pitch colour, own goal at the bottom; each slot is a LineupChip placed by
   * `PITCH_LAYOUT`. The buttons follow the slot order (GK first, then defence, midfield, attack),
   * which is also the reading order for screen readers; the pitch drawing is decorative. The
   * swap, the drag and the refusal are the screen's: this shell only reports the slot touched.
   */
  interface Props {
    formation: Formation;
    /** 11 entries, in slot order. */
    slots: readonly PitchSlot[];
    /** "Campo, formação 4-4-2" (`lineup.pitch.label`). */
    label: string;
    /** "Vaga livre" (`lineup.slot.empty`). */
    emptyLabel: string;
    /** "C" (`lineup.captain.short`). */
    captainShort: string;
    /** Id of the status bar's hint, passed to every chip while a player is picked. */
    describedby?: string;
    onslot?: (index: number, event: MouseEvent) => void;
    onslotpointerdown?: (index: number, event: PointerEvent) => void;
  }
  const {
    formation,
    slots,
    label,
    emptyLabel,
    captainShort,
    describedby,
    onslot,
    onslotpointerdown,
  }: Props = $props();
  const cells = $derived(PITCH_LAYOUT[formation]);
</script>

<div class="pitch" role="group" aria-label={label}>
  <div class="lines" aria-hidden="true">
    <span class="half"></span>
    <span class="circle"></span>
    <span class="box top"></span>
    <span class="box bottom"></span>
  </div>
  <ol class="slots">
    {#each slots as slot, i (i)}
      {@const cell = cells[i]}
      {#if cell}
        <li style="grid-column: {cell.col} / span 2; grid-row: {cell.row} / span 2">
          <LineupChip
            slot={i}
            positionCode={slot.positionCode}
            sector={slot.sector}
            a11yLabel={slot.a11yLabel}
            name={slot.name}
            overall={slot.overall}
            condition={slot.condition}
            mark={slot.mark}
            captainShort={slot.captain ? captainShort : undefined}
            {emptyLabel}
            state={slot.state}
            {describedby}
            onclick={(event) => onslot?.(i, event)}
            onpointerdown={(event) => onslotpointerdown?.(i, event)}
          />
        </li>
      {/if}
    {/each}
  </ol>
</div>

<style>
  .pitch {
    /* A chip with a two-line mark and the condition bar is 88px (2 × touch); a row is half. */
    --chip-h: calc(var(--touch) * 2);
    position: relative;
    padding: var(--space-3) var(--space-2) var(--space-2);
    border-radius: var(--radius-md);
    background: var(--pitch);
    overflow: hidden;
  }
  .lines {
    position: absolute;
    inset: var(--space-1);
    border: 1px solid var(--pitch-line);
    border-radius: var(--radius-sm);
    pointer-events: none;
  }
  .lines span {
    position: absolute;
    border: 1px solid var(--pitch-line);
  }
  .half {
    inset-inline: 0;
    inset-block-start: 50%;
    border-width: 1px 0 0;
  }
  .circle {
    inset-block-start: 50%;
    inset-inline-start: 50%;
    inline-size: 28%;
    aspect-ratio: 1;
    border-radius: var(--radius-pill);
    translate: -50% -50%;
  }
  .box {
    inset-inline: 25%;
    block-size: 12%;
  }
  .box.top {
    inset-block-start: 0;
    border-block-start-width: 0;
  }
  .box.bottom {
    inset-block-end: 0;
    border-block-end-width: 0;
  }
  .slots {
    position: relative;
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    grid-template-rows: repeat(10, calc(var(--chip-h) / 2));
    column-gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .slots li {
    display: flex;
    align-items: center;
    min-inline-size: 0;
  }
</style>
