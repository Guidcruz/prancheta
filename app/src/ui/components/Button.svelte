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
    /**
     * 8px side padding instead of 16px, same height and minimum (componentes.md, proposal 38):
     * only in control bars with three buttons or more (the match's).
     */
    compact?: boolean;
    /**
     * A button that turns on and off (`aria-pressed`). On, a 3px `grass` line inside its base and
     * the `grass-soft` background with `ink` text, without changing its width (proposal 38).
     */
    pressed?: boolean;
    /** Minimum width in px, measured by the screen, for two labels that take turns (Pausar/Retomar). */
    minWidth?: number;
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
    compact = false,
    pressed,
    minWidth,
    onclick,
    children,
  }: Props = $props();
  const width = $derived(minWidth === undefined ? undefined : `${minWidth}px`);
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
    class:compact
    style:min-width={width}
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
    class:compact
    class:on={pressed === true}
    style:min-width={width}
    {type}
    {disabled}
    aria-pressed={pressed === undefined ? undefined : pressed}
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
  .compact {
    padding-inline: var(--space-2);
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
  /* A button that is on (proposal 38): the line at the base is the cue of shape, as the marker of
     the active tab (size-marker, 3px: componentes.md, proposal 7); the background reinforces it. */
  .on {
    background: var(--grass-soft);
    color: var(--ink);
    box-shadow: inset 0 -3px 0 var(--grass);
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
