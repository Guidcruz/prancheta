<script lang="ts">
  import type { ShieldClub } from '@lib/generators/shield';
  import Crest from './Crest.svelte';

  /**
   * GoalCelebration (componentes.md, "Casca da T-032 e da T-085"; proposal 39, approved by the CEO
   * on 2026-11-15): at the outcome of a goal of either side, a card over the bottom of the pitch
   * with the crest of the club that scored, the word of the celebration and the scorer, for the
   * step "after a goal". It repeats the commentary and the screen reader's sentence, so it is
   * `aria-hidden` and takes no touch. The only element of the match that enters with an
   * animation: scale 0.92 to 1 and opacity 0 to 1 in 200 ms ease-out (the duration stays here
   * until the motion group of tokens exists, proposal 2); still with `still` or
   * `prefers-reduced-motion`. It leaves with no animation: the screen takes it away.
   */
  interface Props {
    /** The club that scored (a ClubDef fits), for the Crest `md`. */
    club: ShieldClub;
    /** "Gol!", in `display-lg`. */
    title: string;
    /** The scorer, in `subtitulo`, up to 2 lines; absent with the pitch under 200px tall. */
    scorer?: string;
    still?: boolean;
    /** Distinct gradient ids from the crests of the board. */
    instance?: string;
  }
  const { club, title, scorer, still = false, instance = 'celebration' }: Props = $props();
</script>

<div class="celebration" class:still aria-hidden="true">
  <Crest {club} size="md" {instance} />
  <div class="text">
    <span class="display-lg title">{title}</span>
    {#if scorer !== undefined}
      <span class="subtitulo scorer">{scorer}</span>
    {/if}
  </div>
</div>

<style>
  .celebration {
    position: absolute;
    left: 50%;
    bottom: var(--space-3);
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    box-sizing: border-box;
    width: max-content;
    max-width: calc(100% - 2 * var(--space-4));
    padding: var(--space-3);
    background: var(--surface-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    color: var(--ink);
    pointer-events: none;
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .title {
    white-space: nowrap;
  }
  /* At most 2 lines, cut between lines and with no ellipsis (partida.md, "Comemoração"): a third
     line is never drawn. The 24px is the line height of the token `subtitulo` (--type-subtitulo,
     600 20px/24px), written here until the token script exports it on its own. */
  .scorer {
    max-height: calc(2 * 24px);
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  /* Proposal 39: 200 ms ease-out, only for whoever has not asked for reduced motion. */
  @media (prefers-reduced-motion: no-preference) {
    .celebration:not(.still) {
      animation: celebrate 200ms ease-out both;
    }
  }
  @keyframes celebrate {
    from {
      opacity: 0;
      scale: 0.92;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }
</style>
