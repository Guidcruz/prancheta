<script lang="ts" module>
  import type { ShieldClub } from '@lib/generators/shield';
  import type { IconName } from './Icon.svelte';

  /** One line of the commentary, its texts already formatted by the screen. */
  export interface CommentaryItem {
    /** The same id is the same line: a new text replaces it in place (the dramatic pause). */
    id: string;
    /** "23'", "45+2'". */
    minute: string;
    /** The minute as read ("minuto 23"); the visible one is hidden from screen readers. */
    minuteA11y: string;
    icon?: IconName;
    /**
     * `goal`: the `grass-soft` background (the word "Gol" says it); `yellow` and `red`: only the
     * colour of the card icon; `phase`: a mark of the clock, with no club.
     */
    tone?: 'goal' | 'yellow' | 'red' | 'phase';
    /** The word of the kind ("Gol", "Finalização"), in `body-strong`. */
    kind: string;
    /** The text of the play. */
    text?: string;
    /** The short kind of a goal ("pênalti"), in `caption`. */
    note?: string;
    /** The note as read ("de pênalti"). */
    noteA11y?: string;
    /** A line below, in `body` (the assist). */
    detail?: string;
    /** The short name of the club, in `caption` `ink-muted`; none for the phases. */
    club?: string;
    /** The club of the play, drawn as a small crest after the minute; none for the phases. */
    crest?: ShieldClub;
  }
</script>

<script lang="ts">
  import Crest from './Crest.svelte';
  import Icon from './Icon.svelte';

  /**
   * CommentaryFeed (componentes.md, "Casca da T-032 e da T-085"): the commentary of the match, the
   * most recent line on top, right under the board, in the line of the MatchTimeline (the minute
   * in a column of fixed width, the club's crest in its own column, the icon opening the text, the
   * word of the kind in `body-strong`, the text and, below, the club). A line with the same `id` is replaced in place, never moved.
   * Nothing is tappable and nothing moves: a new line appears on top without sliding, and the list
   * never scrolls by itself. It is not a live region (the board announces); each line is read in
   * one sentence, hidden, as in the MatchTimeline. With `scroll`, the list is its own scrolling
   * region, reachable by the keyboard.
   */
  interface Props {
    title: string;
    level?: 2 | 3;
    /** The most recent first. */
    items: readonly CommentaryItem[];
    emptyText?: string;
    scroll?: boolean;
  }
  const { title, level = 2, items, emptyText, scroll = false }: Props = $props();
  const titleId = $props.id();
  const spoken = (item: CommentaryItem) =>
    [
      item.minuteA11y,
      item.club,
      item.kind,
      item.text,
      item.note === undefined ? undefined : (item.noteA11y ?? item.note),
      item.detail,
    ]
      .filter((part) => part !== undefined && part !== '')
      .join(', ');
</script>

<!-- A region that scrolls by itself takes the focus, so the keyboard can scroll it (WCAG 2.1.1). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section class="feed" class:scroll aria-labelledby={titleId} tabindex={scroll ? 0 : undefined}>
  <svelte:element this={`h${level}`} class="visually-hidden" id={titleId}>{title}</svelte:element>
  {#if items.length === 0}
    {#if emptyText}<p class="body none">{emptyText}</p>{/if}
  {:else}
    <ol class="lines" reversed>
      {#each items as item (item.id)}
        <li class="line {item.tone ?? ''}" data-line={item.id}>
          <span class="numero minute" aria-hidden="true">{item.minute}</span>
          <span class="crest-slot" aria-hidden="true" data-crest-slot
            >{#if item.crest}<Crest club={item.crest} size="xs" instance={item.id} />{/if}</span
          >
          <span class="what" aria-hidden="true">
            <span class="main"
              >{#if item.icon}<span class="icon {item.tone ?? ''}"
                  ><Icon name={item.icon} size={20} /></span
                >{/if}<span class="body-strong kind">{item.kind}</span>{#if item.text}<span
                  class="body text">{` ${item.text}`}</span
                >{/if}{#if item.note}<span class="caption note">{` ${item.note}`}</span>{/if}</span
            >
            {#if item.detail}<span class="body detail">{item.detail}</span>{/if}
            {#if item.club}<span class="caption club">{item.club}</span>{/if}
          </span>
          <span class="visually-hidden">{spoken(item)}</span>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .feed {
    min-width: 0;
  }
  .scroll {
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .none {
    margin: 0;
    color: var(--ink-muted);
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* The line of the MatchTimeline: the minute column fits "90+7'" in `numero` (the width of a
     touch target, 44px, no token for it); the crest column is the `xs` medallion (24px). */
  .line {
    display: grid;
    grid-template-columns: var(--touch) var(--size-medallion-xs) minmax(0, 1fr);
    column-gap: var(--space-2);
    align-items: baseline;
    position: relative;
    padding: var(--space-2);
    border-radius: var(--radius-md);
  }
  /* The goal: `ink` on `grass-soft` (a pair checked by npm run tokens); the word "Gol" says it. */
  .line.goal {
    background: var(--grass-soft);
    color: var(--ink);
  }
  .minute {
    font-variant-numeric: tabular-nums;
  }
  /* The crest (27px) never makes a row taller: a line of one line of text and no club below it
     (the change of tactics) is 22px tall, so the slot has no height and the crest hangs into the
     padding under the line. */
  .crest-slot {
    display: flex;
    align-items: flex-start;
    align-self: start;
    height: 0;
  }
  /* The icon of the play opens the text, 20px, and does not make the first line taller. */
  .icon {
    display: inline-block;
    width: 20px;
    height: 20px;
    margin-inline-end: var(--space-1);
    vertical-align: top;
    line-height: 0;
    color: var(--ink-muted);
  }
  .icon.yellow {
    color: var(--floodlight);
  }
  .icon.red {
    color: var(--danger);
  }
  .what {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .main,
  .detail {
    overflow-wrap: break-word;
  }
  .note,
  .club {
    color: var(--ink-muted);
  }
  .line.goal .note,
  .line.goal .club {
    color: var(--ink);
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
