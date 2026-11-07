<script lang="ts" module>
  import type { IconName } from './Icon.svelte';

  /**
   * The closed list of badges (componentes.md, StatusBadge). Results show a letter (V/E/D in
   * pt-BR, from the content); the others an icon. Every badge has text: the colour only
   * reinforces it. New kinds enter here, never as a loose colour on a screen.
   */
  export type StatusKind =
    | 'win'
    | 'draw'
    | 'loss'
    | 'injured'
    | 'suspended'
    | 'prospect'
    | 'derby'
    | 'improvised'
    | 'outOfPosition'
    | 'leader';

  export const STATUS_ICONS: Readonly<Record<StatusKind, IconName | undefined>> = {
    win: undefined,
    draw: undefined,
    loss: undefined,
    injured: 'injury',
    suspended: 'card',
    prospect: 'star',
    derby: 'derby',
    improvised: 'improvised',
    outOfPosition: 'warning',
    leader: 'captain',
  };

  /** A badge as a screen passes it to a row or a card: kind plus its translated text. */
  export interface StatusBadgeItem {
    kind: StatusKind;
    /** "Lesionado, 3 rodadas", "Promessa", "Vitória". */
    label: string;
    /** Results only: the letter shown in the chip ("V"); `label` is then read instead. */
    short?: string;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * StatusBadge: situation, result or mark, always icon or letter plus text (or, for the
   * letter-only result chip of the last results, V E D, the full word for screen readers). One
   * size everywhere: the squad rows, the player card, the match card.
   */
  interface Props extends StatusBadgeItem {
    /** Letter only (results) with `label` as the accessible text. Ignored without `short`. */
    letterOnly?: boolean;
  }
  const { kind, label, short, letterOnly = false }: Props = $props();
  const icon = $derived(STATUS_ICONS[kind]);
  const onlyLetter = $derived(letterOnly && short !== undefined);
</script>

<span class="badge rotulo {kind}" class:letter={onlyLetter}>
  {#if short !== undefined}
    <span class="short" aria-hidden={onlyLetter ? 'true' : undefined}>{short}</span>
  {:else if icon}
    <Icon name={icon} size={14} />
  {/if}
  {#if onlyLetter}
    <span class="visually-hidden">{label}</span>
  {:else}
    <span class="text">{label}</span>
  {/if}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    max-width: 100%;
    padding: calc(var(--space-1) / 2) var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--ink);
    white-space: nowrap;
    vertical-align: middle;
  }
  .text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Letter chip: a square of the same height, for the row of the last results. */
  .letter {
    justify-content: center;
    min-width: var(--space-6);
    padding: calc(var(--space-1) / 2) var(--space-1);
  }
  .short {
    font-variant-numeric: tabular-nums;
  }
  /* Pairs checked by `npm run tokens` in both themes: on-grass/grass, ink/surface-2,
     ink/danger-soft, on-floodlight/floodlight. T-029: improvised takes the floodlight pair,
     outOfPosition the danger one (jogadores.md: yellow and red mark), leader ink/surface-2. */
  .win {
    background: var(--grass);
    color: var(--on-grass);
  }
  .draw {
    border-color: var(--draw);
  }
  .loss,
  .injured,
  .suspended,
  .outOfPosition {
    background: var(--danger-soft);
    border-color: var(--danger);
  }
  .injured :global(svg),
  .suspended :global(svg),
  .outOfPosition :global(svg) {
    color: var(--danger);
  }
  /* Leader (captain sheet): ink on surface-2 like the draw, with the plain line border. */
  .leader {
    border-color: var(--line);
  }
  .prospect,
  .derby,
  .improvised {
    background: var(--floodlight);
    color: var(--on-floodlight);
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
