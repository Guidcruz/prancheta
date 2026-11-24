<script lang="ts" module>
  /**
   * The tip under the pill, in px CSS (partida-campo-v2.md, §9): 12 wide, 7 tall. The thread of
   * 5px from the tip to the top of the disc (or of the ball) is drawn by the pitch, not here.
   */
  export const PITCH_TAG_TIP = { width: 12, height: 7 } as const;

  /**
   * Durations of the tag, in ms (partida-campo-v2.md, §9, "Tempos da etiqueta do lance" and
   * "Etiqueta de gol"): they stay here until the motion group of tokens exists (proposal 2). The
   * screen reads `out` to know when to take a `leaving` tag away; the goal tag leaves at once.
   */
  export const PITCH_TAG_MOTION = { playIn: 160, goalIn: 200, out: 120 } as const;

  /** The colours of the number of the kit (`FieldKit.numberColor` and `numberPlate`). */
  export interface PitchTagNumber {
    color: string;
    plate: string | null;
  }

  /** The size of the pill in px CSS, without the tip (the tip adds `PITCH_TAG_TIP.height`). */
  export interface PitchTagSize {
    width: number;
    height: number;
  }

  export type PitchTagTone = 'play' | 'goal' | 'team';

  /** The two elements the pitch writes to by itself, per frame, with no reactivity (§9, item 6). */
  export interface PitchTagRefs {
    /** Takes the `transform` of the position. */
    place: HTMLElement;
    /** Takes the custom property `--tip-x`. */
    pill: HTMLElement;
  }

  /**
   * A tag as the screen asks the pitch to show it: what it says (already translated), the shirt,
   * and what it hangs from (a disc of the scene, or the ball with `-1`). A new `key` is a new tag
   * (it enters again); the same key with other texts only changes them in place.
   */
  export interface PitchTagView {
    key: string;
    tone: PitchTagTone;
    kind?: string;
    name?: string;
    assist?: string;
    shirt?: number;
    kitSvg: string;
    number?: PitchTagNumber;
    /** 0 to 21, the disc of the scene it hangs from; -1: the ball. */
    disc: number;
    /** Fading out; the pitch tells `onleft` when it is done. */
    leaving: boolean;
    /** No transition (the screen's reduced motion, read once per step). */
    still: boolean;
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  /**
   * PitchTag (partida-campo-v2.md, §9 and §11; proposals 41, 47 and 48, approved by the CEO): the
   * pill over the pitch that comes out of a player (or out of the ball) by a tip. DOM over the
   * canvas, never text in the canvas. It repeats the commentary of the same step, so it is
   * `aria-hidden` and takes no touch.
   *
   * - `play`: the tag of a play. The shirt in a circle with the number, the kind in `rotulo` and
   *   the name in `body-strong` (up to 2 lines, never cut). 48px tall, 70px with two lines of name;
   *   `compact` (the box under 200px tall): only the shirt and the name, 40px.
   * - `goal`: the goal tag, in place of the GoalCelebration (proposal 47). The same pill in
   *   `grass`/`on-grass`; `kind` is the title ("Gol!", `match.celebration.title`) in `numero`,
   *   upper case; the scorer in `body-strong`; `assist` in `caption` (PR D). 50px, 66px with the
   *   assist; `compact`: only the shirt and the title, 40px.
   * - `team`: the shirt of the team with the ball, over the ball (proposal 48): a circle of 32px
   *   with the shirt, no number, no name. Every text prop is ignored.
   *
   * Texts arrive already translated (the screen calls `t`); none is written here.
   *
   * Position: the screen places it (`tagPlacement`, §9). `x` and `y` are the top-left corner of
   * the pill in px CSS of the pitch box (which must be `position: relative`), and `tipX` is the
   * centre of the tip from the left edge of the pill; they only go into a `transform` (no layout).
   * The size of the pill is handed once through `onmeasure` (a ResizeObserver: again only if the
   * text, the fonts or the box change, never per frame; transforms and the entrance scale do not
   * count).
   *
   * Motion: enters with opacity and scale 0.92 to 1 from the tip (160 ms `play`, 200 ms `goal`,
   * `ease-out`); with `leaving`, a `play` tag fades out in 120 ms (the goal and `team` tags go at
   * once). The `team` tag never animates (it changes shirt at once). No transition with `still` or
   * `prefers-reduced-motion`. Another player replaces a tag at once: the screen mounts a new one
   * (`{#key}`) with no `leaving`.
   */
  interface Props {
    tone: PitchTagTone;
    /** `play`: the kind of the step ("Finalização"); `goal`: the title ("Gol!"). */
    kind?: string;
    /** The player of the event (`play`) or the scorer (`goal`). */
    name?: string;
    /** `goal` only, PR D: "Assistência de {player}" (`match.celebration.assist`). */
    assist?: string;
    /** `Player.shirt` of the same `PlayerId` as the name; never in `team`. */
    shirt?: number;
    /** The SVG of `kitSvg(kit, …, { part: 'shirt' })` (viewBox 0 0 64 42); sized here by CSS. */
    kitSvg: string;
    /** The colours of the number of that kit; without it the number goes in `ink`. */
    number?: PitchTagNumber;
    /** `play` only, PR D: the name in `ink-muted` until the ball reaches the player. */
    waiting?: boolean;
    /** The box under 200px tall: one line only. */
    compact?: boolean;
    /** Top-left corner of the pill, px CSS of the pitch box. */
    x?: number;
    y?: number;
    /** Centre of the tip from the left edge of the pill, px CSS; absent: the middle. */
    tipX?: number;
    /** Fading out (`PITCH_TAG_MOTION.out`); the screen removes it afterwards. */
    leaving?: boolean;
    /** No transition at all (the screen's reduced motion, read once per step). */
    still?: boolean;
    /** The size of the pill without the tip, on mount and whenever it changes. */
    onmeasure?: (size: PitchTagSize) => void;
    /**
     * The elements the pitch moves each frame (the `transform` of the position and `--tip-x`)
     * without going through the props, so no reactive work and no layout per frame; `undefined`
     * when the tag is gone.
     */
    onref?: (refs: PitchTagRefs | undefined) => void;
    /** The fade of `leaving` ended: the screen can take the tag away. */
    onleft?: () => void;
  }

  const {
    tone,
    kind,
    name,
    assist,
    shirt,
    kitSvg,
    number,
    waiting = false,
    compact = false,
    x = 0,
    y = 0,
    tipX,
    leaving = false,
    still = false,
    onmeasure,
    onref,
    onleft,
  }: Props = $props();

  let place: HTMLDivElement | undefined = $state();
  let pill: HTMLDivElement | undefined = $state();

  const team = $derived(tone === 'team');
  const goal = $derived(tone === 'goal');
  const showNumber = $derived(!team && shirt !== undefined);
  const showKind = $derived(!team && kind !== undefined && (goal || !compact));
  const showName = $derived(!team && name !== undefined && !(goal && compact));
  const showAssist = $derived(goal && !compact && assist !== undefined);

  // The elements go to the pitch once, when they exist (the callback is never a dependency).
  $effect(() => {
    const refs = place !== undefined && pill !== undefined ? { place, pill } : undefined;
    if (refs === undefined) return;
    untrack(() => onref?.(refs));
    return () => untrack(() => onref?.(undefined));
  });

  // Only `pill` is a dependency: `onmeasure` is read when the size comes, so a new callback from
  // the screen never observes again.
  $effect(() => {
    const node = pill;
    if (node === undefined || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.borderBoxSize?.[0];
      onmeasure?.(
        box !== undefined
          ? { width: box.inlineSize, height: box.blockSize }
          : { width: node.offsetWidth, height: node.offsetHeight },
      );
    });
    observer.observe(node, { box: 'border-box' });
    return () => observer.disconnect();
  });
