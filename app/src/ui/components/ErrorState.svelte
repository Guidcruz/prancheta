<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import type { NoticeAction } from './actions';

  /**
   * Error with a clear way out (docs/design/telas/erros-e-avisos.md).
   * - `screen`: the whole viewport, no tabs (career does not open, two tabs). Its first action
   *   is the screen's primary.
   * - `area`: fills the content area inside the career frame (error boundary). "Jogar rodada"
   *   stays the primary, so the first action here is secondary.
   * - `block`: in place of one block or list.
   */
  interface Props {
    layout?: 'screen' | 'area' | 'block';
    title: string;
    message: string;
    /** A second line, e.g. "the last round was not saved". */
    extra?: string;
    /** Already labelled, e.g. "Código: conflict". Only the code, never a stack. */
    code?: string;
    primary?: NoticeAction;
    secondary?: readonly NoticeAction[];
  }
  const {
    layout = 'block',
    title,
    message,
    extra,
    code,
    primary,
    secondary = [],
  }: Props = $props();
  const titleId = $props.id();
  let heading: HTMLElement | undefined = $state();

  // Full-screen errors take the focus, so a screen reader announces them at once.
  $effect(() => {
    if (layout !== 'block') heading?.focus();
  });
</script>

{#snippet action(item: NoticeAction, variant: 'primary' | 'secondary' | 'ghost')}
  <Button
    {variant}
    fullWidth={layout !== 'block'}
    icon={item.icon}
    href={'href' in item ? item.href : undefined}
    external={'href' in item ? item.external : false}
    externalLabel={'href' in item ? item.externalLabel : undefined}
    onclick={'onclick' in item ? item.onclick : undefined}>{item.label}</Button
  >
{/snippet}

<section class="error {layout}" role="alert" aria-labelledby={titleId}>
  <span class="badge"><Icon name="error" size={layout === 'block' ? 24 : 32} /></span>
  <h2
    class={layout === 'block' ? 'subtitulo' : 'titulo'}
    id={titleId}
    tabindex="-1"
    bind:this={heading}
  >
    {title}
  </h2>
  <p class="body message">{message}</p>
  {#if extra}<p class="body-strong">{extra}</p>{/if}
  {#if primary || secondary.length > 0}
    <div class="actions">
      {#if primary}
        {@render action(primary, layout === 'screen' ? 'primary' : 'secondary')}
      {/if}
      {#each secondary as item (item.label)}
        {@render action(item, 'ghost')}
      {/each}
    </div>
  {/if}
  {#if code}<p class="caption code">{code}</p>{/if}
</section>

<style>
  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    text-align: center;
    color: var(--ink);
  }
  .screen {
    justify-content: center;
    min-height: 100dvh;
    max-width: calc(var(--layout-content-max) * 0.6);
    margin: 0 auto;
    padding: var(--space-8) var(--space-4) calc(var(--space-8) + env(safe-area-inset-bottom));
  }
  .area {
    justify-content: center;
    min-height: 60dvh;
    max-width: calc(var(--layout-content-max) * 0.6);
    margin: 0 auto;
    padding: var(--space-8) 0;
  }
  .block {
    padding: var(--space-6) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--danger);
  }
  h2,
  p {
    margin: 0;
  }
  h2:focus {
    outline: none;
  }
  .message {
    color: var(--ink-muted);
  }
  .actions {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
    width: 100%;
    margin-top: var(--space-3);
  }
  .block .actions {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
  }
  .code {
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
