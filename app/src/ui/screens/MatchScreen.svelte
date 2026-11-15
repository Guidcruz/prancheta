<script lang="ts" module>
  /** How the round the match ends with went (the frame plays and stores it). */
  export type FinishOutcome = 'saved' | 'unsaved' | 'failed' | 'none';

  /** What the phone's back does now (the frame owns the history). */
  export type BackAnswer = 'ask' | 'stay' | 'summary' | 'leave';
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
  import { matchSteps, viewAt, type WatchMode } from '../match/steps';
  import {
    announcement,
    clockLabel,
    commentaryItem,
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
   * match, `openLeave` pauses and asks "Sair da partida?". Nothing moves: lines appear in place,
   * the outcome of a dramatic pause replaces its start, the score changes without animation.
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
  }
  const { lang, game, live, mode, speed, onspeed, onfinish, onsummary, onleave }: Props = $props();

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
    onchange: (next) => (run = next),
    onend: () => void finish(),
  });

  const view = $derived(viewAt(steps, Math.max(run.index, 0), run.paused));
  const items = $derived(view.lines.map((line) => commentaryItem(line, ctx)));
  const minute = $derived(clockLabel(view.clock, lang));
  const spoken = $derived(
    view.announce === undefined ? '' : announcement(view.announce.event, ctx),
  );
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

  /** "Tentar de novo" of the round that failed at the end: plays and stores again. */
  function retry(): void {
    if (stage === 'failed') void finish();
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
    player.start();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') player.pause();
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
      player.stop();
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
  <main class="match" data-fixture={live.fixtureId} data-mode={mode}>
    <ScreenHeader title={t('round.title', lang, { round })} titleId={TITLE_ID} />
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
          ...(run.paused && playing ? { paused: t('match.paused', lang) } : {}),
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
        <Button
          variant="primary"
          busy={stage === 'saving'}
          busyLabel={t('round.saving', lang)}
          onclick={toSummary}>{t('match.toSummary', lang)}</Button
        >
      </ActionBar>
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
  <p class="body leave">{t('match.leave.body', lang)}</p>
</BottomSheet>

<style>
  /* Full screen, one column: the board on top, the commentary filling the rest of the height and
     scrolling by itself, the bar fixed at the bottom (the room under the column is its height). */
  .match {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: calc(var(--layout-content-max) + 2 * var(--space-4));
    margin: 0 auto;
    padding-bottom: calc(var(--touch) + 2 * var(--space-3) + 1px + env(safe-area-inset-bottom));
  }
  .board {
    flex: none;
    padding: 0 var(--space-4) var(--space-3);
    border-bottom: 1px solid var(--line);
  }
  .match > :global(section.feed) {
    flex: 1;
    min-height: 0;
    padding: var(--space-2) var(--space-2) var(--space-4);
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
  .leave {
    margin: 0;
  }
  .leave-foot {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  /* Desktop breakpoint (docs/02-architecture.md, 3). No token yet: componentes.md, proposal 1.
     The column of layout-content-max, and the bar sticks to its foot (ActionBar.svelte). */
  @media (min-width: 900px) {
    .match {
      max-width: calc(var(--layout-content-max) + 2 * var(--space-6));
      padding: var(--space-4) var(--space-6) 0;
    }
  }
</style>
