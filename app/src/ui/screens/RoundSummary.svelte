<script lang="ts" module>
  import type { NoticeAction } from '../components/actions';

  /** The state of the round's write, shown in the bar (CEO decision 6 of resumo-rodada.md). */
  export type RoundSaveState = 'saved' | 'unsaved' | 'saving';

  /** A notice of the summary's band (today only the refused write), already translated. */
  export interface RoundNotice {
    readonly key: string;
    readonly tone: 'danger' | 'warning' | 'info';
    readonly title: string;
    readonly message: string;
    readonly actions: readonly NoticeAction[];
  }
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { ClubId, FixtureId, GameState, MatchSheet } from '@engine';
  import type { Lang } from '@lib/config';
  import { t, tPlural } from '@lib/i18n';
  import ActionBar from '../components/ActionBar.svelte';
  import Banner from '../components/Banner.svelte';
  import Button from '../components/Button.svelte';
  import GoalList from '../components/GoalList.svelte';
  import Icon from '../components/Icon.svelte';
  import MatchCard from '../components/MatchCard.svelte';
  import Scoreboard from '../components/Scoreboard.svelte';
  import ScreenHeader from '../components/ScreenHeader.svelte';
  import SectionCard from '../components/SectionCard.svelte';
  import {
    changeLine,
    goalColumns,
    isDerby,
    otherCardLabel,
    roundSummary,
    shortHandedClub,
    shortNameOf,
  } from '../round';
  import { pushSheet, sheetField, sheetOnTop } from '../sheet-history';
  import MatchReport from './MatchReport.svelte';

  /**
   * The round summary (docs/design/telas/resumo-rodada.md; US-019, US-032), full screen with no
   * tabs: the coach's match (Scoreboard, result badge, goals), the position with its change and
   * the other nine results, read-only, and the bar with the state of the write and "Continuar".
   * It reads only the stored state of the career (`roundSummary`: the last round played), so it
   * is the same before and after a reload. On mount the focus goes to the heading, whose name is the
   * round followed by the result in words. Nothing moves.
   *
   * The match report (T-083) opens from "Súmula do jogo" in my match and from the card of each
   * other match, over the summary, with its own entry in the history (`pushSheet`): the phone's
   * back closes it and stays on the summary, forward to that entry opens it again, and closing it
   * gives the focus back to the button or card that opened it.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    save: RoundSaveState;
    notices?: readonly RoundNotice[];
    /** The stored match sheets of the season (`career.matchSheets`), for the match report. */
    sheets?: Readonly<Record<FixtureId, MatchSheet>>;
    oncontinue: () => void;
    /** Logs a match report that failed to build (lib/errors, without personal data). */
    onerror?: (error: unknown) => void;
  }
  const {
    lang,
    game,
    clubId,
    save,
    notices = [],
    sheets = {},
    oncontinue,
    onerror,
  }: Props = $props();

  const titleId = 'round-title';
  const barId = 'round-bar-state';
  const name = (id: ClubId) => shortNameOf(game, id);
  // The frame opens the summary only with a round played: none here is a bug, for the boundary.
  const summary = $derived.by(() => {
    const read = roundSummary(game, clubId);
    if (read === undefined) throw new Error('the last round played has no match of the club');
    return read;
  });
  const mine = $derived(summary.mine);
  const fixture = $derived(mine.fixture);
  const score = $derived(fixture.result.score);
  const resultWord = $derived(t(`result.${mine.result}`, lang));
  const resultA11y = $derived(
    t('round.result.a11y', lang, {
      result: resultWord,
      home: name(fixture.homeId),
      homeGoals: score[0],
      away: name(fixture.awayId),
      awayGoals: score[1],
    }),
  );
  const RESULT_KIND = { W: 'win', D: 'draw', L: 'loss' } as const;
  const shortHanded = $derived(shortHandedClub(fixture));
  const goals = $derived(goalColumns(game, fixture, lang));
  const change = $derived(
    summary.change === undefined ? undefined : changeLine(summary.change, lang),
  );
  const row = $derived(summary.standing);

  // ---------------------------------------------------------- the match report (T-083; US-019)

  const REPORT = 'report';
  let root: HTMLElement | undefined = $state();
  /** The match whose report is open; `undefined`: closed. */
  let reportId: FixtureId | undefined = $state();
  /** `history.back()` was asked and its popstate has not come yet: a second close waits. */
  let closingReport = false;

  function openReport(id: FixtureId): void {
    if (reportId !== undefined) return;
    pushSheet(REPORT, { fixture: id });
    reportId = id;
  }

  /** The button or card that opens the report of `id`: the focus returns there. */
  function openerOf(id: FixtureId): HTMLElement | null | undefined {
    if (id === fixture.id) return root?.querySelector<HTMLElement>('.sheet-open button');
    return root?.querySelector<HTMLElement>(`li[data-fixture="${CSS.escape(id)}"] button`);
  }

  async function reportClosed(): Promise<void> {
    const id = reportId;
    reportId = undefined;
    await tick();
    // Always to the one that opened it: the native dialog gives the focus back to whatever had it,
    // and a report opened by forward had none.
    if (id !== undefined) openerOf(id)?.focus();
  }

  function closeReport(): void {
    // A double tap on the X: the first back is on its way; a second one would leave the summary.
    if (closingReport) return;
    // Back removes the sheet's entry; the popstate then closes the sheet.
    if (sheetOnTop(REPORT)) {
      closingReport = true;
      history.back();
    } else void reportClosed();
  }

  onMount(() => {
    // The result is announced as the screen opens: the heading says it all (resumo-rodada.md,
    // "Acessibilidade"). The E2E makes the summary fail to draw through this very call, on the id
    // `round-title` (`failSummaryDraw`, tests/e2e/round-summary.spec.ts): keep both, or move that
    // hook along.
    document.getElementById(titleId)?.focus();
    // Mounted again on the report's entry ("Tentar de novo" of the boundary): the report too.
    reportId = sheetField(REPORT, 'fixture');
    const onPop = () => {
      closingReport = false;
      const id = sheetField(REPORT, 'fixture');
      if (id === undefined) {
        if (reportId !== undefined) void reportClosed();
      } else if (id !== reportId) {
        // Forward to the report's entry: it opens again on its match.
        reportId = id;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
</script>

{#snippet barState()}
  <span class="state" role="status" id={barId}>
    {#if save === 'saved'}
      <Icon name="check" size={20} />
      <span class="body">{t('round.saved', lang)}</span>
    {:else if save === 'unsaved'}
      <Icon name="warning" size={20} />
      <span class="body">{t('round.unsaved', lang)}</span>
    {:else}
      <span class="body">{t('round.saving', lang)}</span>
    {/if}
  </span>
{/snippet}

<main class="round" data-round={summary.round} bind:this={root}>
  <ScreenHeader
    title={t('round.title', lang, { round: summary.round })}
    titleA11y={resultA11y}
    {titleId}
  />
  <!-- Always mounted, so the notice of a write that fails later is announced. Empty, no room. -->
  <div class="band" role="status">
    {#each notices as notice (notice.key)}
      <Banner
        announce={false}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        actions={notice.actions}
      />
    {/each}
  </div>

  <div class="content">
    <section class="mine" aria-labelledby="round-mine-title" data-fixture={fixture.id}>
      <h2 class="visually-hidden" id="round-mine-title">{t('round.mine.title', lang)}</h2>
      <!-- The heading already says the result and the score: the board's row is not read again;
           its line of venue and stadium is. -->
      <Scoreboard
        home={{
          club: game.clubs[fixture.homeId]!.def,
          name: name(fixture.homeId),
          goals: score[0],
        }}
        away={{
          club: game.clubs[fixture.awayId]!.def,
          name: name(fixture.awayId),
          goals: score[1],
        }}
        versus={t('match.score.versus', lang)}
        mine={mine.venue}
        meta={t('round.mine.meta', lang, {
          venue: t(`match.venue.${mine.venue}`, lang),
          stadium: game.clubs[fixture.homeId]!.def.stadium.name,
        })}
        badge={{ kind: RESULT_KIND[mine.result], label: resultWord }}
        hidden
        instance="round-mine"
      />
      {#if shortHanded !== undefined}
        <p class="body abandoned">
          <Icon name="info" size={20} />
          <span>{t('match.abandoned', lang, { club: name(shortHanded) })}</span>
        </p>
      {/if}
      <GoalList columns={goals} emptyText={t('round.goals.none', lang)} />
      <div class="sheet-open">
        <Button variant="secondary" fullWidth onclick={() => openReport(fixture.id)}
          >{t('round.sheet.open', lang)}</Button
        >
      </div>
    </section>

    <SectionCard title={t('club.table.title', lang)}>
      <div class="standing">
        <p class="titulo position" data-position={row.position}>
          {t('club.table.position', lang, { position: row.position })}
        </p>
        {#if change !== undefined}
          <p class="body change" data-change={summary.change}>
            {#if change.icon}<Icon name={change.icon} size={20} />{/if}
            <span>{change.text}</span>
          </p>
        {/if}
      </div>
      <p class="body muted points">
        {`${tPlural('club.table.points', row.points, lang)} ${tPlural('club.table.played', row.played, lang)}`}
      </p>
    </SectionCard>

    <SectionCard title={t('round.others.title', lang)}>
      <div class="others-wrap">
        <ul class="others">
          {#each summary.others as other (other.id)}
            <li data-fixture={other.id}>
              <MatchCard
                home={{
                  club: game.clubs[other.homeId]!.def,
                  name: name(other.homeId),
                  goals: other.result.score[0],
                }}
                away={{
                  club: game.clubs[other.awayId]!.def,
                  name: name(other.awayId),
                  goals: other.result.score[1],
                }}
                badges={isDerby(game, other)
                  ? [{ kind: 'derby', label: t('match.derby', lang) }]
                  : []}
                note={other.result.abandoned ? t('match.abandoned.short', lang) : undefined}
                onclick={() => openReport(other.id)}
                a11yLabel={otherCardLabel(game, other, lang)}
                instance={`round-${other.id}`}
              />
            </li>
          {/each}
        </ul>
      </div>
    </SectionCard>
  </div>

  <ActionBar summary={barState}>
    <Button variant="primary" onclick={oncontinue}>{t('round.continue', lang)}</Button>
  </ActionBar>
</main>

<MatchReport
  {lang}
  {game}
  {clubId}
  fixtureId={reportId}
  sheet={reportId === undefined ? undefined : sheets[reportId]}
  onclose={closeReport}
  {onerror}
/>

<style>
  .round {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    max-width: calc(var(--layout-content-max) + 2 * var(--space-4));
    margin: 0 auto;
    /* Room under the last item for the fixed bar (ActionBar.svelte). */
    padding-bottom: calc(
      var(--touch) + 2 * var(--space-3) + var(--space-6) + env(safe-area-inset-bottom)
    );
  }
  p,
  ul {
    margin: 0;
  }
  .band {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0 var(--space-4);
  }
  .band:not(:empty) {
    padding-bottom: var(--space-2);
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4) 0;
    flex: 1;
  }
  .mine {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    box-shadow: var(--shadow-card);
  }
  .abandoned {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .abandoned :global(svg),
  .change :global(svg) {
    flex: none;
  }
  .standing {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: var(--space-3);
    row-gap: var(--space-1);
  }
  .position,
  .points {
    font-variant-numeric: tabular-nums;
  }
  .change {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    align-self: center;
  }
  .muted {
    color: var(--ink-muted);
  }
  .others-wrap {
    container-type: inline-size;
  }
  .others {
    display: grid;
    gap: var(--space-2);
    padding: 0;
    list-style: none;
  }
  /* Two columns once the list has 480px (breakpoint-card, design-system.md, "Card em duas
     colunas"): a phone lying down, the desktop. A CSS variable cannot sit in @container. */
  @container (min-width: 480px) {
    .others {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
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
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* Desktop breakpoint (docs/02-architecture.md, 3). No token yet: componentes.md, proposal 1.
     The bar sticks to the bottom of the column instead of the window. */
  @media (min-width: 900px) {
    /* The column of the frame without the sidebar (AppShell.svelte): content and bar share the
       width of layout-content-max. */
    .round {
      max-width: calc(var(--layout-content-max) + 2 * var(--space-6));
      padding: var(--space-4) var(--space-6) 0;
    }
    .band,
    .content {
      padding-inline: 0;
    }
  }
</style>
