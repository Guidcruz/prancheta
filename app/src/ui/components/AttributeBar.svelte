<script lang="ts">
  /**
   * AttributeBar: label, number and a bar, for the 6 attributes of the player card and for
   * condition and morale. The number is the data; the bar only reinforces it (`aria-hidden`), so
   * the colour never carries meaning. It renders a `dt`/`dd` pair inside a `div`: the caller wraps
   * the list in a `<dl>`.
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
  }
  const { label, value, max = 99, emptyText, valueText }: Props = $props();
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
      <span class="numero">{valueText ?? value}</span>
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
  .empty {
    color: var(--ink-muted);
  }
  .track {
    position: absolute;
    inset-inline: 0;
    inset-block-end: var(--space-1);
    display: block;
    /* Bar height: no token yet (componentes.md, "Propostas ao design system", `size-bar`). */
    block-size: var(--space-1);
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
