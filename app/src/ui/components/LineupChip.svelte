<script lang="ts" module>
  import type { IconName } from './Icon.svelte';

  /**
   * The one mark a slot shows on the pitch (escalacao.md, "Marca da vaga"): the most serious
   * wins (unavailable, then out of position, then improvised); the others go to the accessible
   * name and to the list of warnings under the pitch.
   */
  export type ChipMarkKind = 'injured' | 'suspended' | 'outOfPosition' | 'improvised';

  export interface ChipMark {
    kind: ChipMarkKind;
    /** "Fora de posição", "Improvisado", "Lesionado, 3 rodadas", already translated. */
    label: string;
  }

  export const CHIP_MARK_ICONS: Readonly<Record<ChipMarkKind, IconName>> = {
    injured: 'injury',
    suspended: 'card',
    outOfPosition: 'warning',
    improvised: 'improvised',
  };

  /**
   * - `idle`: nothing going on;
   * - `selected`: picked in the two-step swap (or lifted by keyboard); `aria-pressed`;
   * - `target`: under the finger or the mouse while dragging;
   * - `origin`: the place the dragged player left (dashed, until the drop);
   * - `refused`: the last swap into this place was refused (the reason is in the status bar).
   */
  export type ChipState = 'idle' | 'selected' | 'target' | 'origin' | 'refused';
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * LineupChip: one slot of the lineup pitch (escalacao.md). A button: a tap picks the player
   * (first step of the swap) or receives the picked one (second step); the screen does the swap.
   * Shows the slot's position code, the player's overall and short name, at most one mark (icon
   * plus text, never colour alone), the captain's "C" and, in Realismo completo, a thin condition
   * bar. Without `name` it is an empty slot. The same component, with `ghost`, is the copy that
   * follows the finger while dragging. Every text comes by prop.
   */
  interface Props {
    /** Position code of the slot ("ZAG"), from the content (`position.<P>.short`). */
    slotCode: string;
    /** Full accessible name of the button, built by the screen (`lineup.slot.a11y`). */
    a11yLabel: string;
    /** Display name; absent for an empty slot. */
    name?: string;
    overall?: number;
    /** 0..100, already rounded; only in Realismo completo. */
    condition?: number;
    mark?: ChipMark;
    /** The "C" of the armband (`lineup.captain.short`); the word is in `a11yLabel`. */
    captainShort?: string;
    /** "Vaga livre" (`lineup.slot.empty`). */
    emptyLabel?: string;
    state?: ChipState;
    /** The copy that follows the pointer while dragging: not a button, out of the a11y tree. */
    ghost?: boolean;
    /** Slot index (0..10) for the drag's hit test (`data-slot`). */
    slot?: number;
    onclick?: (event: MouseEvent) => void;
    onpointerdown?: (event: PointerEvent) => void;
    /** Id of the status bar's hint ("Toque em outro jogador..."), while something is picked. */
    describedby?: string;
  }
  const {
    slotCode,
    a11yLabel,
    name,
    overall,
    condition,
    mark,
    captainShort,
    emptyLabel,
    state = 'idle',
    ghost = false,
    slot,
    onclick,
    onpointerdown,
    describedby,
  }: Props = $props();
  const empty = $derived(name === undefined);
</script>

