<script lang="ts">
  import Button from './Button.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import type { NoticeAction } from './actions';

  /**
   * Notice in the band under the screen header (docs/design/telas/erros-e-avisos.md). Never
   * covers the tabs or "Jogar rodada". Without `ondismiss` it cannot be closed. Its actions are
   * never `primary`: on a tabbed screen the primary is "Jogar rodada".
   */
  interface Props {
    tone?: 'info' | 'warning' | 'danger';
    title: string;
    message: string;
    actions?: readonly NoticeAction[];
    /** Accessible name of the close button; with `ondismiss`, the banner can be closed. */
    dismissLabel?: string;
    ondismiss?: () => void;
    /**
     * `false` inside a live region that already announces it (the notice band of the career
     * frame is `role="status"`): no role of its own, so the regions are not nested.
     */
    announce?: boolean;
  }
  const {
    tone = 'info',
    title,
    message,
    actions = [],
    dismissLabel,
    ondismiss,
    announce = true,
  }: Props = $props();
  const icons: Record<NonNullable<Props['tone']>, IconName> = {
    info: 'info',
    warning: 'warning',
    danger: 'error',
  };
</script>

<section
  class="banner {tone}"
  role={announce ? (tone === 'danger' ? 'alert' : 'status') : undefined}
>
  <span class="icon"><Icon name={icons[tone]} /></span>
  <div class="text">
    <p class="body-strong title">{title}</p>
    <p class="body message">{message}</p>
    {#if actions.length > 0}
      <div class="actions">
        {#each actions as action, i (action.label)}
          <Button
            variant={i === 0 ? 'secondary' : 'ghost'}
            icon={action.icon}
            href={'href' in action ? action.href : undefined}
            external={'href' in action ? action.external : false}
            externalLabel={'href' in action ? action.externalLabel : undefined}
            onclick={'onclick' in action ? action.onclick : undefined}>{action.label}</Button
          >
        {/each}
      </div>
    {/if}
  </div>
  {#if ondismiss}
    <button type="button" class="dismiss" aria-label={dismissLabel} onclick={ondismiss}>
      <Icon name="close" />
    </button>
  {/if}
</section>

<style>
  .banner {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-2) var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    border-left: 4px solid var(--info);
    background: var(--surface-1);
    color: var(--ink);
    box-shadow: var(--shadow-card);
  }
  .icon {
    display: flex;
    padding-top: var(--space-1);
    color: var(--info);
  }
  .danger {
    border-left-color: var(--danger);
  }
  .danger .icon {
    color: var(--danger);
  }
  .warning {
    border-left-color: var(--floodlight);
    background: var(--floodlight);
    color: var(--on-floodlight);
  }
  .warning .icon {
    color: var(--on-floodlight);
  }
  .text {
    flex: 1;
    min-width: 0;
    padding-top: var(--space-1);
  }
  p {
    margin: 0;
  }
  .message {
    margin-top: var(--space-1);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  /* On the warning tone the buttons keep the dark ink of the floodlight pair. */
  .warning .actions :global(.btn) {
    color: var(--on-floodlight);
    border-color: var(--on-floodlight);
    background: transparent;
  }
  /* The noite focus ring is floodlight too: on this tone it switches to the dark ink. */
  .warning :global(:focus-visible) {
    outline-color: var(--on-floodlight);
  }
  .dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--touch);
    height: var(--touch);
    flex: none;
    padding: 0;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
</style>
