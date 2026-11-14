<script lang="ts">
  import type { ClubId, FixtureId, GameState, MatchSheet } from '@engine';
  import type { Lang } from '@lib/config';
  import { t } from '@lib/i18n';
  import BottomSheet from '../components/BottomSheet.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorState from '../components/ErrorState.svelte';
  import Icon from '../components/Icon.svelte';
  import MatchStatsTable from '../components/MatchStatsTable.svelte';
  import MatchTimeline from '../components/MatchTimeline.svelte';
  import Scoreboard from '../components/Scoreboard.svelte';
  import { readBlock } from '../club';
  import { matchReport } from '../report';

  /**
   * The match report of a match already played (docs/design/telas/resumo-rodada.md, "Súmula
   * (folha) — T-083"; US-019) in a BottomSheet: a dialog on the phone and, from 900px, the
   * floating dialog anchored by its base. `Fixture.result` plus the match sheet kept outside the
   * state (`sheet`, from `career.matchSheets`): with no sheet, a notice takes the place of the
   * events and the goals come from the result, and the rest stays. It knows nothing of the round
   * summary: the screen that opens it owns `fixtureId` and ties it to the history (the Calendário
   * of T-031 uses it too). A report that fails to build is a bug: an ErrorState `block` inside the
   * sheet, which keeps its close button, and `onerror` logs it. No footer: the X, back and the
   * backdrop close it. Nothing moves.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    /** The coach's club: bold on the board and the result badge, when it played. */
    clubId: ClubId;
    /** The match shown; `undefined`: closed. */
    fixtureId: FixtureId | undefined;
    /** The stored match sheet of that match (`career.matchSheets[fixtureId]`), if any. */
    sheet: MatchSheet | undefined;
    onclose: () => void;
    onerror?: (error: unknown) => void;
  }
  const { lang, game, clubId, fixtureId, sheet, onclose, onerror }: Props = $props();

  const RESULT_KIND = { W: 'win', D: 'draw', L: 'loss' } as const;
  const uid = $props.id();
  const motmId = `${uid}-motm`;
  const statsId = `${uid}-stats`;

  /** The report, or why there is none: not played (`undefined`) or an error building it. */
  const read = $derived(
    fixtureId === undefined
      ? undefined
      : readBlock(() => matchReport(game, fixtureId, sheet, clubId, lang)),
  );
  const report = $derived(read?.ok ? read.value : undefined);
  $effect(() => {
    if (read !== undefined && !read.ok) onerror?.(read.error);
  });
  const side = (id: ClubId, goals: number) => ({
    club: game.clubs[id]!.def,
    name: game.clubs[id]!.def.shortName,
    goals,
  });
</script>

{#snippet missingNotice()}
  <EmptyState
    icon="info"
    level={4}
    title={t('report.missing.title', lang)}
    message={t('report.missing.body', lang)}
  />
{/snippet}

<BottomSheet
  open={fixtureId !== undefined}
  title={t('report.title', lang)}
  closeLabel={t('nav.close', lang)}
  {onclose}
  scrollable
>
  {#if fixtureId === undefined}
    <!-- Closed: nothing to show. -->
  {:else if report === undefined}
    <ErrorState
      layout="block"
      title={t('club.error.block.title', lang)}
      message={t('club.error.block.body', lang)}
    />
  {:else}
    {@const fixture = report.fixture}
    <div class="report" data-fixture={fixture.id}>
      <p class="caption muted meta">{report.meta}</p>
      <Scoreboard
        home={side(fixture.homeId, fixture.result.score[0])}
        away={side(fixture.awayId, fixture.result.score[1])}
        versus={t('match.score.versus', lang)}
        mine={report.mine}
        badge={report.result === undefined
          ? undefined
          : { kind: RESULT_KIND[report.result], label: t(`result.${report.result}`, lang) }}
        size="md"
        a11yLabel={report.scoreA11y}
        instance="report"
      />
      {#if report.abandoned !== undefined}
        <p class="body abandoned">
          <Icon name="info" size={20} />
          <span>{report.abandoned}</span>
        </p>
      {/if}

      <MatchTimeline
        title={t('report.events.title', lang)}
        items={report.events}
        emptyText={t(report.missing ? 'round.goals.none' : 'report.events.none', lang)}
        notice={report.missing ? missingNotice : undefined}
      />

      {#if report.motm !== undefined}
        <section class="block motm" aria-labelledby={motmId}>
          <h3 class="subtitulo" id={motmId}>{t('report.motm.title', lang)}</h3>
          <p class="who">
            <Icon name="star" size={20} />
            <span class="body-strong name">{report.motm.name}</span>
            {#if report.motm.rating !== undefined}
              <span class="body rating">{report.motm.rating}</span>
            {/if}
          </p>
        </section>
      {/if}

      <section class="block" aria-labelledby={statsId}>
        <h3 class="subtitulo" id={statsId}>{t('report.stats.title', lang)}</h3>
        <MatchStatsTable
          caption={report.stats.caption}
          home={report.stats.home}
          away={report.stats.away}
          rows={report.stats.rows}
        />
      </section>

      <p class="caption muted place">{report.place}</p>
    </div>
  {/if}
</BottomSheet>

<style>
  .report {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-2) 0;
  }
  p,
  h3 {
    margin: 0;
  }
  .muted {
    color: var(--ink-muted);
  }
  .abandoned {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .abandoned :global(svg),
  .who :global(svg) {
    flex: none;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .who {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: var(--space-2);
  }
  .name {
    min-width: 0;
    overflow-wrap: break-word;
  }
  .rating {
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
