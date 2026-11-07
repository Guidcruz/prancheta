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
  import { PITCH_COLUMNS, PITCH_LAYOUT, PITCH_LINES, PITCH_ROWS } from './pitch-layout';

  /**
   * FormationPicker: the six formations as radio cards (tatica.md, "Formação"), each with a
   * miniature of the shape, the name and the effect in one line. The miniature (tatica.md,
   * "Miniatura da formação") uses the same geometry as the lineup pitch (`PITCH_LAYOUT`): a slot
   * at cell (col, row) is a dot at (col, row) of an 8 × 10 field. A stroke joins the dots of each
   * line of the name (`PITCH_LINES`: 4 + 2 + 3 + 1), the goalkeeper is the floodlight dot at the
   * bottom, the field has its halfway line, centre circle and boxes, and a chevron above it points
   * the way of the attack. Decorative (`aria-hidden`): the name and the effect say it all.
   * Native radios in a fieldset: arrows move between the options. Two columns on the phone,
   * three when the group is 480px wide or more (`breakpoint-card`).
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

  /** Room above the field for the chevron of the attack, in cells. */
  const TOP = 0.9;
  const viewBox = `0 ${-TOP} ${PITCH_COLUMNS} ${PITCH_ROWS + TOP}`;
  /** The polyline of each line of the formation, through the centres of its slots. */
  const lines = (formation: Formation): string[] =>
    PITCH_LINES[formation].map((line) =>
      line
        .map((slot) => {
          const cell = PITCH_LAYOUT[formation][slot]!;
          return `${cell.col},${cell.row}`;
        })
        .join(' '),
    );
</script>

<fieldset class="group" aria-describedby={note ? `${id}-note` : undefined}>
  <legend class="body-strong">{legend}</legend>
  {#if note}<p class="caption note" id="{id}-note">{note}</p>{/if}
  <div class="cards">
    {#each options as option (option.value)}
      {@const checked = option.value === value}
      {@const cells = PITCH_LAYOUT[option.value]}
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
        <svg class="mini" {viewBox} aria-hidden="true" focusable="false">
          <!-- Way of the attack, above the field. -->
          <polyline class="arrow" points="3.4,-0.25 4,-0.7 4.6,-0.25" />
          <rect class="field" x="0" y="0" width="8" height="10" rx="0.35" />
          <g class="marks">
            <rect x="0.3" y="0.3" width="7.4" height="9.4" />
            <line x1="0.3" y1="5" x2="7.7" y2="5" />
            <circle cx="4" cy="5" r="0.9" />
            <rect x="2.3" y="0.3" width="3.4" height="1.1" />
            <rect x="2.3" y="8.6" width="3.4" height="1.1" />
          </g>
          {#each lines(option.value) as points, i (i)}
            <polyline class="line" {points} />
          {/each}
          {#each cells as cell, i (i)}
            <circle class="dot" class:gk={i === 0} cx={cell.col} cy={cell.row} r="0.44" />
          {/each}
        </svg>
        <span class="numero title">
          {option.title}
          {#if checked}<Icon name="check" size={16} />{/if}
        </span>
        <span class="caption muted desc" id="{id}-{option.value}-d">{option.description}</span>
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
  /* Miniature on the left with the name beside it; the effect under both, full width. */
  .card {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'mini title'
      'desc desc';
    align-items: start;
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
  /* 72px wide (touch + space-6 + space-1); the height follows the viewBox (8 × 10.9). */
  .mini {
    grid-area: mini;
    display: block;
    inline-size: calc(var(--touch) + var(--space-6) + var(--space-1));
    block-size: auto;
    overflow: visible;
  }
  .field {
    fill: var(--pitch);
  }
  /* Field markings: thin and faint, under the players. Strokes do not scale with the drawing. */
  .marks {
    fill: none;
    stroke: var(--pitch-line);
    stroke-width: 1px;
    stroke-opacity: 0.45;
    vector-effect: non-scaling-stroke;
  }
  .marks * {
    vector-effect: non-scaling-stroke;
  }
  .arrow {
    fill: none;
    stroke: var(--ink-muted);
    stroke-width: 2px;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  /* The lines of the name (4 + 4 + 2), over the markings and under the dots. */
  .line {
    fill: none;
    stroke: var(--pitch-line);
    stroke-width: 2px;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .dot {
    fill: var(--ink);
    stroke: var(--pitch);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }
  .dot.gk {
    fill: var(--floodlight);
    stroke: var(--on-floodlight);
    stroke-width: 1px;
  }
  .title {
    grid-area: title;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding-block-start: var(--space-1);
  }
  .desc {
    grid-area: desc;
  }
  .muted {
    color: var(--ink-muted);
  }
  .checked .muted {
    color: var(--ink);
  }
</style>
