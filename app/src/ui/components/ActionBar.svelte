<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * ActionBar: the bar fixed at the bottom of a full screen without tabs (new game), with what is
   * chosen on the left and the screen's primary on the right, in the thumb's reach. On the phone it
   * is fixed over the safe area; from 900px it sticks to the bottom of the content column. On the
   * phone the screen leaves room under its last item: `calc(var(--touch) + 2 * var(--space-3) +
   * var(--space-6) + env(safe-area-inset-bottom))`, so nothing hides behind the bar.
   */
  interface Props {
    /** What is chosen (crest + club name) or why the action is not available yet. */
    summary: Snippet;
    /** The primary button. */
    children: Snippet;
    /** Id of the summary, so the disabled button can point at the reason (`aria-describedby`). */
    summaryId?: string;
  }
  const { summary, children, summaryId }: Props = $props();
</script>

<div class="bar">
  <div class="inner">
    <div class="summary" id={summaryId}>{@render summary()}</div>
    <div class="action">{@render children()}</div>
  </div>
</div>

<style>
  .bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    background: var(--surface-1);
    border-top: 1px solid var(--line);
    padding: var(--space-3) calc(var(--space-4) + env(safe-area-inset-right))
      calc(var(--space-3) + env(safe-area-inset-bottom))
      calc(var(--space-4) + env(safe-area-inset-left));
  }
  .inner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    max-width: var(--layout-wide-max);
    margin: 0 auto;
  }
  .summary {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
  }
  .action {
    flex: none;
    max-width: 60%;
  }
  /* Desktop breakpoint (docs/02-architecture.md, 3). No token yet: componentes.md, proposal 1. */
  @media (min-width: 900px) {
    .bar {
      position: sticky;
      margin-top: var(--space-6);
      border: 1px solid var(--line);
      border-bottom: 0;
      border-radius: var(--radius-md) var(--radius-md) 0 0;
      box-shadow: var(--shadow-card);
      padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom));
    }
  }
</style>
