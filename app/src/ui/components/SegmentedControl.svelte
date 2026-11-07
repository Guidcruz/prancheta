<script lang="ts" module>
  export interface SegmentOption {
    value: string;
    /** "Posição", already translated. */
    label: string;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * SegmentedControl: a short choice that changes the view in place (the squad's order; later
   * Elenco/Escalação/Tática, the theme). Native radios in a fieldset, so arrows move between the
   * options; each option is at least 44px. The chosen one has the check icon, bold text and the
   * grass border, besides the background. Long labels in es and en wrap inside the option.
   */
  interface Props {
    name: string;
    /** "Ordenar por". */
    legend: string;
    /** The legend is read by screen readers but not shown (a label already sits nearby). */
    hideLegend?: boolean;
    options: readonly SegmentOption[];
    value: string;
    onchange: (value: string) => void;
  }
  const { name, legend, hideLegend = false, options, value, onchange }: Props = $props();
  const id = $props.id();
</script>

<fieldset class="segmented">
  <legend class="caption legend" class:visually-hidden={hideLegend}>{legend}</legend>
  <div class="track">
    {#each options as option (option.value)}
      {@const checked = option.value === value}
      <label class="option" class:checked for="{id}-{option.value}">
        <input
          id="{id}-{option.value}"
          class="radio"
          type="radio"
          {name}
          value={option.value}
          {checked}
          onchange={() => onchange(option.value)}
        />
        {#if checked}<Icon name="check" size={16} />{/if}
        <span class={checked ? 'body-strong' : 'body'}>{option.label}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .segmented {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .legend {
    padding: 0;
    margin-block-end: var(--space-1);
    color: var(--ink-muted);
  }
  .track {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-1);
  }
  .option {
    position: relative;
    display: inline-flex;
    flex: 1 1 0;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-width: 0;
    min-height: var(--touch);
    padding: var(--space-1) var(--space-2);
    border: 2px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--ink-muted);
    text-align: center;
    cursor: pointer;
  }
  .option:hover {
    background: var(--surface-2);
  }
  .option.checked {
    border-color: var(--grass);
    background: var(--surface-2);
    color: var(--ink);
  }
  .radio {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    margin: 0;
  }
  .option:has(.radio:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
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
