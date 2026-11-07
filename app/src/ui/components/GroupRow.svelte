<script lang="ts">
  /**
   * GroupRow: a group heading inside a ScrollTable ("Goleiros", "Zagueiros"...), a real header
   * row (`th scope="colgroup"`), whose text stays at the left while the numbers scroll.
   */
  interface Props {
    label: string;
    /** How many columns the table has. */
    colspan: number;
  }
  const { label, colspan }: Props = $props();
</script>

<tr class="group">
  <th scope="colgroup" {colspan} class="rotulo">
    <span class="text">{label}</span>
  </th>
</tr>

<style>
  th {
    padding: var(--space-3) var(--space-3) var(--space-1);
    border-block-end: 1px solid var(--line);
    background: var(--surface-0);
    color: var(--ink-muted);
    text-align: start;
    font-weight: inherit;
  }
  /* The label rides along the fixed column when the row scrolls. */
  .text {
    position: sticky;
    inset-inline-start: var(--space-3);
  }
</style>
