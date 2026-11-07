<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';

  /**
   * EmptyState: an empty list (no careers, no news...). Icon, title, a sentence and the action,
   * which the caller passes (on the home screen it is the screen's primary, "Nova carreira").
   */
  interface Props {
    icon?: IconName;
    title: string;
    message?: string;
    children?: Snippet;
  }
  const { icon = 'club', title, message, children }: Props = $props();
</script>

<section class="empty">
  <span class="badge"><Icon name={icon} size={32} /></span>
  <h2 class="subtitulo">{title}</h2>
  {#if message}<p class="body message">{message}</p>{/if}
  {#if children}<div class="actions">{@render children()}</div>{/if}
</section>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-6) var(--space-4);
    text-align: center;
    border: 1px dashed var(--line);
    border-radius: var(--radius-md);
  }
  .badge {
    display: inline-flex;
    padding: var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--grass);
  }
  h2,
  p {
    margin: 0;
  }
  .message {
    color: var(--ink-muted);
    max-width: 36ch;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
    margin-top: var(--space-2);
  }
</style>
