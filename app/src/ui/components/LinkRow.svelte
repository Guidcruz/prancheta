<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';

  /** A menu or settings row, at least 44px tall; the whole row is the target. */
  interface Props {
    label: string;
    icon?: IconName;
    /** Current value shown on the right (e.g. the theme), already translated. */
    value?: string;
    href?: string;
    external?: boolean;
    /** Accessible hint for external links, already translated. */
    externalLabel?: string;
    onclick?: (event: MouseEvent) => void;
  }
  const { label, icon, value, href, external = false, externalLabel, onclick }: Props = $props();
</script>

{#snippet inner()}
  {#if icon}<Icon name={icon} size={22} />{/if}
  <span class="body-strong label">{label}</span>
  {#if value}<span class="body value">{value}</span>{/if}
  <Icon
    name={external ? 'external' : 'chevron-right'}
    size={20}
    label={external ? externalLabel : undefined}
  />
{/snippet}

{#if href}
  <a
    class="row"
    class:with-value={!!value}
    {href}
    target={external ? '_blank' : undefined}
    rel={external ? 'noopener noreferrer' : undefined}
    {onclick}>{@render inner()}</a
  >
{:else}
  <button type="button" class="row" class:with-value={!!value} {onclick}>{@render inner()}</button>
{/if}

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--touch);
    padding: var(--space-2) var(--space-4);
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--ink);
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }
  .row:hover {
    background: var(--surface-2);
  }
  /* Without a value the label takes the row and wraps inside it ("Desfalques: 2 lesionados, 1
     suspenso" at 360px). */
  .label {
    flex: 1;
    min-width: 0;
  }
  /* With a value, the value takes the cut, with an ellipsis ("Automático: Ildo Albuque…",
     tatica.md): its shrink factor dwarfs the label's, so the label keeps its line ("Tiros
     libres" at 360px). A label longer than the row still shrinks, down to its longest word, once
     the value is gone. */
  .with-value .label {
    flex: 1 1 auto;
    min-width: auto;
  }
  .value {
    flex: 0 100000 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink-muted);
  }
  .row > :global(svg) {
    flex: none;
  }
  .row > :global(svg:last-child) {
    color: var(--ink-muted);
  }
</style>
