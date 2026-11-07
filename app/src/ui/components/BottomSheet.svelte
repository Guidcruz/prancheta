<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  /**
   * Sheet that rises from the bottom on the phone and becomes a floating dialog from 900px up,
   * anchored by its base (not centred), so the buttons at the bottom stay at the same height
   * whatever the text above them: "Cancelar" in the same place in every sheet of a flow, and the
   * final step of a confirmation measurable at both widths (design-system.md, "Passo final").
   * Built on the native modal <dialog>: focus stays inside, Esc closes; it scrolls when taller
   * than its max height. A tap on the backdrop closes too. The caller owns `open` and ties it to
   * the history (back gesture closes). No motion: it appears in place.
   */
  interface Props {
    open: boolean;
    title: string;
    /** Accessible name of the close button (nav.close). */
    closeLabel: string;
    onclose: () => void;
    children: Snippet;
  }
  const { open, title, closeLabel, onclose, children }: Props = $props();
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
    <div class="body">
      {@render children()}
    </div>
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
  .panel {
    padding: var(--space-2) var(--space-2) calc(var(--space-4) + env(safe-area-inset-bottom));
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-left: var(--space-2);
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
    .panel {
      padding-bottom: var(--space-4);
    }
  }
</style>
