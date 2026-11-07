<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * Screen title, optional back and the "Mais" menu. Reading area, no frequent action.
   * The menu icon hides from 900px up, where the sidebar already lists every entry
   * (docs/design/telas/navegacao.md).
   */
  interface Props {
    title: string;
    /** Accessible name of the back button (nav.back); without `onback` there is no back. */
    backLabel?: string;
    onback?: () => void;
    /** Accessible name of the menu button (nav.more); without `onmore` there is no menu. */
    moreLabel?: string;
    onmore?: () => void;
    /** Id of the title, so the error boundary or a sheet can point at it. */
    titleId?: string;
  }
  const { title, backLabel, onback, moreLabel, onmore, titleId }: Props = $props();
</script>

<header class="header">
  {#if onback}
    <button type="button" class="icon-btn" aria-label={backLabel} onclick={onback}>
      <Icon name="back" />
    </button>
  {/if}
  <h1 class="titulo title" id={titleId} tabindex="-1">{title}</h1>
  {#if onmore}
    <button type="button" class="icon-btn more" aria-label={moreLabel} onclick={onmore}>
      <Icon name="menu" />
    </button>
  {/if}
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: calc(var(--touch) + var(--space-3));
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-4);
  }
  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .title:focus {
    outline: none;
  }
  .title:focus-visible {
    outline: 2px solid var(--focus);
  }
  .icon-btn {
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
    color: var(--ink);
    cursor: pointer;
  }
  .icon-btn:hover {
    background: var(--surface-2);
  }
  /* Same value as the desktop breakpoint in AppShell.svelte (no token yet: componentes.md). */
  @media (min-width: 900px) {
    .more {
      display: none;
    }
  }
</style>
