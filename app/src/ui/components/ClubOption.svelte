<script lang="ts">
  import type { ShieldClub } from '@lib/generators/shield';
  import Crest from './Crest.svelte';
  import Icon from './Icon.svelte';

  /**
   * ClubOption: one club in the new-game choice (docs/design/telas/novo-jogo.md). A native radio
   * inside a card-sized label, so the whole card is the target and the arrow keys move between
   * the clubs of the same `name`. Selected: check icon, grass border and heavier surface, besides
   * the colour. The strength is a number with its label, never a colour or a bar alone.
   */
  interface Props {
    /** Radio group name, the same for every club of the screen. */
    name: string;
    club: ShieldClub;
    /** Short name ("Flamingo"). */
    label: string;
    /** "Rio de Janeiro (RJ)". */
    detail?: string;
    /** The strength shown on the new-game screen (the list's `strength`, temporada.md). */
    strength: number;
    /** "Força" (newGame.strength), shown above the number. */
    strengthLabel: string;
    /** The difficulty band in text ("Favorito"), for screen readers; the group heading shows it. */
    bandLabel?: string;
    checked: boolean;
    onselect: () => void;
  }
  const {
    name,
    club,
    label,
    detail,
    strength,
    strengthLabel,
    bandLabel,
    checked,
    onselect,
  }: Props = $props();
  const id = $props.id();
</script>

<label class="option" class:checked for={id}>
  <input
    {id}
    class="radio"
    type="radio"
    {name}
    value={club.id}
    {checked}
    onchange={onselect}
    aria-describedby={detail ? `${id}-detail ${id}-strength` : `${id}-strength`}
  />
  <Crest {club} size="md" instance="opt" />
  <span class="text">
    <span class="body-strong name">{label}</span>
    {#if detail}<span class="caption muted" id="{id}-detail">{detail}</span>{/if}
  </span>
  <span class="strength" id="{id}-strength">
    <span class="caption muted">{strengthLabel}</span>
    <span class="numero">{strength}</span>
    {#if bandLabel}<span class="sr">{bandLabel}</span>{/if}
  </span>
  <span class="mark" aria-hidden="true">
    {#if checked}<Icon name="check" size={20} />{/if}
  </span>
</label>

<style>
  .option {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: calc(var(--touch) + var(--space-4));
    padding: var(--space-2) var(--space-3);
    border: 2px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    color: var(--ink);
    cursor: pointer;
  }
  .option:hover {
    background: var(--surface-2);
  }
  .option.checked {
    border-color: var(--grass);
    background: var(--surface-2);
  }
  /* The native radio stays in the tree and takes the focus; the card shows the ring. */
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
  .text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  /* Long names in es/en wrap to two lines, never cut. */
  .name {
    overflow-wrap: anywhere;
  }
  .muted {
    color: var(--ink-muted);
  }
  .strength {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex: none;
    font-variant-numeric: tabular-nums;
  }
  .mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--space-6);
    height: var(--space-6);
    flex: none;
    border: 2px solid var(--line);
    border-radius: var(--radius-pill);
    color: var(--on-grass);
  }
  .checked .mark {
    border-color: var(--grass);
    background: var(--grass);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
