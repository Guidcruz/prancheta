<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { PitchKit, PitchKits } from '../match/pitch/kits';
  import { pitchColors } from '../match/pitch/tokens';
  import { drawBackdrop, type BackdropColors } from '../match/pitch/backdrop';
  import {
    ballRadius,
    discRadius,
    holdBall,
    pitchGeometry,
    project,
    TAG_TIP,
    tagPlacement,
    type PitchGeometry,
  } from '../match/pitch/geometry';
  import { PITCH_SIZE, PITCH_STAND_END } from '../match/pitch/motion';
  import type { PitchScene } from '../match/pitch/scene';
  import PitchTag, {
    type PitchTagRefs,
    type PitchTagSize,
    type PitchTagView,
  } from './PitchTag.svelte';

  /**
   * MatchPitch (componentes.md; docs/design/telas/partida-campo-v2.md; ADR-0023): the 2D pitch of
   * the match in a canvas, tilted by code (a fixed camera, a true perspective), decorative
   * (`aria-hidden`: the commentary and the board say everything it shows). It only draws the scene
   * the screen gives: the choreography, the progress of each step and when to run are the screen's.
   *
   * - The canvas is the largest 1.5:1 rectangle that fits the container, centred; the sides left
   *   over are `pitch`. Its pixels are its CSS size times `min(devicePixelRatio, 2)`, rounded.
   * - The background (stands, low wall, three rows of boards with only the colours of fictional
   *   brands, grass, markings and goals) is drawn once in a canvas out of the page and copied each
   *   frame; it is drawn again only when the size or the `data-theme` of `<html>` changes. Every
   *   colour is a token, read at run time.
   * - Only the discs of a play of the engine are drawn ("only the ball"), far ones first, each a
   *   disc of 5.5 m in the `fill` of its kit (7px CSS of radius at least) with a 2px ring in `ink`;
   *   the visitor carries the `mark` in the centre. The ball is a 2.5 m disc in `ink` (4px CSS of
   *   radius at least), held inside the trapezoid, over the discs. No text, number or card.
   * - The tags (`tags`; partida-campo-v2.md, 9): the pitch draws the thread of each (1.5px in
   *   `ink`, from its tip to the top of the disc or of the ball) and places the pill by
   *   `tagPlacement`, writing its `transform` straight into the element (and `--tip-x`) only when
   *   it moves more than 0.5px: no reactive work, no layout and no allocation per frame beyond the
   *   string of the style. The pill itself is DOM over the canvas (`PitchTag`), never text in it.
   * - With `running`, one frame per `requestAnimationFrame`; without it, none: each change of
   *   `version` draws one frame (reduced motion, pause, the final whistle).
   * - With no 2D context, or an error while drawing, `onfail` and nothing more: the loop of frames
   *   stops at the first error (an error in a frame callback reaches no Svelte boundary).
   *
   * Nothing is allocated per frame: the scene is the same object, filled by the screen.
   */
  interface Props {
    kits: PitchKits;
    /** The scene of the instant `now` (`performance.now()` time), always the same object. */
    frame: (now: number) => PitchScene;
    running: boolean;
    /** Without `running`, each change draws one frame. */
    version: number;
    /** No 2D context (`context`) or an error while drawing (`draw`). */
    onfail: (reason: 'context' | 'draw', error?: unknown) => void;
    /** The club and round that pick the brands of the boards (the same for everyone). */
    clubId?: string;
    round?: number;
    /** The tags on the pitch (at most the one on screen and the one fading out). */
    tags?: readonly PitchTagView[];
    /** A tag that was `leaving` has faded out: the screen takes it away. */
    onleft?: (key: string) => void;
  }
  const {
    kits,
    frame,
    running,
    version,
    onfail,
    clubId = '',
    round = 0,
    tags = [],
    onleft,
  }: Props = $props();

  /** The drawing in metres: the pitch of play and the strip of grass around it. */
  const LENGTH = PITCH_SIZE.length + 2 * PITCH_SIZE.margin;
  const WIDTH = PITCH_SIZE.width + 2 * PITCH_SIZE.margin;
  const RATIO = LENGTH / WIDTH;
  const RING_PX = 2;
  const TAU = Math.PI * 2;
  /** The thread of a tag, in px CSS; under this height of the box the tags are one line. */
  const THREAD_PX = 1.5;
  const COMPACT_BELOW = 200;
  /** What a tag measures before the first measure comes (it is hidden until then). */
  const GUESS = { width: 120, height: 48 };
  /** The least a tag moves to be written to the DOM again, in px CSS (§9, item 6). */
  const MOVE = 0.5;

  let box: HTMLDivElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();
  /** The CSS size of the canvas. */
  let cssWidth = $state(0);
  let cssHeight = $state(0);
  let ctx: CanvasRenderingContext2D | null = null;
  let field: HTMLCanvasElement | undefined;
  let failed = false;
  let ready = $state(false);
  // The values of the frame, set when the size or the theme changes (nothing per frame).
  /** Reused every frame: a projected point, the held ball, the order of the discs. */
  const point = new Float64Array(3);
  const slot = new Float64Array(3);
  const held = new Float64Array(2);
  const order = new Uint8Array(22);
  /** The sizes in pixels at this size of the canvas (the ball's limits included). */
  /** What the pitch keeps of each tag: its size, its elements and where it wrote it last. */
  interface TagRun {
    w: number;
    h: number;
    measured: boolean;
    /** Placed at least once: no longer hidden. */
    shown: boolean;
    place: HTMLElement | undefined;
    pill: HTMLElement | undefined;
    x: number;
    y: number;
    tip: number;
    /** The anchor as last seen, in canvas px: a disc that left stays where it was. */
    ax: number;
    ay: number;
    ar: number;
    seen: boolean;
  }
  // A plain record, not a Map: the runs are not state (nothing reacts to them) and are read per frame.
  const runs: Record<string, TagRun | undefined> = {};
  const spot = new Float64Array(3);
  let lastScene: PitchScene | undefined;
  let geometry: PitchGeometry = pitchGeometry(1, 1, 1);
  let dpr = 1;
  let ink = '';
  let raf = 0;

  /** The largest 1.5:1 rectangle that fits the container. */
  function fit(width: number, height: number): void {
    const w = width / height > RATIO ? height * RATIO : width;
    cssWidth = Math.floor(w);
    cssHeight = Math.floor(w / RATIO);
  }

  function fail(reason: 'context' | 'draw', error?: unknown): void {
    if (failed) return;
    failed = true;
    ready = false;
    if (raf !== 0) cancelAnimationFrame(raf);
    raf = 0;
    onfail(reason, error);
  }

  /**
   * The colours, read once per theme (from the tokens file, `getComputedStyle` only for a token it
   * lacks): a new size does not read them again, so it forces no style or layout in the redraw.
   */
  let colors: BackdropColors | undefined;
  function readColors(): { colors: BackdropColors; ink: string } {
    let style: CSSStyleDeclaration | undefined;
    return pitchColors(document.documentElement.dataset.theme ?? 'noite', (name) =>
      (style ??= getComputedStyle(box!)).getPropertyValue(name).trim(),
    );
  }

  /** The background, drawn out of the page at the canvas's pixel size. */
  function drawField(): void {
    if (canvas === undefined || ctx === null || cssWidth === 0) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);
    // Setting the size clears the canvas, even to the same value: only when it changes.
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    geometry = pitchGeometry(width, height, dpr);
    if (colors === undefined) {
      const read = readColors();
      colors = read.colors;
      ink = read.ink;
    }
    field ??= document.createElement('canvas');
    // Set every time: it clears the canvas and the state of its context (the background is then
    // drawn over a clean canvas).
    // Setting `field.width` on each redraw also marks the start of the redraw's measure in
    // tests/e2e/pitch.spec.ts (it hooks the setter): keep it, even if the width is unchanged.
    field.width = canvas.width;
    field.height = canvas.height;
    const g = field.getContext('2d');
    if (g === null) throw new Error('no 2D context for the field');
    drawBackdrop(g, geometry, colors, { round, clubId, stadiumId: clubId });
  }

  /**
   * The ball's centre held inside the trapezoid (never in the stand or out of the canvas) into
   * `held`; returns its radius in canvas px.
   */
  function holdTheBall(scene: PitchScene): number {
    project(geometry, scene.ballX, scene.ballY, point);
    const radius = ballRadius(geometry, point[2]!);
    holdBall(geometry, point[0]!, point[1]!, radius, held);
    return radius;
  }

  /**
   * Finds the anchor of `tag` in `scene` and writes the pill's place into the DOM when it moved
   * more than {@link MOVE}. Returns whether the thread is drawn: the anchor is in sight (a disc
   * that left, or not yet in, has no thread; the pill stays where the disc was last seen).
   */
  function placeTag(tag: PitchTagView, run: TagRun, scene: PitchScene, ballR: number): boolean {
    const g = geometry;
    let live = false;
    if (tag.disc < 0) {
      run.ax = held[0]!;
      run.ay = held[1]!;
      run.ar = ballR;
      live = true;
    } else {
      const shown = scene.alpha[tag.disc]! > 0;
      if (shown || !run.seen) {
        project(g, scene.x[tag.disc]!, scene.y[tag.disc]!, spot);
        run.ax = spot[0]!;
        run.ay = spot[1]!;
        run.ar = discRadius(g, spot[2]!);
      }
      if (shown) run.seen = true;
      live = shown;
    }
    if (run.place === undefined || run.pill === undefined || !run.measured) return live;
    tagPlacement(g, run.ax, run.ay, run.ar, run.w, run.h, slot);
    if (!(Math.abs(slot[0]! - run.x) <= MOVE) || !(Math.abs(slot[1]! - run.y) <= MOVE)) {
      run.x = slot[0]!;
      run.y = slot[1]!;
      run.place.style.transform = `translate3d(${run.x}px, ${run.y}px, 0)`;
    }
    if (!(Math.abs(slot[2]! - run.tip) <= MOVE)) {
      run.tip = slot[2]!;
      run.pill.style.setProperty('--tip-x', `${run.tip}px`);
    }
    if (!run.shown) {
      run.shown = true;
      run.place.style.visibility = '';
    }
    return live;
  }

  /** The tags again over the last scene, outside a frame (a tag just arrived or was measured). */
  function placeAll(): void {
    if (lastScene === undefined || failed) return;
    const radius = holdTheBall(lastScene);
    for (let i = 0; i < tags.length; i++) {
      const run = runs[tags[i]!.key];
      if (run !== undefined) placeTag(tags[i]!, run, lastScene, radius);
    }
  }

  const runOf = (key: string): TagRun => {
    let run = runs[key];
    if (run === undefined) {
      run = {
        w: GUESS.width,
        h: GUESS.height,
        measured: false,
        shown: false,
        place: undefined,
        pill: undefined,
        x: Number.NaN,
        y: Number.NaN,
        tip: Number.NaN,
        ax: 0,
        ay: 0,
        ar: 0,
        seen: false,
      };
      runs[key] = run;
    }
    return run;
  };

  function measured(key: string, size: PitchTagSize): void {
    const run = runOf(key);
    run.w = size.width;
    run.h = size.height;
    run.measured = true;
    placeAll();
  }

  function registered(key: string, refs: PitchTagRefs | undefined): void {
    if (refs === undefined) {
      delete runs[key];
      return;
    }
    const run = runOf(key);
    run.place = refs.place;
    run.pill = refs.pill;
    // Hidden until measured and placed: it never shows at the corner for a frame.
    if (!run.measured) refs.place.style.visibility = 'hidden';
    placeAll();
  }

  function kitOf(disc: number): PitchKit {
    if (disc === 0) return kits.homeGk;
    if (disc < 11) return kits.home;
    if (disc === 11) return kits.awayGk;
    return kits.away;
  }

  /** One frame; `false` when drawing failed. */
  function draw(now: number): boolean {
    if (ctx === null || field === undefined || failed) return false;
    try {
      const scene = frame(now);
      lastScene = scene;
      const g = geometry;
      const ring = RING_PX * dpr;
      ctx.drawImage(field, 0, 0);
      ctx.lineWidth = ring;
      ctx.strokeStyle = ink;
      // The discs of the plays only, the far ones first (insertion, nothing allocated).
      let count = 0;
      for (let d = 0; d < 22; d++) {
        if (scene.alpha[d]! <= 0) continue;
        let at = count++;
        while (at > 0 && scene.y[order[at - 1]!]! > scene.y[d]!) {
          order[at] = order[at - 1]!;
          at--;
        }
        order[at] = d;
      }
      for (let n = 0; n < count; n++) {
        const d = order[n]!;
        const kit = kitOf(d);
        project(g, scene.x[d]!, scene.y[d]!, point);
        const x = point[0]!;
        const y = point[1]!;
        const r = discRadius(g, point[2]!);
        ctx.globalAlpha = scene.alpha[d]!;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fillStyle = kit.fill;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r - ring / 2, 0, TAU);
        ctx.stroke();
        if (kit.mark !== undefined) {
          ctx.beginPath();
          ctx.arc(x, y, r / 3, 0, TAU);
          ctx.fillStyle = kit.mark;
          ctx.fill();
        }
      }
      const radius = holdTheBall(scene);
      // The threads of the tags, over the discs and under the ball.
      ctx.lineWidth = THREAD_PX * dpr;
      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i]!;
        const run = runs[tag.key];
        if (run === undefined) continue;
        const live = placeTag(tag, run, scene, radius);
        if (!live || tag.leaving) continue;
        const tipY = (run.y + run.h + TAG_TIP) * dpr;
        const top = run.ay - run.ar;
        if (tipY >= top) continue;
        ctx.globalAlpha = tag.disc < 0 ? 1 : scene.alpha[tag.disc]!;
        ctx.beginPath();
        ctx.moveTo((run.x + run.tip) * dpr, tipY);
        ctx.lineTo(run.ax, top);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(held[0]!, held[1]!, radius, 0, TAU);
      ctx.fillStyle = ink;
      ctx.fill();
      return true;
    } catch (error) {
      fail('draw', error);
      return false;
    }
  }

  function tick(now: number): void {
    raf = 0;
    if (!draw(now) || !running) return;
    raf = requestAnimationFrame(tick);
  }

  /**
   * The field again (size or theme) in a task of its own, never inside the callback that saw the
   * change (the ResizeObserver, the MutationObserver): the page's own style and layout for the new
   * size or theme are already long, and the redraw of the background must not pile on them (no
   * task over 50 ms; partida-campo-v2.md, 12). A message channel, not a timer: it is not held by
   * the fake clock of the tests. Changes that come before it runs are redrawn once.
   */
  let channel: MessageChannel | undefined;
  let scheduled = false;
  /** Before the first drawing; `later` runs its frame in a task after the background's. */
  let cold = true;
  let later: MessageChannel | undefined;
  function schedule(): void {
    if (scheduled || channel === undefined) return;
    scheduled = true;
    channel.port2.postMessage(0);
  }

  function refresh(): void {
    if (ctx === null || failed || cssWidth === 0) return;
    try {
      drawField();
    } catch (error) {
      fail('draw', error);
      return;
    }
    if (cold) {
      // The very first drawing runs with the code cold: the background and the first frame go in
      // two tasks, neither over 50 ms. `ready` (which starts the frames, also the one of a pitch
      // that is still) waits for the second.
      cold = false;
      later?.port2.postMessage(0);
      return;
    }
    ready = true;
    // A frame now, also while running: the next one may be a frame away.
    draw(performance.now());
  }

  onMount(() => {
    try {
      ctx = canvas!.getContext('2d');
    } catch (error) {
      fail('context', error);
      return;
    }
    if (ctx === null) {
      fail('context');
      return;
    }
    channel = new MessageChannel();
    later = new MessageChannel();
    later.port1.onmessage = () => {
      if (failed) return;
      // The effects draw the first frame when the pitch is still (and start the loop when it
      // runs); a running pitch also draws one now, the next frame may be a frame away.
      ready = true;
      if (running) draw(performance.now());
    };
    channel.port1.onmessage = () => {
      scheduled = false;
      refresh();
    };
    const sizes = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      fit(entry.contentRect.width, entry.contentRect.height);
    });
    sizes.observe(box!);
    // The theme changes the colours of the grass, the lines, the rings and the ball.
    const theme = new MutationObserver(() => {
      colors = undefined;
      schedule();
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      sizes.disconnect();
      theme.disconnect();
      channel?.port1.close();
      channel = undefined;
      later?.port1.close();
      later = undefined;
      if (raf !== 0) cancelAnimationFrame(raf);
      raf = 0;
    };
  });

  // A new size: the canvas, the field and a frame.
  $effect(() => {
    if (cssWidth > 0 && cssHeight > 0) untrack(schedule);
  });

  // Running: one frame per requestAnimationFrame, and none when it stops.
  $effect(() => {
    if (!running || !ready) return;
    if (raf === 0) raf = requestAnimationFrame(tick);
    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      raf = 0;
    };
  });

  // Stopped: one frame per change of `version`.
  $effect(() => {
    void version;
    if (running || !ready) return;
    untrack(() => draw(performance.now()));
  });
