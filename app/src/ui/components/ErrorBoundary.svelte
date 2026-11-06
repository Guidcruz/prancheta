<script lang="ts">
  import type { Snippet } from 'svelte';
  import ErrorState from './ErrorState.svelte';

  /**
   * Error boundary of a screen (US-045). A programming error thrown while rendering `children`
   * becomes an ErrorState; "Tentar de novo" remounts the screen. Logging is the caller's: it
   * passes `onerror`, which writes to lib/errors without personal data. Nothing here touches
   * the save.
   */
  interface Props {
    /** Already translated: error.unexpected.title / .body, action.retry, action.home. */
    copy: { title: string; message: string; retry: string; home: string };
    /** `area` inside the career frame, `screen` on full-screen screens. */
    layout?: 'screen' | 'area';
    onerror?: (error: unknown) => void;
    onhome: () => void;
    children: Snippet;
  }
  const { copy, layout = 'area', onerror, onhome, children }: Props = $props();
</script>

<svelte:boundary onerror={(error) => onerror?.(error)}>
  {@render children()}

  <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- Svelte passes the error first; onerror already got it -->
  {#snippet failed(_error, reset)}
    <ErrorState
      {layout}
      title={copy.title}
      message={copy.message}
      primary={{ label: copy.retry, onclick: reset, icon: 'retry' }}
      secondary={[{ label: copy.home, onclick: onhome }]}
    />
  {/snippet}
</svelte:boundary>
