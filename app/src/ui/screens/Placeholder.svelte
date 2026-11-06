<script lang="ts">
  /**
   * A destination whose screen comes with its own task (Clube T-028, Elenco T-028, Tabela and
   * Calendário T-031, Notícias T-034...). It only says so, and where the career stands, so the
   * frame can be tried end to end.
   */
  interface Props {
    /** Already translated. */
    message: string;
    lines?: readonly string[];
  }
  const { message, lines = [] }: Props = $props();
</script>

<section class="placeholder">
  {#each lines as line (line)}
    <p class="body-strong">{line}</p>
  {/each}
  <p class="body muted">{message}</p>
</section>

<style>
  .placeholder {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-6) 0;
  }
  p {
    margin: 0;
  }
  .muted {
    color: var(--ink-muted);
  }
</style>
