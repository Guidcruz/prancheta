<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { PitchKit, PitchKits } from '../match/pitch/kits';
  import { clampBall, pitchGeometry, type PitchGeometry } from '../match/pitch/geometry';
  import { PITCH_SIZE } from '../match/pitch/motion';
  import type { PitchScene } from '../match/pitch/scene';

  /**
   * MatchPitch (componentes.md, "Casca da T-032 e da T-085"; proposal 35; partida.md, "Campo 2D
   * (T-085)"): the 2D pitch of the match in a canvas, seen from above and lying down, edge to edge,
   * decorative (`aria-hidden`: the commentary and the board say everything it shows). It only
   * draws the scene the screen gives: the choreography, the progress of each step and when to run
   * are the screen's.
   *
   * - The canvas is the largest 1.5:1 rectangle that fits the container, centred; the sides left
   *   over are `pitch`. Its pixels are its CSS size times `min(devicePixelRatio, 2)`, rounded.
   * - The grass and the markings are drawn once in a canvas out of the page and copied each frame;
   *   they are drawn again only when the size or the `data-theme` of `<html>` changes. The colours
   *   are the tokens `--pitch`, `--pitch-line` and `--ink`, read at run time.
   * - Each player is a disc of 5.5 m in the `fill` of its kit, with a 2px ring in `ink` inside its
   *   diameter; the visitor carries the `mark` in the centre (a third of the diameter); the ball is
   *   a 2.5 m disc in `ink` (8px at least), drawn over the discs. No text, number or card.
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
  }
  const { kits, frame, running, version, onfail }: Props = $props();

  /** The drawing in metres: the pitch of play and the strip of grass around it. */
  const LENGTH = PITCH_SIZE.length + 2 * PITCH_SIZE.margin;
  const WIDTH = PITCH_SIZE.width + 2 * PITCH_SIZE.margin;
  const RATIO = LENGTH / WIDTH;
  const MARGIN = PITCH_SIZE.margin;
  const RING_PX = 2;
  const TAU = Math.PI * 2;

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
  let scale = 1;
  /** The sizes in pixels at this size of the canvas (the ball's limits included). */
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

  const token = (name: string) => getComputedStyle(box!).getPropertyValue(name).trim();

  /** The grass and the markings, drawn out of the page at the canvas's pixel size. */
  function drawField(): void {
    if (canvas === undefined || ctx === null || cssWidth === 0) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);
    // Setting the size clears the canvas, even to the same value: only when it changes.
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    geometry = pitchGeometry(width, height, dpr);
    scale = geometry.scale;
    ink = token('--ink');
    field ??= document.createElement('canvas');
    field.width = canvas.width;
    field.height = canvas.height;
    const g = field.getContext('2d');
    if (g === null) throw new Error('no 2D context for the field');
    const s = scale;
    g.fillStyle = token('--pitch');
    g.fillRect(0, 0, field.width, field.height);
    g.strokeStyle = token('--pitch-line');
    g.lineWidth = Math.max(1, cssWidth / 360) * dpr;
    const at = (m: number) => (m + MARGIN) * s;
    const rect = (x: number, y: number, w: number, h: number) =>
      g.strokeRect(at(x), at(y), w * s, h * s);
    const L = PITCH_SIZE.length;
    const W = PITCH_SIZE.width;
    const cy = W / 2;
    rect(0, 0, L, W);
    g.beginPath();
    g.moveTo(at(L / 2), at(0));
    g.lineTo(at(L / 2), at(W));
    g.stroke();
    g.beginPath();
    g.arc(at(L / 2), at(cy), 9.15 * s, 0, TAU);
    g.stroke();
    const spot = (x: number, y: number) => {
      g.beginPath();
      g.arc(at(x), at(y), Math.max(g.lineWidth, 0.25 * s), 0, TAU);
      g.fillStyle = g.strokeStyle;
      g.fill();
    };
    spot(L / 2, cy);
    for (const side of [0, 1] as const) {
      const line = side === 0 ? 0 : L;
      const dir = side === 0 ? 1 : -1;
      // Penalty area (16.5 × 40.3), goal area (5.5 × 18.3), the spot at 11 m and the arc.
      rect(side === 0 ? 0 : L - 16.5, cy - 20.15, 16.5, 40.3);
      rect(side === 0 ? 0 : L - 5.5, cy - 9.15, 5.5, 18.3);
      spot(line + dir * 11, cy);
      const open = Math.acos((16.5 - 11) / 9.15);
      g.beginPath();
      if (side === 0) g.arc(at(11), at(cy), 9.15 * s, -open, open);
      else g.arc(at(L - 11), at(cy), 9.15 * s, Math.PI - open, Math.PI + open);
      g.stroke();
      // The goal: 7.32 wide and 2 deep, in the strip of grass.
      rect(side === 0 ? -2 : L, cy - 3.66, 2, 7.32);
    }
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
      const s = scale;
      const g = geometry;
      const r = g.discRadius;
      const ring = RING_PX * dpr;
      ctx.drawImage(field, 0, 0);
      ctx.lineWidth = ring;
      ctx.strokeStyle = ink;
      for (let d = 0; d < 22; d++) {
        if (scene.on[d] !== 1) continue;
        const kit = kitOf(d);
        const x = (scene.x[d]! + MARGIN) * s;
        const y = (scene.y[d]! + MARGIN) * s;
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
      ctx.beginPath();
      // The centre held inside the canvas: at the smallest pitch (180 × 120) the 8px ball would
      // be cut by the edge when it sits in the net or wide of the goal.
      ctx.arc(
        clampBall((scene.ballX + MARGIN) * s, g.ballMinX, g.ballMaxX),
        clampBall((scene.ballY + MARGIN) * s, g.ballMinY, g.ballMaxY),
        g.ballRadius,
        0,
        TAU,
      );
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

  /** The field again (size or theme), and the frame over it. */
  function refresh(): void {
    if (ctx === null || failed || cssWidth === 0) return;
    try {
      drawField();
    } catch (error) {
      fail('draw', error);
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
    const sizes = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      fit(entry.contentRect.width, entry.contentRect.height);
    });
    sizes.observe(box!);
    // The theme changes the colours of the grass, the lines, the rings and the ball.
    const theme = new MutationObserver(refresh);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      sizes.disconnect();
      theme.disconnect();
      if (raf !== 0) cancelAnimationFrame(raf);
      raf = 0;
    };
  });

  // A new size: the canvas, the field and a frame.
  $effect(() => {
    if (cssWidth > 0 && cssHeight > 0) untrack(refresh);
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

<div class="pitch" bind:this={box}>
  <canvas
    bind:this={canvas}
    aria-hidden="true"
    style:width="{cssWidth}px"
    style:height="{cssHeight}px"
  ></canvas>
</div>

<style>
  /* Edge to edge, `pitch` from the first instant; the canvas centred in it. */
  .pitch {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--pitch);
  }
  canvas {
    position: absolute;
    top: 50%;
    left: 50%;
    display: block;
    translate: -50% -50%;
  }
</style>
