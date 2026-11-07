<script lang="ts">
  import type { Snippet } from 'svelte';
  import BottomSheet from './BottomSheet.svelte';
  import Button from './Button.svelte';
  import type { NoticeAction } from './actions';

  /**
   * ConfirmSheet: a confirmation over the BottomSheet (delete a career in two steps, replace an
   * imported save, external link). The confirm button comes first and the cancel always last, at
   * the bottom, in the thumb's reach and in the same place in every sheet of a flow; the focus
   * starts on the sheet's close button, never on the confirm (BottomSheet opens with the native
   * `showModal`, which focuses the first control). The steps of a delete are uses of this
   * component, driven by the screen.
   *
   * `finalStep` marks the last step of a multi-step confirmation (the destructive one). Cancel
   * stays last, but it is set apart below a divider, which lifts the confirm by one touch target
   * plus a gap (61px on the phone): the destructive button never lands where the main button of
   * the step before was, so a double tap or a reflex tap at the bottom hits empty space or
   * cancel (inicio.md, "Apagar com confirmação dupla"). The screen also ignores taps on the
   * confirm right after a sheet opens.
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
    /** The last, destructive step of a multi-step confirmation: cancel set apart below. */
    finalStep?: boolean;
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
    finalStep = false,
    onconfirm,
    oncancel,
  }: Props = $props();
</script>

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
      <Button
        variant={confirmVariant}
        fullWidth
        {busy}
        {busyLabel}
        icon={confirmVariant === 'danger' ? 'trash' : undefined}
        onclick={onconfirm}>{confirmLabel}</Button
      >
      <div class="cancel" class:apart={finalStep}>
        <Button variant="ghost" fullWidth disabled={busy} onclick={oncancel}>{cancelLabel}</Button>
      </div>
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
  .cancel {
    display: flex;
    flex-direction: column;
  }
  /* Last step: one touch target plus space-4 between the confirm and cancel (half above the
     divider, half below), so the confirm sits higher than the main button of the step before. */
  .apart {
    margin-top: calc((var(--touch) + var(--space-4)) / 2);
    padding-top: calc((var(--touch) + var(--space-4)) / 2);
    border-top: 1px solid var(--line);
  }
</style>
