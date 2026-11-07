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
    {href}
    target={external ? '_blank' : undefined}
    rel={external ? 'noopener noreferrer' : undefined}
    {onclick}>{@render inner()}</a
  >
{:else}
  <button type="button" class="row" {onclick}>{@render inner()}</button>
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
  /* The label keeps at least its longest word; a long value is the one cut, with an ellipsis
     ("Automático: Ildo Albuque…", tatica.md). Without a value the label takes the row. */
  .label {
    flex: 1 1 auto;
  }
  .value {
    flex: 0 1 auto;
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
