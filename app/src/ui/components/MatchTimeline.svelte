<script lang="ts" module>
  import type { ShieldClub } from '@lib/generators/shield';
  import type { IconName } from './Icon.svelte';

  /** One line of the timeline, its texts already formatted by the screen. */
  export interface TimelineItem {
    /** "23'", "45+2'". */
    minute: string;
    /** The minute as read ("minuto 23"); the visible one is hidden from screen readers. */
    minuteA11y: string;
    icon?: IconName;
    /** Only the colour of the card icon (`floodlight`, `danger`): the word of the kind says it. */
    tone?: 'yellow' | 'red';
    /** The word of the kind ("Gol", "Amarelo"), in `body-strong`. */
    kind: string;
    /** The text of the event: the name, or who comes on and who goes off. */
    text: string;
    /** A short note after the text, in `caption` (the kind of a goal: "pênalti"). */
    note?: string;
    /** The note as read ("de pênalti"). */
    noteA11y?: string;
    /** A line below, in `body` (the assist). */
    detail?: string;
    /** The short name of the club, in `caption` `ink-muted`. */
    club: string;
    /** The club of the event, drawn as a small crest after the minute. */
    crest?: ShieldClub;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Crest from './Crest.svelte';
  import Icon from './Icon.svelte';

  /**
   * MatchTimeline (componentes.md, "Casca da T-030 e da T-083"): the events of a match in order,
   * one per line: the minute in a column of fixed width, the crest of the club in its own column, the icon opening the text, the word of
   * the kind in `body-strong` followed by the text, and below the club's short name. The visible
   * parts are hidden from screen readers, which read one sentence per line ("minuto 23, Leões,
   * Gol, Fulano, de pênalti"), like the GoalList. With no line, `emptyText`. `notice` comes
   * between the title and the list (the notice of a report without its events). Nothing is
   * tappable, nothing moves.
   */
  interface Props {
    title: string;
    level?: 2 | 3 | 4;
    items: readonly TimelineItem[];
    emptyText: string;
    notice?: Snippet;
  }
  const { title, level = 3, items, emptyText, notice }: Props = $props();
  const titleId = $props.id();
  /** What a screen reader reads of a line: the full texts, in the order they are shown. */
  const spoken = (item: TimelineItem) =>
    [
      item.minuteA11y,
      item.club,
      item.kind,
      item.text,
      item.note === undefined ? undefined : (item.noteA11y ?? item.note),
      item.detail,
    ]
      .filter((part) => part !== undefined)
      .join(', ');
</script>

<section class="timeline" aria-labelledby={titleId}>
  <svelte:element this={`h${level}`} class="subtitulo title" id={titleId}>{title}</svelte:element>
  {#if notice}{@render notice()}{/if}
  {#if items.length === 0}
    <p class="body none">{emptyText}</p>
  {:else}
    <ol class="lines">
      {#each items as item, i (i)}
        <li class="line">
          <span class="numero minute" aria-hidden="true">{item.minute}</span>
          <span class="crest-slot" aria-hidden="true" data-crest-slot
            >{#if item.crest}<Crest club={item.crest} size="xs" instance={`tl${i}`} />{/if}</span
          >
          <span class="what" aria-hidden="true">
            <span class="main"
              >{#if item.icon}<span class="icon {item.tone ?? ''}"
                  ><Icon name={item.icon} size={20} /></span
                >{/if}<span class="body-strong kind">{item.kind}</span>
              <span class="body text">{item.text}</span>{#if item.note}<span class="caption note"
                  >{` ${item.note}`}</span
                >{/if}</span
            >
            {#if item.detail}<span class="body detail">{item.detail}</span>{/if}
            <span class="caption club">{item.club}</span>
          </span>
          <span class="visually-hidden">{spoken(item)}</span>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }
  .title,
  .none {
    margin: 0;
  }
  .none {
    color: var(--ink-muted);
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* Minute, crest, text: the minute column fits "90+7'" in `numero` (no token for it: the width of
     a touch target, 44px); the crest column is the `xs` medallion (24px). The minute and the text
     sit on the baseline of the first line, as in the GoalList; the crest stays at the top of the
     line. The icon of the event opens the text. */
  .line {
    display: grid;
    grid-template-columns: var(--touch) var(--size-medallion-xs) minmax(0, 1fr);
    column-gap: var(--space-2);
    align-items: baseline;
  }
  .minute {
    font-variant-numeric: tabular-nums;
  }
  /* The crest (27px) never makes a row taller: a line of one line of text and no club below it
     (the change of tactics) is 22px tall, so the slot has no height and the crest hangs into the
     padding under the line. */
  .crest-slot {
    display: flex;
    align-self: start;
    height: 0;
  }
  .icon {
    display: inline-block;
    width: 20px;
    height: 20px;
    margin-inline-end: var(--space-1);
    vertical-align: middle;
    line-height: 0;
    color: var(--ink-muted);
  }
  /* The colour only reinforces the word of the kind (componentes.md, "Cor do cartão"). */
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
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
