<script lang="ts" module>
  export interface OptionItem {
    value: string;
    /** "Completo", already translated. */
    title: string;
    /** The one-line effect ("Lesões, suspensões e cansaço entre os jogos."). */
    description?: string;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * OptionGroup / OptionCard: a choice with a one-line effect per option (new game, tactics,
   * half-time, interview). Native radios in a fieldset; the whole card is the target; the chosen
   * one has the check icon and the grass border, besides the colour. One column on the phone;
   * `columns` options side by side from 900px.
   */
  interface Props {
    name: string;
    legend: string;
    /** A line under the legend ("Não dá para mudar depois de começar."). */
    note?: string;
    options: readonly OptionItem[];
    value: string;
    /** Columns from 900px (default: one per option, up to 3). */
    columns?: 1 | 2 | 3;
    onchange: (value: string) => void;
  }
  const { name, legend, note, options, value, columns, onchange }: Props = $props();
  const id = $props.id();
  const cols = $derived(columns ?? (Math.min(options.length, 3) as 1 | 2 | 3));
</script>

<fieldset class="group" aria-describedby={note ? `${id}-note` : undefined}>
  <legend class="body-strong">{legend}</legend>
  {#if note}<p class="caption note" id="{id}-note">{note}</p>{/if}
  <div class="cards cols-{cols}">
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
          aria-describedby={option.description ? `${id}-${option.value}-d` : undefined}
        />
        <span class="mark" aria-hidden="true">
          {#if checked}<Icon name="check" size={16} />{/if}
        </span>
        <span class="text">
          <span class="body-strong">{option.title}</span>
          {#if option.description}
            <span class="caption muted" id="{id}-{option.value}-d">{option.description}</span>
          {/if}
        </span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .group {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
  }
  .note {
    margin: 0;
    color: var(--ink-muted);
  }
  .cards {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    min-height: var(--touch);
    padding: var(--space-3);
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
  .radio {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    margin: 0;
  }
  .card:has(.radio:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: var(--space-6);
    height: var(--space-6);
    border: 2px solid var(--line);
    border-radius: var(--radius-pill);
    color: var(--on-grass);
  }
  .checked .mark {
    border-color: var(--grass);
    background: var(--grass);
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  .muted {
    color: var(--ink-muted);
  }
  /* Desktop breakpoint (docs/02-architecture.md, 3). No token yet: componentes.md, proposal 1. */
  @media (min-width: 900px) {
    .cols-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .cols-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
