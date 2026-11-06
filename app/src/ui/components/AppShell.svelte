<script lang="ts">
  import type { Snippet } from 'svelte';
  import { config } from '@lib/config';
  import TabBar, { type TabItem } from './TabBar.svelte';
  import PlayRoundButton from './PlayRoundButton.svelte';

  /**
   * Frame of the career (docs/design/telas/navegacao.md). Phone: header, notices, scrolling
   * content, "Jogar rodada" floating above the bottom tab bar. From 900px: sidebar with the same
   * destinations plus the extra ones and "Jogar rodada" at its foot. Both layouts are in the DOM
   * and CSS shows one, so nothing flashes on load; the hidden one is out of the a11y tree.
   */
  interface PlayRound {
    state: 'ready' | 'blocked' | 'busy';
    label: string;
    hint?: string;
    busyLabel?: string;
    onplay?: () => void;
  }
  interface Props {
    /** Clube, Elenco, Tabela, Calendário (NAV_TABS), already translated. */
    tabs: readonly TabItem[];
    /** Notícias and Rede social (NAV_EXTRA): sidebar only. */
    sideExtra?: readonly TabItem[];
    /** Carreiras e backup, Preferências, Sobre (NAV_SETTINGS): sidebar only. */
    sideSettings?: readonly TabItem[];
    current: string;
    onselect?: (id: string, event: MouseEvent) => void;
    /** The player's club in the sidebar header; `crestSvg` comes from the shield generator. */
    club?: { name: string; crestSvg: string };
    playRound: PlayRound;
    /** Accessible name of the navigation (nav.label). */
    navLabel: string;
    /** "Pular para o conteúdo" (nav.skip). */
    skipLabel: string;
    /** Wider content (Tabela, Elenco on desktop). */
    wide?: boolean;
    header?: Snippet;
    notices?: Snippet;
    children: Snippet;
  }
  const {
    tabs,
    sideExtra = [],
    sideSettings = [],
    current,
    onselect,
    club,
    playRound,
    navLabel,
    skipLabel,
    wide = false,
    header,
    notices,
    children,
  }: Props = $props();
</script>

<div class="shell">
  <a class="skip body-strong" href="#main">{skipLabel}</a>

  <aside class="side">
    <div class="brand">
      {#if config.logo.hasBrand}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG from config/prancheta.config.ts, never user input -->
        <span class="logo" aria-hidden="true">{@html config.logo.mark}</span>
      {/if}
      <span class="subtitulo app-name">{config.name}</span>
    </div>
    {#if club}
      <div class="club">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG from our shield generator, never user input -->
        <span class="crest" aria-hidden="true">{@html club.crestSvg}</span>
        <span class="body-strong">{club.name}</span>
      </div>
    {/if}
    <nav class="side-nav" aria-label={navLabel}>
      <TabBar items={tabs} {current} orientation="side" {onselect} />
      {#if sideExtra.length > 0}
        <hr />
        <TabBar items={sideExtra} {current} orientation="side" {onselect} />
      {/if}
      {#if sideSettings.length > 0}
        <hr />
        <TabBar items={sideSettings} {current} orientation="side" {onselect} />
      {/if}
    </nav>
    <div class="side-play">
      <PlayRoundButton {...playRound} placement="side" />
    </div>
  </aside>

  <div class="column" class:wide>
    {@render header?.()}
    {#if notices}
      <div class="notices">{@render notices()}</div>
    {/if}
    <main id="main" tabindex="-1">
      {@render children()}
    </main>
  </div>

  <div class="dock">
    <div class="dock-play">
      <PlayRoundButton {...playRound} placement="float" />
    </div>
    <nav class="dock-nav" aria-label={navLabel}>
      <TabBar items={tabs} {current} orientation="bottom" {onselect} />
    </nav>
  </div>
</div>

<style>
  .shell {
    /* Height of the phone tab bar and of the floating button, from the touch token. */
    --tabbar-h: calc(var(--touch) + var(--space-3));
    --play-h: calc(var(--touch) + var(--space-2));
    --side-w: 272px;
    min-height: 100dvh;
  }
  .skip {
    position: absolute;
    left: var(--space-2);
    top: var(--space-2);
    z-index: 3;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    color: var(--ink);
    transform: translateY(-200%);
  }
  .skip:focus {
    transform: none;
  }
  .column {
    min-width: 0;
  }
  .notices {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0 var(--space-4) var(--space-2);
  }
  main {
    padding: 0 var(--space-4);
    /* Room under the last item: tab bar + floating button + air; nothing hides behind them. */
    padding-bottom: calc(var(--tabbar-h) + var(--play-h) + var(--space-8));
  }
  main:focus {
    outline: none;
  }

  .side {
    display: none;
  }
  .dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    pointer-events: none;
  }
  .dock-play {
    display: flex;
    justify-content: center;
    padding-bottom: var(--space-3);
  }
  .dock-play :global(button) {
    pointer-events: auto;
  }
  .dock-nav {
    pointer-events: auto;
    background: var(--surface-1);
    border-top: 1px solid var(--line);
    padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }

  /* Desktop breakpoint (docs/02-architecture.md, 3). No token yet: componentes.md, proposal 1. */
  @media (min-width: 900px) {
    .shell {
      display: grid;
      grid-template-columns: var(--side-w) minmax(0, 1fr);
    }
    .dock {
      display: none;
    }
    .side {
      position: sticky;
      top: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      height: 100dvh;
      overflow-y: auto;
      padding: var(--space-6) var(--space-3) var(--space-4);
      background: var(--surface-1);
      border-right: 1px solid var(--line);
    }
    .brand,
    .club {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: 0 var(--space-3);
    }
    .logo,
    .crest {
      display: block;
      width: 32px;
      height: 32px;
      flex: none;
    }
    .crest :global(svg) {
      width: 100%;
      height: 100%;
    }
    .side-nav {
      flex: 1;
    }
    hr {
      margin: var(--space-2) var(--space-3);
      border: 0;
      border-top: 1px solid var(--line);
    }
    .column {
      width: 100%;
      max-width: calc(var(--layout-content-max) + 2 * var(--space-6));
      padding: var(--space-4) var(--space-6) 0;
    }
    .column.wide {
      max-width: calc(var(--layout-wide-max) + 2 * var(--space-6));
    }
    .notices,
    main {
      padding-left: 0;
      padding-right: 0;
    }
    main {
      padding-bottom: var(--space-8);
    }
  }
</style>
