<script lang="ts">
  import type { Level } from './levels';

  /**
   * AttributeBar: label, number and a bar, for the 6 attributes of the player card and for
   * condition, morale and form. The number is the data; the bar only reinforces it
   * (`aria-hidden`). With `level` (the states only: `levelOf`), the number takes its band's
   * colour and `srText` is what screen readers read instead of it ("82, boa"), so the colour is
   * never the only way to read the band. It renders a `dt`/`dd` pair inside a `div`: the caller wraps the list
   * in a `<dl>`.
   */
  interface Props {
    /** "Finalização", already translated. */
    label: string;
    /** The integer shown (the caller rounds); `undefined` shows `emptyText` and an empty bar. */
    value: number | undefined;
    /** 99 for attributes (1..99), 100 for condition and morale (0..100). */
    max?: number;
    /** Shown instead of the number when there is none ("Sem jogos ainda"). */
    emptyText?: string;
    /** Text shown instead of the bare number (form: "7,2"); `value` still fills the bar. */
    valueText?: string;
    /** The band of the shown value (condition, morale, form); ignored with no value. */
    level?: Level;
    /** Read instead of the number when it says more ("82, boa", level.reading), translated. */
    srText?: string;
  }
  const { label, value, max = 99, emptyText, valueText, level, srText }: Props = $props();
  const fill = $derived(
    value === undefined || !Number.isFinite(value) ? 0 : Math.min(1, Math.max(0, value / max)),
  );
</script>

<div class="attr">
  <dt class="body label">{label}</dt>
  <dd class="value">
    {#if value === undefined}
      <span class="body empty">{emptyText}</span>
    {:else}
      <span
        class="numero"
        class:level-good={level === 'good'}
        class:level-fair={level === 'fair'}
        class:level-poor={level === 'poor'}
        aria-hidden={srText ? 'true' : undefined}>{valueText ?? value}</span
      >
      {#if srText}<span class="visually-hidden">{srText}</span>{/if}
    {/if}
    <span class="track" aria-hidden="true">
      <span class="fill" style:inline-size="{fill * 100}%"></span>
    </span>
  </dd>
</div>

<style>
  /* Label and number on one line, the bar under both. The bar lives inside the dd (a dl group
     only takes dt and dd) and is placed under the whole row from there. */
  .attr {
    position: relative;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    padding-block: var(--space-1) calc(var(--space-1) * 3);
  }
  .label {
    margin: 0;
    min-width: 0;
    color: var(--ink-muted);
  }
  .value {
    margin: 0;
    flex: none;
    text-align: end;
  }
  .numero {
    font-variant-numeric: tabular-nums;
  }
  /* The band reinforces the number (levels.ts); 4.5:1 on the sheet's surface-1 in both themes. */
  .level-good {
    color: var(--level-good);
  }
  .level-fair {
    color: var(--level-fair);
  }
  .level-poor {
    color: var(--level-poor);
  }
  .empty {
    color: var(--ink-muted);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .track {
    position: absolute;
    inset-inline: 0;
    inset-block-end: var(--space-1);
    display: block;
    block-size: var(--size-bar);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    overflow: hidden;
  }
  .fill {
    display: block;
    block-size: 100%;
    border-radius: inherit;
    background: var(--ink-muted);
  }
</style>
