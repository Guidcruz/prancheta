<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * OptionsSummary: the new game's options folded into one card with the current values and
   * "Alterar" (docs/design/telas/novo-jogo.md). The whole card is one button (at least 44px) that
   * opens the options sheet; its accessible name reads the title, every value and the action.
   */
  interface Props {
    /** "Opções da carreira". */
    title: string;
    /** `{ label: "Técnico", value: "Professor" }`..., already translated. */
    items: readonly { label: string; value: string }[];
    /** "Alterar". */
    actionLabel: string;
    /** A problem with one of the values (invalid nickname), in text. */
    problem?: string;
    onclick: () => void;
  }
  const { title, items, actionLabel, problem, onclick }: Props = $props();
</script>

<button type="button" class="summary" class:problem {onclick}>
  <span class="head">
    <span class="rotulo muted">{title}</span>
    <span class="action body-strong"><Icon name="edit" size={18} />{actionLabel}</span>
  </span>
  <span class="items">
    {#each items as item (item.label)}
      <span class="item body">
        <span class="muted">{item.label}</span>
        <span class="body-strong value">{item.value}</span>
      </span>
    {/each}
  </span>
  {#if problem}
    <span class="body problem-line"><Icon name="error" size={18} />{problem}</span>
  {/if}
</button>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
    min-height: var(--touch);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    box-shadow: var(--shadow-card);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .summary:hover {
    background: var(--surface-2);
  }
  .summary.problem {
    border-color: var(--danger);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--info);
  }
  .items {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-4);
  }
  .item {
    display: inline-flex;
    gap: var(--space-1);
    min-width: 0;
  }
  .value {
    overflow-wrap: anywhere;
  }
  .muted {
    color: var(--ink-muted);
  }
  .problem-line {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .problem-line :global(svg) {
    margin-top: var(--space-1);
    color: var(--danger);
  }
</style>
