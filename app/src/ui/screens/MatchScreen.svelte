<script lang="ts" module>
  /** How the round the match ends with went (the frame plays and stores it). */
  export type FinishOutcome = 'saved' | 'unsaved' | 'failed' | 'none';

  /** What the phone's back does now (the frame owns the history). */
  export type BackAnswer = 'ask' | 'stay' | 'summary' | 'leave';

  /** Why the pitch fell back to the layout without it (the code of the error log). */
  export type PitchFailure = 'pitch-chunk' | 'pitch-context' | 'pitch-draw';
  /** The pitch goes on, but an event had no disc (the code of the error log). */
  export type PitchIssue = 'pitch-unknown-player';
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { GameState } from '@engine';
  import type { LiveMatch, MatchSpeed } from '@lib/career';
  import type { Lang } from '@lib/config';
  import { t } from '@lib/i18n';
  import ActionBar from '../components/ActionBar.svelte';
  import BottomSheet from '../components/BottomSheet.svelte';
  import Button from '../components/Button.svelte';
  import CommentaryFeed from '../components/CommentaryFeed.svelte';
  import ErrorState from '../components/ErrorState.svelte';
  import Icon from '../components/Icon.svelte';
  import Scoreboard from '../components/Scoreboard.svelte';
  import ScreenHeader from '../components/ScreenHeader.svelte';
  import { shortNameOf } from '../round';
  import { popSheet, pushSheet, sheetOnTop } from '../sheet-history';
  import { MatchPlayer, type PlayerState } from '../match/player';
  import { matchSteps, viewAt, type MatchStep, type WatchMode } from '../match/steps';
  import { timingOf } from '../match/timing';
  import { loadPitch as loadPitchChunk, type PitchChunk } from '../match/pitch-loader';
  import type { PitchKits, PitchTagKits } from '../match/pitch/kits';
  import type { PitchTagView } from '../components/PitchTag.svelte';
  import { TAG_KIND_KEYS, tagPlanOf, type TagPlan } from '../match/tags';
  import type { Choreography, PitchScene } from '../match/pitch/scene';
  import {
    announcement,
    clockLabel,
    commentaryItem,
    nameOf,
    phaseLabel,
    scoreA11y,
    type NarrationContext,
  } from '../match/narration';

  /**
   * The narrated match (docs/design/telas/partida.md; US-020, T-032): full screen with no tabs,
   * the round as the `h1`, the live Scoreboard, the commentary with the most recent line on top and
   * the bar with Pausar/Retomar, Rápido and Pular. The events come whole from
   * `CareerService.liveMatch` before the kick-off; the screen only decides when each one is shown
   * (match/steps.ts and match/player.ts), so nothing here changes the result. At the final whistle
   * the round is played and stored by the frame (`onfinish`, the same input as the live match);
   * "Ver resumo" opens the summary in place of the match. Pular stops the clock, plays and stores,
   * and opens the summary directly. The page hidden pauses the match; it never resumes by itself.
   * The phone's back is the frame's (it owns the history): it asks `backAnswer` and, during the
   * match, `openLeave` pauses and asks "Sair da partida?". Nothing moves in the text: lines appear
   * in place, the outcome of a dramatic pause replaces its start, the score changes without
   * animation.
   *
   * The tags over the pitch (partida-campo-v2.md, 9; proposals 41, 47 and 48): the tag of a play,
   * the goal tag in place of the old celebration, and the shirt of the team over the ball in the
   * minutes with nothing shown. Which one each step has is `tagPlanOf` (match/tags.ts); the disc it
   * hangs from is the one the choreography made for the `PlayerId` of the event, and the name and
   * the number are that player's, as the commentary line of the same step says. The goal is still
   * announced in the live region of the board.
   *
   * In "Animada completa" the 2D pitch (T-085; partida.md, "Campo 2D") sits between the board and
   * the commentary, or on the left of two columns lying down and on the desktop. It comes in a
   * chunk of its own, asked at mount and never waited for: its room is already painted `pitch`.
   * The scene of each instant is the step revealed and its progress (the time since its reveal
   * over its duration at the speed it was shown at); the pitch is decorative and never runs ahead
   * of the text. With reduced motion it is still, one frame per step with a line. If the chunk
   * does not load, there is no 2D context or drawing throws, the pitch goes for the rest of the
   * match, with no notice and without stopping the clock (`onpitchfail` logs it).
   */
  interface Props {
    lang: Lang;
    /** The career before the round (names, clubs, stadium). */
    game: GameState;
    live: LiveMatch;
    mode: WatchMode;
    speed: MatchSpeed;
    /** "Rápido" was turned on or off (kept on the device by the frame). */
    onspeed: (speed: MatchSpeed) => void;
    /** Plays and stores the round; the same answer if asked again. */
    onfinish: () => Promise<FinishOutcome>;
    /** The summary in place of the match. */
    onsummary: () => void;
    /** "Voltar sem jogar" after the round failed to be played at the end. */
    onleave: () => void;
    /** Loads the chunk of the pitch (the tests give one that resolves or fails). */
    loadPitch?: () => Promise<PitchChunk>;
    /** The pitch fell back to the layout without it (once per match). */
    onpitchfail?: (code: PitchFailure, error?: unknown) => void;
    /** An event of a player not on the pitch: the pitch goes on without that disc. */
    onpitchissue?: (code: PitchIssue) => void;
  }
  const {
    lang,
    game,
    live,
    mode,
    speed,
    onspeed,
    onfinish,
    onsummary,
    onleave,
    loadPitch = loadPitchChunk,
    onpitchfail,
    onpitchissue,
  }: Props = $props();

  const TITLE_ID = 'match-title';
  const LEAVE = 'match-leave';
  const fixture = $derived(game.fixtures.find((f) => f.id === live.fixtureId));
  const ctx: NarrationContext = $derived({
    game,
    homeId: live.match.home.clubId,
    awayId: live.match.away.clubId,
    lang,
  });
  // The events of the match are fixed when the screen mounts (a new match is a new screen).
  // svelte-ignore state_referenced_locally
  const steps = matchSteps(live.result.events, mode);

  /** `playing` until the final whistle or Pular; then the write of the round. */
  type Stage = 'playing' | 'skipping' | 'saving' | 'saved' | 'unsaved' | 'failed';
  let stage: Stage = $state('playing');
  /** Pular, or "Pular para o resultado": the summary opens as soon as the round is stored. */
  let wantSummary = false;
  // svelte-ignore state_referenced_locally
  let run: PlayerState = $state.raw({
    index: -1,
    paused: false,
    pausing: false,
    speed,
    ended: false,
    stopped: false,
  });
  // svelte-ignore state_referenced_locally
  const player = new MatchPlayer(steps, {
    speed,
    onchange: (next) => {
      // Stopped at the end of a step (paused, the final whistle): the still pitch draws that end,
      // even when the pause came with the page hidden and the pitch already not running.
      if ((next.paused && !run.paused) || (next.ended && !run.ended)) version++;
      run = next;
    },
    onreveal: (step, index) => revealed(step, index),
    onend: () => void finish(),
  });

  const view = $derived(viewAt(steps, Math.max(run.index, 0), run.paused));
  const items = $derived(view.lines.map((line) => commentaryItem(line, ctx)));
  const minute = $derived(clockLabel(view.clock, lang));
  const spoken = $derived(view.announce === undefined ? '' : announcement(view.announce, ctx));
  const mine = $derived(live.side);
  const homeId = $derived(live.match.home.clubId);
  const awayId = $derived(live.match.away.clubId);
  const round = $derived(fixture?.round ?? game.round);
  const resumeShown = $derived(run.paused || run.pausing);
  const playing = $derived(stage === 'playing');

  // ------------------------------------------------- the width of Pausar/Retomar (proposal 38)
  let pauseWidth = $state(0);
  let resumeWidth = $state(0);
  /** The width of the longer label, so nothing moves under the thumb when it pauses. */
  const toggleWidth = $derived(
    pauseWidth > 0 && resumeWidth > 0 ? Math.ceil(Math.max(pauseWidth, resumeWidth)) : undefined,
  );

  function toggle(): void {
    if (!playing) return;
    player.toggle();
  }

  function fast(): void {
    if (!playing) return;
    const next: MatchSpeed = run.speed === 'fast' ? 'normal' : 'fast';
    player.setSpeed(next);
    onspeed(next);
  }

  async function finish(): Promise<void> {
    // The final whistle with "Sair da partida?" open: the sheet has nothing left to ask, and the
    // focus goes back to the heading, as on any close of the sheet.
    closeLeave();
    stage = wantSummary ? 'skipping' : 'saving';
    const outcome = await onfinish();
    if (outcome === 'failed') {
      stage = 'failed';
      return;
    }
    if (outcome === 'none') return;
    stage = outcome;
    if (wantSummary) onsummary();
  }

  /** Pular (and "Pular para o resultado"): no confirmation, the result is the same. */
  function skip(): void {
    closeLeave(false);
    wantSummary = true;
    if (stage === 'playing') {
      player.stop();
      void finish();
    } else if (stage === 'saved' || stage === 'unsaved') {
      onsummary();
    } else if (stage === 'saving') {
      stage = 'skipping';
    }
  }

  function toSummary(): void {
    if (stage === 'saved' || stage === 'unsaved') onsummary();
  }

  /**
   * "Tentar de novo" of the round that failed at the end: plays and stores again (or, when the
   * round was stored before the failure, takes it as it is), then the summary.
   */
  function retry(): void {
    if (stage !== 'failed') return;
    wantSummary = true;
    void finish();
  }

  // ------------------------------------------------------------- the 2D pitch (T-085)

  /** The chunk of the pitch, once loaded; the pitch is gone for good after a failure. */
  let pitch: PitchChunk | undefined = $state.raw();
  let pitchFailed = $state(false);
  let choreography: Choreography | undefined;
  let scene: PitchScene | undefined;
  /** The step revealed last, when and at what speed: the progress of the scene. */
  let revealIndex = 0;
  let revealAt = 0;
  let revealSpeed: MatchSpeed = 'normal';
  /** The last step with a line: the one frame with reduced motion. */
  let lineIndex = 0;
  /** Reduced motion as it was when the step on screen was revealed (it counts from it). */
  let reduced = $state(false);
  /** The screen's element, whose computed style says whether motion is reduced. */
  let screenElement: HTMLElement | undefined = $state();
  /** Each change draws one frame while the pitch is still. */
  let version = $state(0);
  let pageHidden = $state(false);

  // The room of the pitch (partida.md, "Celular em pé (360px), deitado e desktop").
  /** Two columns: lying down (`breakpoint-short`, 480px tall) and from the desktop (900px). */
  let wide = $state(false);
  let contentRect: DOMRectReadOnly | undefined = $state();
  const contentWidth = $derived(contentRect?.width ?? 0);
  /** The height the CSS leaves for the pitch (`.room`), and the header's. */
  let roomHeight = $state(0);
  let headHeight = $state(0);
  const pitchSize = $derived.by(() => {
    if (contentWidth === 0 || roomHeight === 0) return undefined;
    if (wide) {
      // The smaller of 60% of the width and (the column's height − the header) × 1.5.
      const width = Math.floor(Math.min(0.6 * contentWidth, (roomHeight - headHeight) * 1.5));
      return { width, height: Math.floor(width / 1.5) };
    }
    // Edge to edge; the smaller of the width ÷ 1.5 and the room under the board.
    return { width: contentWidth, height: Math.floor(Math.min(contentWidth / 1.5, roomHeight)) };
  });
  /** Under 120px of height there is no pitch (the layout of T-032). */
  const PITCH_MIN_HEIGHT = 120;
  const pitchShown = $derived(
    mode === 'full' &&
      !pitchFailed &&
      pitchSize !== undefined &&
      pitchSize.height >= PITCH_MIN_HEIGHT,
  );
  const twoColumns = $derived(pitchShown && wide);
  /** The colours of the discs, from the kit generator, once the chunk is here. */
  let pitchKits: PitchKits | undefined = $state.raw();
  /** The screen is gone: a chunk arriving late does nothing (nor logs for the next match). */
  let destroyed = false;
  const pitchRunning = $derived(
    pitchShown &&
      pitch !== undefined &&
      !reduced &&
      playing &&
      !pageHidden &&
      run.index >= 0 &&
      !run.paused &&
      !run.ended &&
      !run.stopped,
  );

  /**
   * Whether motion is reduced now, read once per step (never per frame) from the computed style of
   * the screen: `--motion-reduced` is 1 inside `@media (prefers-reduced-motion: reduce)`. Not the
   * MediaQueryList: in WebKit both its `change` event and its `matches` may stay stale until the
   * next rendering update, which may not come before the step (seen in the e2e (webkit) job with
   * the emulated media and a stopped clock), while computing the style evaluates the media at once.
   * The PitchTag follows the same media in its own CSS.
   */
  function motionReduced(): boolean {
    if (!screenElement) return reduced;
    return getComputedStyle(screenElement).getPropertyValue('--motion-reduced').trim() === '1';
  }

  /** The one point where each step is revealed: the pitch takes its time and speed here. */
  function revealed(step: MatchStep, index: number): void {
    revealIndex = index;
    revealAt = performance.now();
    revealSpeed = player.state.speed;
    reduced = motionReduced();
    if (step.line !== undefined) lineIndex = index;
    const changed = updateTags(step, index);
    // With reduced motion, one frame per step with a line, none in the minutes between them (but
    // one when a tag went away: the canvas holds its thread).
    if (!reduced || step.line !== undefined || changed) version++;
  }

  // ------------------------------------------------------------- the tags over the pitch (§9)

  /** The tags on the pitch now (the one on screen, the shirt over the ball, one fading out). */
  let tags: readonly PitchTagView[] = $state.raw([]);
  let tagKits: PitchTagKits | undefined;
  /** The owner of the ball in each step (possession.ts); 0: none. */
  let owners: Uint8Array | undefined;
  /**
   * The tag of a play or a goal on screen: how long it has been there, as the sum of the steps
   * shown since its entry (the clock of the match, not the wall clock, so a pause counts for
   * nothing), and the disc it hangs from.
   */
  let held: { plan: TagPlan; view: PitchTagView; age: number; disc: number } | undefined;
  let leaving: PitchTagView | undefined;
  let leavingTimer: ReturnType<typeof setTimeout> | undefined;
  /** The step before the one revealed now: how long it lasted at the speed it was shown at. */
  let lastDuration = 0;
  /** The least a tag of a play stays: from its entry to the first step that may take it away. */
  const TAG_MIN_MS = { normal: 1600, fast: 800 } as const;
  /** How long a leaving tag is kept if the end of its fade never comes (no transition runs). */
  const TAG_LEAVE_GRACE_MS = 240;

  function viewOf(plan: TagPlan, disc: number): PitchTagView {
    const id = plan.player;
    const kit = pitch!.tagKitOf(tagKits!, disc);
    const shirt = game.players[id]?.shirt;
    const kind = t(TAG_KIND_KEYS[plan.kind], lang);
    return {
      key: plan.key,
      tone: plan.tone,
      kind,
      name: nameOf(ctx, id),
      ...(shirt === undefined ? {} : { shirt }),
      kitSvg: kit.svg,
      number: kit.number,
      disc,
      leaving: false,
      still: reduced,
    };
  }

  function dropLeaving(): boolean {
    clearTimeout(leavingTimer);
    if (leaving === undefined) return false;
    leaving = undefined;
    return true;
  }

  function onTagLeft(key: string): void {
    if (leaving?.key !== key) return;
    dropLeaving();
    publishTags();
  }

  function publishTags(team?: PitchTagView): void {
    const next: PitchTagView[] = [];
    if (team !== undefined) next.push(team);
    if (leaving !== undefined) next.push(leaving);
    if (held !== undefined) next.push(held.view);
    tags = next;
  }

  /**
   * The tags of the step just revealed (docs/design/telas/partida-campo-v2.md, 9, "Tempos da
   * etiqueta do lance"): a new play replaces the one on screen at once; the same play (its start
   * and its outcome) only changes the kind; the tag leaves, fading in 120 ms, at the first step
   * without one that starts after the least time or when its disc leaves (the sent-off's stays at
   * its last point until the least time); the goal tag leaves at once at the next step. Returns
   * whether the tags on screen changed.
   */
  function updateTags(step: MatchStep, index: number): boolean {
    if (pitch === undefined || choreography === undefined || tagKits === undefined) return false;
    const speed = player.state.speed;
    const before = tags;
    const shownBefore = leaving !== undefined;
    dropLeaving();
    if (held !== undefined) held.age += lastDuration;
    lastDuration = timingOf(step.timing, speed);

    const plan = tagPlanOf(step);
    const disc = plan === undefined ? -1 : pitch.tagDiscOf(choreography, index);
    if (plan !== undefined && disc >= 0) {
      const view = viewOf(plan, disc);
      if (held?.plan.key === plan.key) {
        held.view = view;
        held.plan = plan;
        held.disc = disc;
      } else {
        held = { plan, view, age: 0, disc };
      }
    } else if (held !== undefined) {
      const sentOff = held.plan.kind === 'red';
      const discGone = !sentOff && !pitch.discShownIn(choreography, index, held.disc);
      if (held.plan.tone === 'goal') {
        held = undefined;
      } else if (held.age >= TAG_MIN_MS[speed] || discGone) {
        const out = { ...held.view, leaving: true };
        held = undefined;
        // Reduced motion: no fade, away at once.
        if (!reduced) {
          leaving = out;
          leavingTimer = setTimeout(() => {
            if (leaving?.key === out.key) onTagLeft(out.key);
          }, TAG_LEAVE_GRACE_MS);
        }
      }
    }

    // The shirt of the team over the ball: only in a minute with nothing shown, with no tag of a
    // play on screen, never with reduced motion, no number and no name.
    let team: PitchTagView | undefined;
    const owner = owners?.[index] ?? 0;
    if (!reduced && held === undefined && step.timing === 'minuteFull' && owner !== 0) {
      const kit = owner === 1 ? tagKits.home : tagKits.away;
      team = { key: 'team', tone: 'team', kitSvg: kit.svg, disc: -1, leaving: false, still: false };
    }
    publishTags(team);
    // Changed: something other than a step in the middle of the same tag.
    return (
      shownBefore || before.length !== tags.length || before.some((v, i) => v.key !== tags[i]!.key)
    );
  }

  /** The scene of the instant `now`, always the same object (nothing allocated per frame). */
  function frame(now: number): PitchScene {
    const chunk = pitch!;
    if (reduced) return chunk.stillScene(choreography!, lineIndex, scene!);
    const duration = timingOf(steps[revealIndex]?.timing, revealSpeed);
    const progress = run.paused || duration === 0 ? 1 : (now - revealAt) / duration;
    return chunk.sceneAt(choreography!, revealIndex, progress, scene!, revealSpeed);
  }

  /** The pitch is gone for the rest of the match: the layout of T-032, logged once. */
  function pitchFail(code: PitchFailure, error?: unknown): void {
    if (pitchFailed) return;
    pitchFailed = true;
    onpitchfail?.(code, error);
  }

  function startPitch(): void {
    loadPitch().then(
      (chunk) => {
        if (pitchFailed || destroyed) return;
        try {
          pitchKits = chunk.pitchKits(
            game.clubs[live.match.home.clubId]!.def,
            game.clubs[live.match.away.clubId]!.def,
          );
          // The steps of "Animada completa" (the only mode with the pitch).
          choreography = chunk.choreograph(
            steps,
            {
              home: { ...live.match.home.sheet.lineup, players: live.match.home.players },
              away: { ...live.match.away.sheet.lineup, players: live.match.away.players },
            },
            live.match.seed,
          );
          // An event of a player not on the pitch (a damaged save): no disc, a programming error.
          if (choreography.unknown.length > 0) onpitchissue?.('pitch-unknown-player');
          scene = chunk.createScene();
          tagKits = chunk.pitchTagKits(
            game.clubs[live.match.home.clubId]!.def,
            game.clubs[live.match.away.clubId]!.def,
          );
          owners = chunk.possessionOwners(
            steps,
            live.result.stats.home.possession,
            live.match.seed,
          );
        } catch (error) {
          pitchFail('pitch-draw', error);
          return;
        }
        pitch = chunk;
        version++;
      },
      (error: unknown) => {
        if (!destroyed) pitchFail('pitch-chunk', error);
      },
    );
  }

  // ----------------------------------------------------- "Sair da partida?" (decision 6)
  let leaveOpen = $state(false);
  let closingLeave = false;

  /** What the phone's back does now: ask during the match; once the round is stored, the summary. */
  export function backAnswer(): BackAnswer {
    if (stage === 'playing') return 'ask';
    if (stage === 'saved' || stage === 'unsaved') return 'summary';
    if (stage === 'failed') return 'leave';
    return 'stay';
  }

  /** The phone's back during the match: pause and ask, with an entry of its own. */
  export function openLeave(): void {
    if (stage !== 'playing' || leaveOpen) return;
    player.pause();
    leaveOpen = true;
    pushSheet(LEAVE);
  }

  /** The back of "Sair da partida?" was asked and its popstate has not come yet. */
  export function sheetClosing(): boolean {
    return closingLeave;
  }

  /** Closes the sheet; with `focus`, the focus goes back to the heading. */
  function closeLeave(focus = true): void {
    if (!leaveOpen) return;
    leaveOpen = false;
    if (sheetOnTop(LEAVE) && !closingLeave) {
      closingLeave = true;
      popSheet(LEAVE);
    }
    if (focus) void focusTitle();
  }

  /** "Continuar a partida": the sheet closes and the match goes on. */
  function stay(): void {
    closeLeave();
    player.resume();
  }

  async function focusTitle(): Promise<void> {
    await tick();
    document.getElementById(TITLE_ID)?.focus();
  }

  onMount(() => {
    void focusTitle();
    const columns = matchMedia('(min-width: 900px), (max-height: 480px)');
    const onColumns = () => (wide = columns.matches);
    onColumns();
    reduced = motionReduced();
    columns.addEventListener('change', onColumns);
    pageHidden = document.visibilityState === 'hidden';
    if (mode === 'full') startPitch();
    player.start();
    const onVisibility = () => {
      pageHidden = document.visibilityState === 'hidden';
      // Back on screen: one frame of where the match is (the pitch was still while hidden).
      if (!pageHidden) version++;
      if (pageHidden) player.pause();
    };
    const onPop = () => {
      closingLeave = false;
      // Back, the X or the backdrop took the sheet's entry: the match stays paused.
      if (leaveOpen && !sheetOnTop(LEAVE)) {
        leaveOpen = false;
        void focusTitle();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('popstate', onPop);
    return () => {
      destroyed = true;
      clearTimeout(leavingTimer);
      player.stop();
      columns.removeEventListener('change', onColumns);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('popstate', onPop);
    };
  });
</script>

{#snippet controls()}
  <span class="controls">
    <Button
      compact
      icon={resumeShown ? 'play' : 'pause'}
      minWidth={toggleWidth}
      disabled={!playing}
      onclick={toggle}>{t(resumeShown ? 'match.resume' : 'match.pause', lang)}</Button
    >
    <Button compact pressed={run.speed === 'fast'} disabled={!playing} onclick={fast}
      >{t('match.fast', lang)}</Button
    >
  </span>
{/snippet}

{#snippet saveState()}
  <span class="state" role="status">
    {#if stage === 'saved'}
      <Icon name="check" size={20} />
      <span class="body">{t('round.saved', lang)}</span>
    {:else if stage === 'unsaved'}
      <Icon name="warning" size={20} />
      <span class="body">{t('round.unsaved', lang)}</span>
    {:else}
      <span class="body">{t('round.saving', lang)}</span>
    {/if}
  </span>
{/snippet}

{#if stage === 'failed'}
  <ErrorState
    layout="screen"
    title={t('error.unexpected.title', lang)}
    message={t('match.error.body', lang)}
    code={t('error.code', lang, { code: 'unexpected' })}
    primary={{ label: t('action.retry', lang), onclick: retry, icon: 'retry' }}
    secondary={[{ label: t('match.error.leave', lang), onclick: onleave }]}
  />
{:else}
  <main
    bind:this={screenElement}
    class="match"
    class:two={twoColumns}
    data-fixture={live.fixtureId}
    data-mode={mode}
    bind:contentRect
  >
    <!-- One column: header, board, pitch, commentary (the columns are `display: contents` and
         the order is the CSS's). Two columns: header and pitch on the left, board and commentary
         on the right, with the bar at its foot on the desktop. -->
    <div class="col field-col">
      <div class="head" bind:clientHeight={headHeight}>
        <ScreenHeader title={t('round.title', lang, { round })} titleId={TITLE_ID} />
      </div>
      {#if pitchShown && pitchSize !== undefined}
        <div
          class="pitch-box"
          style:width="{pitchSize.width}px"
          style:height="{pitchSize.height}px"
        >
          {#if pitch !== undefined && pitchKits !== undefined}
            {@const Pitch = pitch.MatchPitch}
            <svelte:boundary onerror={(error) => pitchFail('pitch-draw', error)}>
              <Pitch
                kits={pitchKits}
                {frame}
                running={pitchRunning}
                {version}
                clubId={homeId}
                {round}
                {tags}
                onleft={onTagLeft}
                onfail={(reason, error) =>
                  pitchFail(reason === 'context' ? 'pitch-context' : 'pitch-draw', error)}
              />
            </svelte:boundary>
          {/if}
        </div>
      {/if}
    </div>
    <div class="col side-col">
      <div class="board">
        <Scoreboard
          size="md"
          home={{
            club: game.clubs[homeId]!.def,
            name: shortNameOf(game, homeId),
            goals: view.score[0],
          }}
          away={{
            club: game.clubs[awayId]!.def,
            name: shortNameOf(game, awayId),
            goals: view.score[1],
          }}
          versus={t('match.score.versus', lang)}
          {mine}
          meta={t('round.mine.meta', lang, {
            venue: t(`match.venue.${mine}`, lang),
            stadium: game.clubs[homeId]!.def.stadium.name,
          })}
          a11yLabel={scoreA11y(ctx, view.score)}
          live={{
            minute: minute.text,
            minuteA11y: minute.a11y,
            phase: phaseLabel(view.phase, lang),
            pausedText: t('match.paused', lang),
            paused: run.paused && playing,
          }}
          announcement={spoken}
          instance="match"
        />
      </div>
      <CommentaryFeed title={t('match.feed.title', lang)} {items} scroll />

      {#if stage === 'playing' || stage === 'skipping'}
        <ActionBar summary={controls}>
          <Button
            compact
            icon="skip"
            busy={stage === 'skipping'}
            busyLabel={t('match.skipping', lang)}
            onclick={skip}>{t('match.skip', lang)}</Button
          >
        </ActionBar>
      {:else}
        <ActionBar summary={saveState}>
          <Button variant="primary" busy={stage === 'saving'} onclick={toSummary}
            >{t('match.toSummary', lang)}</Button
          >
        </ActionBar>
      {/if}
    </div>
    {#if mode === 'full'}
      <div class="room" aria-hidden="true" bind:clientHeight={roomHeight}></div>
    {/if}
  </main>

  <!-- The two labels of the same button, measured out of sight: it takes the longer one. -->
  <div class="measure" aria-hidden="true" inert>
    <span bind:offsetWidth={pauseWidth}
      ><Button compact icon="pause">{t('match.pause', lang)}</Button></span
    >
    <span bind:offsetWidth={resumeWidth}
      ><Button compact icon="play">{t('match.resume', lang)}</Button></span
    >
  </div>
{/if}

{#snippet leaveFooter()}
  <div class="leave-foot">
    <Button variant="secondary" fullWidth icon="skip" onclick={skip}
      >{t('match.leave.skip', lang)}</Button
    >
    <Button variant="primary" fullWidth icon="play" onclick={stay}
      >{t('match.leave.stay', lang)}</Button
    >
  </div>
{/snippet}

<BottomSheet
  open={leaveOpen}
  title={t('match.leave.title', lang)}
  closeLabel={t('nav.close', lang)}
  onclose={() => closeLeave()}
  footer={leaveFooter}
>
  <div class="leave">
    <p class="body">{t('match.leave.body', lang)}</p>
  </div>
</BottomSheet>

<style>
  /* Full screen, one column: the board on top, the commentary filling the rest of the height and
     scrolling by itself, the bar fixed at the bottom (the room under the column is its height). */
  .match {
    /* Read by the screen at each step (`motionReduced`): 1 with reduced motion. */
    --motion-reduced: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: calc(var(--layout-content-max) + 2 * var(--space-4));
    margin: 0 auto;
    padding-bottom: calc(var(--touch) + 2 * var(--space-3) + 1px + env(safe-area-inset-bottom));
  }
  @media (prefers-reduced-motion: reduce) {
    .match {
      --motion-reduced: 1;
    }
  }
  /* One column: the two columns dissolve and their parts take the order of partida.md. */
  .col {
    display: contents;
  }
  .head {
    order: 1;
  }
  .board {
    order: 2;
    flex: none;
    padding: 0 var(--space-4) var(--space-3);
    border-bottom: 1px solid var(--line);
  }
  .pitch-box {
    order: 3;
    flex: none;
    /* The size is measured by script and arrives one frame after a resize (WebKit delivers it
       later than Chromium): until then a width from the old viewport must not push the page
       sideways. */
    max-width: 100%;
    position: relative;
    /* The leftover of the box, at the sides of the canvas, goes on as the stand: the edge of the
       drawing below the far line is stand, not grass (`PITCH_STAND_END` in motion.ts is the
       33%: this screen may not import the chunk, and `motion.test.ts` keeps the two equal). Tokens only. */
    background: linear-gradient(
      to bottom,
      var(--surface-0),
      var(--surface-2) 33%,
      var(--surface-0)
    );
  }
  .match :global(section.feed) {
    order: 4;
    flex: 1;
    min-height: 0;
    padding: var(--space-2) var(--space-2) var(--space-4);
  }
  /* The bar last (fixed on the phone; at the foot of the column on the desktop). */
  .side-col > :global(.bar) {
    order: 5;
  }
  /* The room the pitch may take (partida.md, "Celular em pé (360px), deitado e desktop"), as a
     height the screen reads. Standing: 100dvh − 442px (header 56, board 123, bar 69, the room of
     the commentary 24 and 3 lines of 54 with their 4px gaps, measured on the components of T-032)
     and the safe area, so the commentary never has fewer than 3 lines. Two columns: the height of
     the column (the header is taken off by the screen, measured). */
  .room {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: calc(100dvh - 442px - env(safe-area-inset-bottom));
    visibility: hidden;
    pointer-events: none;
  }
  /* Two columns (T-085): header and pitch on the left, board and commentary on the right. */
  .match.two {
    flex-direction: row;
    align-items: stretch;
    gap: var(--space-4);
    max-width: none;
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
  .two .col {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .two .field-col {
    flex: none;
  }
  .two .side-col {
    flex: 1;
    min-width: 0;
  }
  /* The board off the top of the screen, lying down and on the desktop. */
  .two .board {
    padding-top: var(--space-2);
  }
  /* breakpoint-short (design-system.md, "Altura baixa"): lying down, the bar stays fixed. */
  @media (max-height: 480px) {
    .room {
      height: calc(100dvh - var(--touch) - 2 * var(--space-3) - 1px - env(safe-area-inset-bottom));
    }
  }
  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .state {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .state :global(svg) {
    flex: none;
  }
  .measure {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    visibility: hidden;
    pointer-events: none;
  }
  .measure span {
    display: inline-flex;
  }
  /* 16px from the edge, under the title (the pattern of ConfirmSheet and MatchReport). */
  .leave {
    padding: var(--space-2) var(--space-2) 0;
  }
  .leave p {
    margin: 0;
  }
  .leave-foot {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-2) 0;
  }
  /* Desktop breakpoint (docs/02-architecture.md, 3). No token yet: componentes.md, proposal 1.
     The column of layout-content-max, and the bar sticks to its foot (ActionBar.svelte). */
  @media (min-width: 900px) {
    .match {
      max-width: calc(var(--layout-content-max) + 2 * var(--space-6));
      padding: var(--space-4) var(--space-6) 0;
    }
    /* T-085: the two columns inside layout-wide-max, the bar at the foot of the right one. */
    .match.two {
      max-width: var(--layout-wide-max);
      padding: var(--space-4) var(--space-6) 0;
    }
    .room {
      height: calc(100dvh - var(--space-4));
    }
  }
</style>
