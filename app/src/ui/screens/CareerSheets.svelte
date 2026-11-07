<script lang="ts">
  import type { Lang } from '@lib/config';
  import { t } from '@lib/i18n';
  import BottomSheet from '../components/BottomSheet.svelte';
  import Button from '../components/Button.svelte';
  import ConfirmSheet from '../components/ConfirmSheet.svelte';
  import Crest from '../components/Crest.svelte';
  import { progressLine } from '../career-lines';
  import type { DeleteState } from '../delete-flow';

  /**
   * The sheets of a career's "Mais ações" and of its delete in two steps (inicio.md, saves.md),
   * driven by the DeleteFlow of the screen. Only the sheet of the current step is mounted, so
   * each one opens with `showModal` and its close button takes the focus, never the delete.
   */
  interface Props {
    lang: Lang;
    flow: DeleteState;
    /** The career open in the frame: its actions say how to delete it instead of offering it. */
    currentId?: string;
    onchoose: () => void;
    onproceed: () => void;
    onconfirm: () => void;
    oncancel: () => void;
  }
  const { lang, flow, currentId, onchoose, onproceed, onconfirm, oncancel }: Props = $props();
</script>

{#if flow.stage !== 'idle'}
  {@const club = flow.career.club.shortName}
  {@const progress = progressLine(flow.career, lang)}
  {#snippet subject()}
    <Crest club={flow.career.club} size="md" instance="sheet" />
    <span class="who">
      <span class="body-strong">{club}</span>
      <span class="body progress">{progress}</span>
    </span>
  {/snippet}
  {#if flow.stage === 'actions'}
    <BottomSheet
      open
      title={t('home.career.actionsTitle', lang, { club })}
      closeLabel={t('nav.close', lang)}
      onclose={oncancel}
    >
      <div class="actions">
        {#if flow.career.id === currentId}
          <p class="body note">{t('saves.current.noDelete', lang)}</p>
        {:else}
          <Button variant="danger" fullWidth icon="trash" onclick={onchoose}
            >{t('delete.action', lang)}</Button
          >
        {/if}
        <Button variant="ghost" fullWidth onclick={oncancel}>{t('delete.cancel', lang)}</Button>
      </div>
    </BottomSheet>
  {:else if flow.stage === 'step1'}
    <ConfirmSheet
      open
      title={t('delete.step1.title', lang, { club })}
      message={t('delete.step1.body.noExport', lang)}
      {subject}
      confirmLabel={t('delete.step1.continue', lang)}
      confirmVariant="secondary"
      cancelLabel={t('delete.cancel', lang)}
      closeLabel={t('nav.close', lang)}
      onconfirm={onproceed}
      {oncancel}
    />
  {:else if flow.stage === 'step2'}
    <ConfirmSheet
      open
      title={t('delete.step2.title', lang, { club })}
      message={t('delete.step2.body', lang)}
      {subject}
      confirmLabel={t('delete.action', lang)}
      confirmVariant="danger"
      cancelLabel={t('delete.cancel', lang)}
      closeLabel={t('nav.close', lang)}
      busy={flow.busy}
      busyLabel={t('delete.busy', lang)}
      error={flow.failed ? t('delete.failed', lang) : undefined}
      {onconfirm}
      {oncancel}
    />
  {/if}
{/if}

<style>
  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-2) 0;
  }
  .note {
    margin: 0;
    color: var(--ink);
  }
  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .progress {
    font-variant-numeric: tabular-nums;
  }
</style>
