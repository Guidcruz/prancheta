<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  /**
   * Sheet that rises from the bottom on the phone and becomes a floating dialog from 900px up,
   * anchored by its base (not centred), so the buttons at the bottom stay at the same height
   * whatever the text above them: "Cancelar" in the same place in every sheet of a flow, and the
   * final step of a confirmation measurable at both widths (design-system.md, "Passo final").
   * Built on the native modal <dialog>: focus stays inside, Esc closes. A tap on the backdrop
   * closes too. The caller owns `open` and ties it to the history (back gesture closes). No
   * motion: it appears in place.
   *
   * Head (title and close), body and the optional `footer` share the max height: only the body
   * scrolls, so the title, the close button and the footer's buttons never leave the sheet, even
   * on a phone lying down. The footer sits at the base, at the same height in every sheet, with or
   * without a footer (the last button of a sheet without one, when it fits, lands in the same
   * place); ConfirmSheet puts its buttons there (design-system.md, "Confirmação em passos").
   */
  interface Props {
    open: boolean;
    title: string;
    /** Accessible name of the close button (nav.close). */
    closeLabel: string;
    onclose: () => void;
    children: Snippet;
    /** Buttons fixed at the base of the sheet, outside the scrolling body. */
    footer?: Snippet;
  }
  const { open, title, closeLabel, onclose, children, footer }: Props = $props();
  const titleId = $props.id();
  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  function onBackdrop(event: MouseEvent): void {
    // A click whose target is the <dialog> itself landed on the backdrop, outside the panel.
    if (event.target === dialog) onclose();
  }
  function onCancel(event: Event): void {
    event.preventDefault();
    onclose();
  }
</script>

<!-- The backdrop click is a pointer shortcut; Esc (native cancel) and the close button cover the keyboard. -->
<dialog
  bind:this={dialog}
  class="sheet"
  aria-labelledby={titleId}
  oncancel={onCancel}
  onclick={onBackdrop}
>
  <div class="panel">
    <div class="head">
      <h2 class="subtitulo title" id={titleId}>{title}</h2>
      <button type="button" class="close" aria-label={closeLabel} onclick={onclose}>
        <Icon name="close" />
      </button>
    </div>
    <div class="body" class:last={!footer}>
      {@render children()}
    </div>
    {#if footer}
      <div class="foot">{@render footer()}</div>
    {/if}
  </div>
</dialog>

<style>
  .sheet {
    margin: auto auto 0;
    width: 100%;
    max-width: var(--layout-content-max);
    /* Sheet height and backdrop: no token yet: componentes.md, "Propostas ao design system". */
    max-height: 85dvh;
    padding: 0;
    border: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--surface-1);
    color: var(--ink);
  }
  .sheet::backdrop {
    background: var(--surface-0);
    opacity: 0.7;
  }
  /* Same max height as the sheet: the head and the footer stay, the body takes what is left. */
  .panel {
    display: flex;
    flex-direction: column;
    max-height: inherit;
    padding-top: var(--space-2);
  }
  .head {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-2) 0 var(--space-4);
  }
  /* The scroll container keeps the inline padding inside it, so focus rings are not clipped. */
  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 var(--space-2);
  }
  /* The base of the sheet: below the footer, or below the body when there is none. */
  .body.last,
  .foot {
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
  }
  .foot {
    flex: none;
    padding-inline: var(--space-2);
  }
  .title {
    flex: 1;
    margin: 0;
  }
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--ink);
    cursor: pointer;
  }
  .close:hover {
    background: var(--surface-2);
  }
  /* Same value as the desktop breakpoint in AppShell.svelte (no token yet: componentes.md). */
  @media (min-width: 900px) {
    .sheet {
      /* Anchored by the base, above the safe area; the top takes what is left. */
      margin: auto auto calc(var(--space-8) + env(safe-area-inset-bottom));
      /* Dialog width: no token yet: componentes.md, "Propostas ao design system". */
      max-width: calc(var(--layout-content-max) * 0.75);
      border-radius: var(--radius-lg);
    }
    /* The safe area is already in the margin below the floating dialog. */
    .body.last,
    .foot {
      padding-bottom: var(--space-4);
    }
  }
</style>
