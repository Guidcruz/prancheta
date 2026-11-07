<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';

  /** Button (Botao). One `primary` per screen; every label comes in already translated. */
  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    /** Keeps the width and shows a still mark plus `busyLabel` for screen readers. */
    busy?: boolean;
    busyLabel?: string;
    disabled?: boolean;
    fullWidth?: boolean;
    icon?: IconName;
    /** Renders a link that looks like a button (navigation, external help page). */
    href?: string;
    external?: boolean;
    /** Accessible hint for external links ("opens in a new tab"), already translated. */
    externalLabel?: string;
    type?: 'button' | 'submit';
    /** Id of the text that explains the button (e.g. why it is disabled). */
    describedby?: string;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  }
  const {
    variant = 'secondary',
    busy = false,
    busyLabel,
    disabled = false,
    fullWidth = false,
    icon,
    href,
    external = false,
    externalLabel,
    type = 'button',
    describedby,
    onclick,
    children,
  }: Props = $props();
</script>

{#snippet inner()}
  {#if busy}
    <span class="spinner" aria-hidden="true"></span>
  {:else if icon}
    <Icon name={icon} size={20} />
  {/if}
  <span class="label">{@render children()}</span>
  {#if external}
    <Icon name="external" size={18} label={externalLabel} />
  {/if}
  {#if busy && busyLabel}
    <span class="visually-hidden" role="status">{busyLabel}</span>
  {/if}
{/snippet}

{#if href && !disabled}
  <a
    class="btn botao {variant}"
    class:full={fullWidth}
    {href}
    target={external ? '_blank' : undefined}
    rel={external ? 'noopener noreferrer' : undefined}
    {onclick}
  >
    {@render inner()}
  </a>
{:else}
  <button
    class="btn botao {variant}"
    class:full={fullWidth}
    {type}
    {disabled}
    aria-busy={busy || undefined}
    aria-describedby={describedby}
    onclick={busy ? undefined : onclick}
  >
    {@render inner()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--touch);
    min-width: var(--touch);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    border: 2px solid transparent;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    /* Long labels in es/en wrap to two lines instead of being cut. */
    white-space: normal;
  }
  .full {
    width: 100%;
  }
  .label {
    min-width: 0;
  }
  .primary {
    background: var(--grass);
    color: var(--on-grass);
  }
  .secondary {
    background: var(--surface-2);
    color: var(--ink);
    border-color: var(--line);
  }
  .ghost {
    background: transparent;
    color: var(--ink);
  }
  .danger {
    background: transparent;
    color: var(--ink);
    border-color: var(--danger);
  }
  .btn:disabled {
    cursor: not-allowed;
    background: var(--surface-2);
    color: var(--ink-muted);
    border-color: var(--line);
  }
  .btn[aria-busy='true'] {
    cursor: progress;
  }
  .spinner {
    /* The size of the button's icon (Icon size 20); no icon-size token yet: componentes.md,
       "Propostas ao design system". */
    width: 20px;
    height: 20px;
    flex: none;
    border-radius: var(--radius-pill);
    border: 2px solid currentColor;
    border-right-color: transparent;
    /* Duration waits for the motion tokens (componentes.md, proposal 2); app.css stops it
       under prefers-reduced-motion and the still ring stays as the busy mark. */
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
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
