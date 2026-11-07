<script lang="ts" module>
  import type { StatusBadgeItem } from './StatusBadge.svelte';

  /** A starter as the role sheet shows him. */
  export interface RoleEntry {
    id: string;
    name: string;
    /** "ATA". */
    positionCode: string;
    /** The attribute that decides the role: "Finalização 84", "Técnica 77", "31 anos". */
    detail: string;
    /** "Líder" on the captain sheet (StatusBadge `leader`). */
    badges?: readonly StatusBadgeItem[];
    /** Accessible names of the buttons, built by the screen with the name ("Subir Ildo"). */
    upLabel: string;
    downLabel: string;
    removeLabel: string;
    addLabel: string;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import StatusBadge from './StatusBadge.svelte';

  /**
   * RoleEditor: the body of the captain, penalty and free-kick sheets (tatica.md, "Funções"). The
   * ordered list on top, each with its number and the buttons Subir, Descer and Tirar (44px each;
   * no dragging here), then the other starters with "Pôr na lista". Under the list, the rule that
   * applies when nobody of it is on the pitch, and who that is now. At most `max` names; when
   * the list is full, the add buttons are disabled and a line says why. Every change is the
   * screen's and takes effect at once (no "Salvar"); the screen keeps the focus on the moved
   * entry and announces the new order.
   */
  interface Props {
    /** "Vale o primeiro da lista que estiver em campo." */
    intro: string;
    /** "Na ordem". */
    listTitle: string;
    /** "Outros titulares". */
    othersTitle: string;
    /** "Lista vazia: vale a regra automática." */
    emptyText: string;
    /** "Sem ninguém da lista em campo: quem tiver mais finalização." */
    autoText: string;
    /** "Agora: Ildo (Finalização 84)", when the list is empty. */
    nowText?: string;
    /** "A lista tem no máximo 3. Tire alguém para pôr outro." */
    fullText: string;
    max: number;
    list: readonly RoleEntry[];
    others: readonly RoleEntry[];
    onup: (id: string) => void;
    ondown: (id: string) => void;
    onremove: (id: string) => void;
    onadd: (id: string) => void;
  }
  const {
    intro,
    listTitle,
    othersTitle,
    emptyText,
    autoText,
    nowText,
    fullText,
    max,
    list,
    others,
    onup,
    ondown,
    onremove,
    onadd,
  }: Props = $props();
  const id = $props.id();
  const full = $derived(list.length >= max);
</script>

{#snippet who(entry: RoleEntry)}
  <span class="rotulo pos">{entry.positionCode}</span>
  <span class="who">
    <span class="body-strong name">{entry.name}</span>
    <span class="caption detail">
      {entry.detail}
      {#each entry.badges ?? [] as badge (badge.kind)}<StatusBadge {...badge} />{/each}
    </span>
  </span>
{/snippet}

<div class="editor">
  <p class="body intro">{intro}</p>

  <section aria-labelledby="{id}-list">
    <h3 class="body-strong heading" id="{id}-list">{listTitle}</h3>
    {#if list.length === 0}
      <p class="body muted">{emptyText}</p>
    {:else}
      <ol class="entries">
        {#each list as entry, i (entry.id)}
          <li class="entry" data-role-entry={entry.id}>
            <span class="numero order" aria-hidden="true">{i + 1}</span>
            {@render who(entry)}
            <span class="tools">
              <button
                type="button"
                class="tool"
                aria-label={entry.upLabel}
                disabled={i === 0}
                onclick={() => onup(entry.id)}><Icon name="arrow-up" size={20} /></button
              >
              <button
                type="button"
                class="tool"
                aria-label={entry.downLabel}
                disabled={i === list.length - 1}
                onclick={() => ondown(entry.id)}><Icon name="arrow-down" size={20} /></button
              >
              <button
                type="button"
                class="tool"
                aria-label={entry.removeLabel}
                onclick={() => onremove(entry.id)}><Icon name="close" size={20} /></button
              >
            </span>
          </li>
        {/each}
      </ol>
    {/if}
    <p class="caption auto">
      <Icon name="info" size={14} /><span
        >{autoText}{#if nowText}<br />{nowText}{/if}</span
      >
    </p>
  </section>

  <section aria-labelledby="{id}-others">
    <h3 class="body-strong heading" id="{id}-others">{othersTitle}</h3>
    {#if full}<p class="caption muted" id="{id}-full">{fullText}</p>{/if}
    <ul class="entries">
      {#each others as entry (entry.id)}
        <li>
          <button
            type="button"
            class="entry add"
            aria-label={entry.addLabel}
            disabled={full}
            aria-describedby={full ? `${id}-full` : undefined}
            onclick={() => onadd(entry.id)}
          >
            {@render who(entry)}
            <span class="tool plus" aria-hidden="true"><Icon name="plus" size={20} /></span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .intro,
  .heading {
    margin: 0;
  }
  .heading {
    margin-block-end: var(--space-1);
  }
  .muted {
    margin: 0;
    color: var(--ink-muted);
  }
  .entries {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .entry {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    inline-size: 100%;
    min-block-size: var(--touch);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-1);
    color: var(--ink);
    text-align: start;
  }
  .order {
    flex: none;
    inline-size: var(--space-4);
    text-align: center;
  }
  .pos {
    display: inline-grid;
    place-items: center;
    flex: none;
    min-inline-size: calc(var(--space-8) + var(--space-1));
    padding: calc(var(--space-1) / 2) var(--space-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    color: var(--ink-muted);
  }
  .who {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-inline-size: 0;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
  .tools {
    display: flex;
    flex: none;
    gap: calc(var(--space-1) / 2);
  }
  .tool {
    display: grid;
    place-items: center;
    inline-size: var(--touch);
    block-size: var(--touch);
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--ink);
    cursor: pointer;
  }
  .tool:hover:not(:disabled) {
    border-color: var(--line);
    background: var(--surface-2);
  }
  .tool:disabled {
    color: var(--line);
    cursor: default;
  }
  .tool:focus-visible,
  .add:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .add {
    cursor: pointer;
  }
  .add:hover:not(:disabled) {
    background: var(--surface-2);
  }
  .add:disabled {
    cursor: default;
  }
  .add:disabled .plus {
    color: var(--line);
  }
  .plus {
    flex: none;
  }
  .auto {
    display: flex;
    align-items: flex-start;
    gap: var(--space-1);
    margin: var(--space-2) 0 0;
    color: var(--ink-muted);
  }
  .auto :global(svg) {
    margin-block-start: 1px;
  }
</style>