</script>

<div class="pitch" bind:this={box} style:--pitch-stand-end={PITCH_STAND_END}>
  <div class="stage" style:width="{cssWidth}px" style:height="{cssHeight}px">
    <canvas
      bind:this={canvas}
      aria-hidden="true"
      style:width="{cssWidth}px"
      style:height="{cssHeight}px"
    ></canvas>
    {#each tags as tag (tag.key)}
      <PitchTag
        tone={tag.tone}
        kind={tag.kind}
        name={tag.name}
        assist={tag.assist}
        shirt={tag.shirt}
        kitSvg={tag.kitSvg}
        number={tag.number}
        compact={cssHeight < COMPACT_BELOW}
        leaving={tag.leaving}
        still={tag.still}
        onmeasure={(size) => measured(tag.key, size)}
        onref={(refs) => registered(tag.key, refs)}
        onleft={() => onleft?.(tag.key)}
      />
    {/each}
  </div>
</div>

<style>
  /* Edge to edge, `pitch` from the first instant; the canvas centred in it. */
  .pitch {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    /* The leftover of the box, at the sides of the canvas, goes on as the stand: the edge of the
       drawing below the far line is stand, not grass (`PITCH_STAND_END` in motion.ts sets the
       33%). Tokens only. */
    background: linear-gradient(
      to bottom,
      var(--surface-0),
      var(--surface-2) var(--pitch-stand-end),
      var(--surface-0)
    );
  }
  /* The canvas and the tags over it share this box, centred in the container. */
  .stage {
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
  }
  canvas {
    display: block;
  }
</style>
