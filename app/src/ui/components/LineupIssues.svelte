<script lang="ts" module>
  import type { IconName } from './Icon.svelte';

  /**
   * What can be wrong or worth knowing in a lineup (escalacao.md, "Avisos da escalação"):
   * the first three block the round ("Jogar rodada" opens the completion sheet); the others are
   * information.
   */
  export type LineupIssueKind =
    'empty' | 'injured' | 'suspended' | 'outOfPosition' | 'improvised' | 'idol';

  export interface LineupIssue {
    kind: LineupIssueKind;
    /** "Vaga de ZAG sem jogador", "Ildo (ZAG) jogando de ATA", already translated. */
    text: string;
  }

  export const ISSUE_ICONS: Readonly<Record<LineupIssueKind, IconName>> = {
    empty: 'plus',
    injured: 'injury',
    suspended: 'card',
    outOfPosition: 'warning',
    improvised: 'improvised',
    idol: 'info',
  };

  /** Kinds that keep the round from being played as is. */
  export const BLOCKING_ISSUES: readonly LineupIssueKind[] = ['empty', 'injured', 'suspended'];
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * LineupIssues: the warnings of the lineup in plain text, one per line with its icon, under
   * the pitch (Escalação), under the formations (Tática) and in the completion sheet of "Jogar
   * rodada". It is where "Fora de posição" and "Improvisado" are written in full with the
   * player's name and both positions; the pitch shows the short mark. Without items, nothing.
   */
  interface Props {
    /** "Atenção na escalação" (`lineup.issues.title`). */
    title: string;
    items: readonly LineupIssue[];
    level?: 2 | 3;
    /** Hide the heading (the completion sheet already has a title). */
    hideTitle?: boolean;
  }
  const { title, items, level = 2, hideTitle = false }: Props = $props();
  const id = $props.id();
</script>

{#if items.length > 0}
  <section class="issues" aria-labelledby="{id}-t">
    <svelte:element
      this={`h${level}`}
      class="body-strong title"
      class:visually-hidden={hideTitle}
      id="{id}-t">{title}</svelte:element
    >
    <ul class="list">
      {#each items as item, i (i)}
        <li class="item {item.kind}" class:blocking={BLOCKING_ISSUES.includes(item.kind)}>
          <Icon name={ISSUE_ICONS[item.kind]} size={18} />
          <span class="body">{item.text}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .issues {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .title {
    margin: 0;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    color: var(--ink);
  }
  .item :global(svg) {
    margin-block-start: 2px;
    color: var(--ink-muted);
  }
  .blocking :global(svg),
  .outOfPosition :global(svg) {
    color: var(--danger);
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
