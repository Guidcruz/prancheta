<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  /**
   * SectionCard: one block of a summary screen (Clube: Próximo jogo, Classificação, Torcida).
   * A real heading, so screen readers can jump between blocks, and an optional link to the full
   * screen at the right of the heading, a target of its own (at least 44px), never the whole card:
   * the card may hold other targets (the match card, a row link).
   */
  interface Action {
    /** "Tabela", already translated. */
    label: string;
    /** Longer accessible name when the label alone is vague ("Ver a tabela completa"). */
    a11yLabel?: string;
    href: string;
    onclick?: (event: MouseEvent) => void;
  }
  interface Props {
    title: string;
    /** h2 by default: the screen title is the h1 of the frame. */
    level?: 2 | 3;
    action?: Action;
    children: Snippet;
  }
  const { title, level = 2, action, children }: Props = $props();
  const id = $props.id();
</script>

<section class="card" aria-labelledby="{id}-title">
  <div class="head" class:with-action={action !== undefined}>
    <svelte:element this={level === 2 ? 'h2' : 'h3'} class="subtitulo title" id="{id}-title">
      {title}
    </svelte:element>
    {#if action}
      <a
        class="body-strong action"
        href={action.href}
        aria-label={action.a11yLabel}
        onclick={action.onclick}
      >
        <span>{action.label}</span>
        <Icon name="chevron-right" size={20} />
      </a>
    {/if}
  </div>
  <div class="content">{@render children()}</div>
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    box-shadow: var(--shadow-card);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  /* The link keeps its 44px height without pushing the card's top padding. */
  .with-action {
    margin-block: calc((var(--touch) - var(--space-6)) / -2);
  }
  .title {
    margin: 0;
    min-width: 0;
  }
  .action {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--touch);
    min-width: var(--touch);
    margin-inline-end: calc(var(--space-2) * -1);
    padding-inline: var(--space-2);
    border-radius: var(--radius-md);
    color: var(--ink);
    text-decoration: none;
  }
  .action:hover {
    background: var(--surface-2);
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }
</style>
