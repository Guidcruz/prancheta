<script lang="ts">
  import type { Snippet } from 'svelte';
  import BottomSheet from './BottomSheet.svelte';
  import Button from './Button.svelte';
  import type { NoticeAction } from './actions';

  /**
   * ConfirmSheet: a confirmation over the BottomSheet (delete a career in two steps, replace an
   * imported save, external link). The confirm button comes first and the cancel last, at the
   * bottom, in the thumb's reach; the focus starts on the sheet's close button, never on the
   * confirm (BottomSheet opens with the native `showModal`, which focuses the first control).
   * The two steps of a delete are two uses of this component, driven by the screen.
   *
   * `cancelFirst` puts cancel above the confirm: the last step of a delete uses it so its
   * destructive button is never where the button of the step before was (a double tap would
   * land on it; T-025 review). The screen also ignores taps right after a sheet opens.
   */
  interface Props {
    open: boolean;
    title: string;
    message: string;
    /** What is being confirmed (e.g. the career's crest, club and season). */
    subject?: Snippet;
    confirmLabel: string;
    /** `danger` for a destructive action; `secondary` for a step that destroys nothing yet. */
    confirmVariant?: 'danger' | 'secondary';
    /** Other ways out before confirming (e.g. "Exportar antes", T-020). Shown above confirm. */
    extra?: readonly NoticeAction[];
    cancelLabel: string;
    /** Accessible name of the close button (nav.close). */
    closeLabel: string;
    busy?: boolean;
    busyLabel?: string;
    /** An error of the confirmation itself, in text ("Nada foi apagado..."). */
    error?: string;
    /** Cancel above the confirm (the last step of a delete). */
    cancelFirst?: boolean;
    onconfirm: () => void;
    oncancel: () => void;
  }
  const {
    open,
    title,
    message,
    subject,
    confirmLabel,
    confirmVariant = 'danger',
    extra = [],
    cancelLabel,
    closeLabel,
    busy = false,
    busyLabel,
    error,
    cancelFirst = false,
    onconfirm,
    oncancel,
  }: Props = $props();
</script>

{#snippet cancel()}
  <Button variant="ghost" fullWidth disabled={busy} onclick={oncancel}>{cancelLabel}</Button>
{/snippet}

<BottomSheet {open} {title} {closeLabel} onclose={oncancel}>
  <div class="content">
    {#if subject}<div class="subject">{@render subject()}</div>{/if}
    <p class="body message">{message}</p>
    <p class="body error" aria-live="polite">{error ?? ''}</p>
    <div class="actions">
      {#each extra as item (item.label)}
        <Button
          variant="secondary"
          fullWidth
          icon={item.icon}
          href={'href' in item ? item.href : undefined}
          onclick={'onclick' in item ? item.onclick : undefined}>{item.label}</Button
        >
      {/each}
      {#if cancelFirst}{@render cancel()}{/if}
      <Button
        variant={confirmVariant}
        fullWidth
        {busy}
        {busyLabel}
        icon={confirmVariant === 'danger' ? 'trash' : undefined}
        onclick={onconfirm}>{confirmLabel}</Button
      >
      {#if !cancelFirst}{@render cancel()}{/if}
    </div>
  </div>
</BottomSheet>

<style>
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-2) 0;
  }
  .subject {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-2);
  }
  p {
    margin: 0;
  }
  .message {
    color: var(--ink);
  }
  /* Empty, it takes no room but stays in the tree, so the live region announces the failure. */
  .error:empty {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