</script>

<div
  bind:this={place}
  class="place"
  style:transform="translate3d({x}px, {y}px, 0)"
  aria-hidden="true"
>
  <div
    bind:this={pill}
    class="tag {tone}"
    class:compact={compact && !team}
    class:waiting={waiting && tone === 'play'}
    class:leaving
    class:still
    style:--tip-x={tipX === undefined ? undefined : `${tipX}px`}
    ontransitionend={(event) => {
      if (leaving && event.propertyName === 'opacity') onleft?.();
    }}
  >
    <span class="shirt">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG from our kit generator over the club data, never user input -->
      {@html kitSvg}
      {#if showNumber}
        <span
          class="numero number"
          class:plate={(number?.plate ?? null) !== null}
          style:color={number?.color}
          style:background={number?.plate ?? undefined}>{shirt}</span
        >
      {/if}
    </span>
    {#if showKind || showName || showAssist}
      <span class="text">
        {#if showKind}
          <span class={goal ? 'numero title' : 'rotulo kind'}>{kind}</span>
        {/if}
        {#if showName}
          <span class="body-strong name">{name}</span>
        {/if}
        {#if showAssist}
          <span class="caption assist">{assist}</span>
        {/if}
      </span>
    {/if}
    <svg class="tip" width="12" height="8" viewBox="0 0 12 8" aria-hidden="true" focusable="false">
      <path class="tip-fill" d="M0 0H12L6 8Z" />
      <path class="tip-edge" d="M0 0L6 8L12 0" />
    </svg>
  </div>
</div>

<style>
  .place {
    position: absolute;
    left: 0;
    top: 0;
    /* §9: at most 60% of the box (216px at 360px); the name wraps inside it. */
    width: max-content;
    max-width: 60%;
    pointer-events: none;
  }

  /*
   * Sizes (§9). The circle sits concentric with the end of the pill: its inset is what is left of
   * the pill's height after the border and the circle, halved. The text keeps the heights:
   *   play:    4 + 16 (rotulo) + 22 (body-strong) + 4 + 2 of border = 48; two lines of name, 70.
   *   goal:    3 + 20 (numero) + 22 (body-strong) + 3 + 2 = 50; with the assist (16), 66.
   *   compact: 40, one line (the circle of 32, like `team`).
   *   team:    the circle itself, 32.
   * The circle is 40px, `size-medallion-md` (48) less a `space-2`; 32px is `size-medallion-sm`.
   */
  .tag {
    --tag-h: 48px;
    --circle: calc(var(--size-medallion-md) - var(--space-2));
    --circle-inset: calc((var(--tag-h) - 2px - var(--circle)) / 2);
    --text-pad: var(--space-1);
    --tip-x: 50%;
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    box-sizing: border-box;
    min-height: var(--tag-h);
    padding-block: 0;
    padding-inline: var(--circle-inset) var(--space-3);
    background: var(--surface-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    box-shadow: var(--shadow-card);
    color: var(--ink);
    transform-origin: var(--tip-x) calc(100% + 7px);
  }
  .goal {
    --tag-h: 50px;
    --text-pad: calc(var(--space-1) - 1px);
    background: var(--grass);
    border-color: var(--grass);
    color: var(--on-grass);
  }
  .compact {
    --tag-h: 40px;
    --circle: var(--size-medallion-sm);
  }
  .team {
    --tag-h: var(--size-medallion-sm);
    --circle: calc(var(--size-medallion-sm) - 2px);
    padding: 0;
    width: var(--size-medallion-sm);
    background: var(--surface-2);
  }

  /* The shirt and the number share the one cell of the grid, both centred. */
  .shirt {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--circle);
    height: var(--circle);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    line-height: 0;
  }
  .goal .shirt {
    background: var(--surface-1);
  }
  /* The shirt is 34 x 22 in the 40px circle, 26 x 17 in the 32px one (viewBox 0 0 64 42). */
  .shirt :global(svg) {
    grid-area: 1 / 1;
    display: block;
    width: 34px;
    height: 22px;
  }
  .compact .shirt :global(svg),
  .team .shirt :global(svg) {
    width: 26px;
    height: 17px;
  }
  /* The number over the shirt, in the kit's `numberColor` (≥ 4.5:1 on the shirt) or over its
     plate. The colours come from the kit, never from the screen. */
  .number {
    grid-area: 1 / 1;
    color: var(--ink);
    white-space: nowrap;
  }
  .number.plate {
    padding-inline: calc(var(--space-1) / 2);
    border-radius: var(--radius-sm);
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding-block: var(--text-pad);
  }
  .kind {
    color: var(--ink-muted);
    white-space: nowrap;
  }
  .title {
    text-transform: uppercase;
    white-space: nowrap;
  }
  /* Wraps, never cut and never with an ellipsis; a single long word breaks instead of leaving the
     pill. Two lines at most come from the width (60% of the box) and the lengths of the names. */
  .name {
    overflow-wrap: break-word;
    text-wrap: balance;
  }
  .waiting .name {
    color: var(--ink-muted);
  }

  /* The tip: the colour of the pill, the border on its two sides, over the pill's bottom border. */
  .tip {
    position: absolute;
    top: calc(100% - 1px);
    left: calc(var(--tip-x) - 6px);
    display: block;
    overflow: visible;
  }
  .tip-fill {
    fill: var(--surface-1);
  }
  .tip-edge {
    fill: none;
    stroke: var(--line);
    stroke-width: 1px;
  }
  .goal .tip-fill {
    fill: var(--grass);
  }
  .goal .tip-edge {
    stroke: var(--grass);
  }
  .team .tip-fill {
    fill: var(--surface-2);
  }

  .leaving {
    opacity: 0;
  }

  /* §9: only for whoever has not asked for reduced motion (§11), and never with `still`. The
     fill is `backwards` so that, once in, the animation no longer holds the opacity and `leaving`
     can fade it. The `team` tag never animates (it changes shirt at once), and the goal tag leaves
     at once. */
  @media (prefers-reduced-motion: no-preference) {
    .play:not(.still) {
      animation: tag-in 160ms ease-out backwards;
    }
    .goal:not(.still) {
      animation: tag-in 200ms ease-out backwards;
    }
    .play.leaving:not(.still) {
      transition: opacity 120ms linear;
    }
  }
  @keyframes tag-in {
    from {
      opacity: 0;
      scale: 0.92;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }
</style>
