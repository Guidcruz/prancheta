<script lang="ts" module>
  import type { IconName } from './Icon.svelte';

  export interface TabItem {
    id: string;
    /** Already translated (nav.tab.*). */
    label: string;
    icon: IconName;
    /** An address in the history, so the phone's back gesture works. */
    href: string;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * TabBar (BarraAbas). `bottom`: fixed tab bar on the phone. `side`: list in the desktop
   * sidebar. The active tab has a marker besides the colour, and aria-current="page".
   */
  interface Props {
    items: readonly TabItem[];
    current: string;
    orientation?: 'bottom' | 'side';
    /** Lets the caller route by state instead of following the link. */
    onselect?: (id: string, event: MouseEvent) => void;
  }
  const { items, current, orientation = 'bottom', onselect }: Props = $props();
</script>

<ul class="tabs {orientation}">
  {#each items as item (item.id)}
    <li>
      <a
        class="tab"
        href={item.href}
        aria-current={item.id === current ? 'page' : undefined}
        onclick={onselect ? (event) => onselect(item.id, event) : undefined}
      >
        <Icon name={item.icon} size={orientation === 'bottom' ? 24 : 22} />
        <span class={orientation === 'bottom' ? 'rotulo' : 'body-strong'}>{item.label}</span>
      </a>
    </li>
  {/each}
</ul>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .tab {
    position: relative;
    display: flex;
    align-items: center;
    min-height: var(--touch);
    color: var(--ink-muted);
    text-decoration: none;
  }
  .tab[aria-current='page'] {
    color: var(--grass);
  }
  /* The active tab is marked by weight too, not only by colour and the bar (navegacao.md):
     the inactive labels drop from the 700 of .rotulo to 600 (both weights are bundled). */
  .bottom .tab:not([aria-current='page']) span {
    font-weight: 600;
  }

  /* Phone: four equal tabs, icon over label; the marker is a bar on top. */
  .bottom {
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
  }
  .bottom .tab {
    flex-direction: column;
    justify-content: center;
    gap: var(--space-1);
    min-height: calc(var(--touch) + var(--space-3));
    padding: var(--space-2) var(--space-1);
    text-align: center;
    /* Labels wrap to two lines in es/en instead of being cut. */
    overflow-wrap: anywhere;
  }
  .bottom .tab[aria-current='page']::before {
    content: '';
    position: absolute;
    top: 0;
    left: 25%;
    right: 25%;
    /* Marker thickness: no token yet: componentes.md, "Propostas ao design system". */
    height: 3px;
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    background: var(--grass);
  }

  /* Desktop sidebar: icon beside label; the marker is a bar on the left plus a pill. */
  .side {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .side .tab {
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    color: var(--ink);
  }
  .side .tab:hover {
    background: var(--surface-2);
  }
  .side .tab[aria-current='page'] {
    background: var(--surface-2);
    color: var(--ink);
  }
  .side .tab[aria-current='page'] :global(svg) {
    color: var(--grass);
  }
  .side .tab[aria-current='page']::before {
    content: '';
    position: absolute;
    left: 0;
    top: var(--space-2);
    bottom: var(--space-2);
    width: var(--space-1);
    border-radius: var(--radius-pill);
    background: var(--grass);
  }
</style>