{#snippet inner()}
  <span class="top">
    <span class="rotulo code">{slotCode}</span>
    {#if captainShort}<span class="rotulo captain" aria-hidden="true">{captainShort}</span>{/if}
    {#if overall !== undefined}<span class="numero overall">{overall}</span>{/if}
  </span>
  <span class="caption name">{empty ? emptyLabel : name}</span>
  {#if mark}
    <span class="caption mark {mark.kind}">
      <Icon name={CHIP_MARK_ICONS[mark.kind]} size={14} />
      <span>{mark.label}</span>
    </span>
  {/if}
  {#if condition !== undefined}
    <span class="cond" aria-hidden="true"><span style="inline-size: {condition}%"></span></span>
  {/if}
  {#if state === 'selected'}
    <span class="picked"><Icon name="check" size={14} /></span>
  {:else if state === 'target'}
    <span class="picked swap"><Icon name="swap" size={14} /></span>
  {/if}
{/snippet}

{#if ghost}
  <span class="chip ghost" class:empty aria-hidden="true">{@render inner()}</span>
{:else}
  <button
    type="button"
    class="chip {state}"
    class:empty
    data-slot={slot}
    aria-label={a11yLabel}
    aria-pressed={state === 'selected'}
    aria-describedby={describedby}
    {onclick}
    {onpointerdown}
  >
    {@render inner()}
  </button>
{/if}

<style>
  .chip {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: calc(var(--space-1) / 2);
    inline-size: 100%;
    /* At least 52px high, also without the condition bar (Simplificado) and with a one-line
       name: escalacao.md, "Ao alcance do polegar" (75 × 52px at 360px). */
    min-block-size: calc(var(--touch) + var(--space-2));
    max-block-size: 100%;
    padding: calc(var(--space-1) / 2) var(--space-1);
    border: 2px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-1);
    color: var(--ink);
    text-align: start;
    /* Vertical swipes still scroll the page; the screen starts a touch drag only after a hold. */
    touch-action: manipulation;
    user-select: none;
    -webkit-touch-callout: none;
    cursor: pointer;
  }
  .chip:hover {
    background: var(--surface-2);
  }
  .chip:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .top {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
  }
  .code {
    color: var(--ink-muted);
  }
  .captain {
    display: inline-grid;
    place-items: center;
    min-inline-size: var(--space-4);
    block-size: var(--space-4);
    border-radius: var(--radius-pill);
    background: var(--ink);
    color: var(--surface-1);
    letter-spacing: 0;
  }
  .overall {
    margin-inline-start: auto;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty {
    border-style: dashed;
    background: var(--surface-0);
  }
  .empty .name {
    color: var(--ink-muted);
  }
  /* The mark: icon plus text, up to two lines ("Fora de / posição"); the pairs of the selos.
     The icon sits in the text flow, so a long word goes to the next line instead of breaking. */
  .mark {
    display: block;
    /* The condensed face of the rotulo, without its capitals: "Improvisado" fits in one line at
       360px (escalacao.md, "Marca da vaga"). */
    font: var(--type-rotulo);
    padding: 0 calc(var(--space-1) / 2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    overflow-wrap: break-word;
  }
  .mark :global(svg) {
    display: inline-block;
    vertical-align: -2px;
    margin-inline-end: calc(var(--space-1) / 2);
  }
  .injured,
  .suspended,
  .outOfPosition {
    background: var(--danger-soft);
    border-color: var(--danger);
    color: var(--ink);
  }
  .injured :global(svg),
  .suspended :global(svg),
  .outOfPosition :global(svg) {
    color: var(--danger);
  }
  .improvised {
    background: var(--floodlight);
    color: var(--on-floodlight);
  }
  .cond {
    display: block;
    block-size: var(--size-bar);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    overflow: hidden;
  }
  .cond > span {
    display: block;
    block-size: 100%;
    background: var(--grass);
  }
  /* States: a mark besides the border colour (check, swap icon, dashed line). */
  .selected {
    border-color: var(--floodlight);
    background: var(--surface-2);
  }
  .target {
    border-color: var(--grass);
    background: var(--grass-soft);
  }
  /* ink-muted is not a checked pair on grass-soft: the code goes to ink there. */
  .target .code {
    color: var(--ink);
  }
  .origin {
    border-style: dashed;
    color: var(--ink-muted);
  }
  .refused {
    border-color: var(--danger);
  }
  .picked {
    position: absolute;
    /* Top centre: the code and the C sit on the left, the overall on the right. */
    inset-block-start: calc(var(--space-3) * -1);
    inset-inline-start: 50%;
    translate: -50% 0;
    display: grid;
    place-items: center;
    inline-size: var(--space-6);
    block-size: var(--space-6);
    border-radius: var(--radius-pill);
    background: var(--floodlight);
    color: var(--on-floodlight);
  }
  .picked.swap {
    background: var(--grass);
    color: var(--on-grass);
  }
  .ghost {
    inline-size: auto;
    min-inline-size: calc(var(--touch) * 1.75);
    border-color: var(--floodlight);
    box-shadow: var(--shadow-lift);
    pointer-events: none;
    cursor: grabbing;
  }
</style>
