<script lang="ts" module>
  import type { Formation } from '@engine';

  export interface FormationOption {
    value: Formation;
    /** "4-3-3" as the content writes it (`tactic.formation.<F>`). */
    title: string;
    /** The one-line effect (`tactic.formation.<F>.effect`). */
    description: string;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import { PITCH_LAYOUT } from './pitch-layout';

  /**
   * FormationPicker: the six formations as radio cards (tatica.md, "Formação"), each with a small
   * drawing of the shape (the same `PITCH_LAYOUT` of the lineup pitch, decorative), the name and
   * the effect in one line. Native radios in a fieldset: arrows move between the options. Two
   * columns on the phone, three when the group is 480px wide or more (`breakpoint-card`).
   */
  interface Props {
    name: string;
    /** "Formação" (`tactic.formation.legend`). */
    legend: string;
    /** "Os 11 titulares mudam de lugar pela posição de cada um." */
    note?: string;
    options: readonly FormationOption[];
    value: Formation;
    onchange: (value: Formation) => void;
  }
  const { name, legend, note, options, value, onchange }: Props = $props();
  const id = $props.id();
</script>

<fieldset class="group" aria-describedby={note ? `${id}-note` : undefined}>
  <legend class="body-strong">{legend}</legend>
  {#if note}<p class="caption note" id="{id}-note">{note}</p>{/if}
  <div class="cards">
    {#each options as option (option.value)}
      {@const checked = option.value === value}
      <label class="card" class:checked for="{id}-{option.value}">
        <input
          id="{id}-{option.value}"
          class="radio"
          type="radio"
          {name}
          value={option.value}
          {checked}
          onchange={() => onchange(option.value)}
          aria-describedby="{id}-{option.value}-d"
        />
        <span class="mini" aria-hidden="true">
          {#each PITCH_LAYOUT[option.value] as cell, i (i)}
            <span
              class="dot"
              style="grid-column: {cell.col} / span 2; grid-row: {cell.row} / span 2"
            ></span>
          {/each}
        </span>
        <span class="text">
          <span class="numero title">
            {option.title}
            {#if checked}<Icon name="check" size={16} />{/if}
          </span>
          <span class="caption muted" id="{id}-{option.value}-d">{option.description}</span>
        </span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .group {
    container-type: inline-size;
    margin: 0;
    padding: 0;
    border: 0;
    min-inline-size: 0;
  }
  legend {
    padding: 0;
    margin-block-end: var(--space-1);
  }
  .note {
    margin: 0 0 var(--space-2);
    color: var(--ink-muted);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }
  /* breakpoint-card (design-system.md, "Card em duas colunas"): a variable does not work here. */
  @container (min-width: 480px) {
    .cards {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  .card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    min-block-size: var(--touch);
    padding: var(--space-2);
    border: 2px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    color: var(--ink);
    cursor: pointer;
  }
  .card:hover {
    background: var(--surface-2);
  }
  .card.checked {
    border-color: var(--grass);
    background: var(--surface-2);
  }
  .card:has(.radio:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .radio {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    margin: 0;
  }
  /* The shape in miniature: the 8 × 10 grid of the pitch, a dot per slot. */
  .mini {
    display: grid;
    flex: none;
    /* 6px cells: two cells (12px) per slot leave room around each 8px dot. */
    grid-template-columns: repeat(8, calc(var(--space-1) * 1.5));
    grid-template-rows: repeat(10, calc(var(--space-1) * 1.5));
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    background: var(--pitch);
  }
  .dot {
    place-self: center;
    inline-size: var(--space-2);
    block-size: var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--pitch-line);
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: calc(var(--space-1) / 2);
    min-inline-size: 0;
  }
  .title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .muted {
    color: var(--ink-muted);
  }
  .checked .muted {
    color: var(--ink);
  }
</style>
