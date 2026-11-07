<script lang="ts" module>
  /** One number of the strength strip: the team's Força or one sector. */
  export interface StrengthItem {
    id: string;
    /** "Defesa", already translated. */
    label: string;
    /** Already rounded. */
    value: number;
    /** Change from before the last swap or choice; absent or 0: no mark. */
    delta?: number;
    /** "subiu 2" / "caiu 3" (`lineup.strength.up` / `.down`), for screen readers. */
    deltaLabel?: string;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * StrengthBars: the team's Força and the three sectors (escalacao.md, "Força do time"): label,
   * number and bar, plus the change from the last swap as an arrow and a signed number (never
   * colour alone). The bar only reinforces the number and is hidden from screen readers. The
   * change stays until the next one; no timer, no animation under reduced motion. The screen
   * announces the change in its status line; this strip has no live region of its own. With
   * `help`, a native disclosure under the numbers ("O que conta na Força") explains the rule;
   * closed by default, its summary is a 44px target.
   */
  interface Props {
    /** "Força do time" (`lineup.strength.title`), read by screen readers. */
    title: string;
    items: readonly StrengthItem[];
    /** Scale of the bars (the numbers can pass it; the bar stops full). */
    max?: number;
    /** "O que conta na Força" (`lineup.strength.help.label`). */
    helpLabel?: string;
    /** The rule, per realism (`lineup.strength.help.full` / `.simplified`). */
    help?: string;
  }
  const { title, items, max = 100, helpLabel, help }: Props = $props();
  const id = $props.id();
  const width = (value: number) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  const signed = (delta: number) => (delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`);
</script>

<section class="strength" aria-labelledby="{id}-t">
  <h2 class="visually-hidden" id="{id}-t">{title}</h2>
  <dl class="items" style="--n: {items.length}">
    {#each items as item (item.id)}
      <div class="item" class:first={item.id === items[0]?.id}>
        <dt class="caption label">{item.label}</dt>
        <dd class="value">
          <span class="numero">{item.value}</span>
          {#if item.delta}
            <span class="caption delta" class:up={item.delta > 0} class:down={item.delta < 0}>
              <Icon name={item.delta > 0 ? 'arrow-up' : 'arrow-down'} size={12} />
              <span aria-hidden="true">{signed(item.delta)}</span>
              {#if item.deltaLabel}<span class="visually-hidden">{item.deltaLabel}</span>{/if}
            </span>
          {/if}
        </dd>
        <dd class="bar" aria-hidden="true">
          <span style="inline-size: {width(item.value)}"></span>
        </dd>
      </div>
    {/each}
  </dl>
  {#if help && helpLabel}
    <details class="help">
      <summary class="caption"><Icon name="info" size={16} /><span>{helpLabel}</span></summary>
      <p class="caption">{help}</p>
    </details>
  {/if}
</section>

<style>
  .strength {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-1);
  }
  .items {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: calc(var(--space-1) / 2);
    min-inline-size: 0;
  }
  /* The team's number comes first and is set apart by a line. */
  .item.first {
    padding-inline-end: var(--space-3);
    border-inline-end: 1px solid var(--line);
  }
  .label {
    color: var(--ink-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  dd {
    margin: 0;
  }
  .value {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .delta {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .delta.up :global(svg) {
    color: var(--grass);
  }
  .delta.down :global(svg) {
    color: var(--danger);
  }
  .help {
    margin-block-start: var(--space-1);
  }
  .help summary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-block-size: var(--touch);
    color: var(--ink-muted);
    cursor: pointer;
    list-style: none;
  }
  .help summary::-webkit-details-marker {
    display: none;
  }
  .help summary:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .help[open] summary {
    color: var(--ink);
  }
  .help p {
    margin: 0 0 var(--space-1);
    color: var(--ink);
  }
  .bar {
    block-size: var(--size-bar);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    overflow: hidden;
  }
  .bar span {
    display: block;
    block-size: 100%;
    background: var(--grass);
    /* No motion token yet (componentes.md, "Propostas", item 2): 0.2s until motion-fast. */
    transition: inline-size 0.2s ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .bar span {
      transition: none;
    }
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
