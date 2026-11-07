<script lang="ts">
  import type { ClubId, GameState } from '@engine';
  import type { Lang } from '@lib/config';
  import { seasonOver } from '@lib/career';
  import { t, tPlural } from '@lib/i18n';
  import Crest from '../components/Crest.svelte';
  import ErrorState from '../components/ErrorState.svelte';
  import FanThermometer from '../components/FanThermometer.svelte';
  import LinkRow from '../components/LinkRow.svelte';
  import MatchCard from '../components/MatchCard.svelte';
  import SectionCard from '../components/SectionCard.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import TableRow from '../components/TableRow.svelte';
  import type { TabItem } from '../components/TabBar.svelte';
  import {
    absences,
    absencesLine,
    clubStanding,
    fanReading,
    formBadges,
    matchDate,
    nextMatch,
    preseason,
    readBlock,
    signed,
  } from '../club';
  import { hrefOf } from '../router';

  /**
   * The Clube tab (docs/design/telas/clube.md; US-015, US-026): the club, the next match with the
   * absences, the fans' thermometer and the standings near the club, and at the foot, on the
   * phone, the entries of the "Mais" menu. Each block fails alone (clube.md, "Erro num bloco"):
   * its reads of the career are guarded (`readBlock`), and an error rendering it is caught by its
   * own boundary; either way it becomes an ErrorState `block` with "Tentar de novo" and the others
   * stay. Server-renderable: the props are the whole input.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    /** The entries of the "Mais" menu, in its order (the frame builds them). */
    more: readonly TabItem[];
    /** Something is still being read (not the case today: the career is in memory). */
    loading?: boolean;
    /** Logs a block that failed (lib/errors, without personal data). */
    onerror?: (error: unknown) => void;
  }
  const { lang, game, clubId, more, loading = false, onerror }: Props = $props();

  const def = $derived(game.clubs[clubId]!.def);
  const progress = $derived(
    seasonOver(game)
      ? t('career.seasonOver', lang, { season: game.year })
      : t('career.progress', lang, { season: game.year, round: game.round }),
  );
  const nameOf = (id: ClubId) => game.clubs[id]?.def.shortName ?? id;

  /** "Tentar de novo" of a block whose read failed: read the career again. */
  let attempt = $state(0);
  const retry = () => attempt++;
  const nextBlock = $derived.by(() => {
    void attempt;
    return readBlock(() => ({ next: nextMatch(game, clubId), out: absences(game, clubId) }));
  });
  const fansBlock = $derived.by(() => {
    void attempt;
    return readBlock(() => fanReading(game.clubs[clubId]!.fans));
  });
  const tableBlock = $derived.by(() => {
    void attempt;
    return readBlock(() => {
      const standing = clubStanding(game, clubId);
      if (standing === undefined) throw new Error('the club is not in the standings');
      return { standing, before: preseason(game), form: formBadges(standing.mine.form, lang) };
    });
  });
  // A read that failed is a bug: logged once per failure, like the boundary does.
  $effect(() => {
    for (const block of [nextBlock, fansBlock, tableBlock]) if (!block.ok) onerror?.(block.error);
  });
  /** The mini table's columns after the club: short label shown, full name read. */
  const statColumns = $derived(
    (['played', 'goalDiff', 'points'] as const).map((id) => ({
      id,
      label: t(`table.col.${id}`, lang),
      full: t(`table.col.${id}.full`, lang),
    })),
  );
</script>

<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- Svelte passes the error first; onerror already got it -->
{#snippet blockFailed(_error: unknown, reset: () => void)}
  {@render blockError(reset)}
{/snippet}

{#snippet blockError(reset: () => void)}
  <ErrorState
    layout="block"
    title={t('club.error.block.title', lang)}
    message={t('club.error.block.body', lang)}
    primary={{ label: t('action.retry', lang), onclick: reset, icon: 'retry' }}
  />
{/snippet}

<div class="club">
  {#if loading}
    <Skeleton label={t('club.loading', lang)} shape="featured" count={3} />
  {:else}
    <div class="head">
      <Crest club={def} size="lg" instance="club" />
      <div class="who">
        <h2 class="titulo name">{def.shortName}</h2>
        <p class="body muted">{progress}</p>
      </div>
    </div>

    <div class="blocks">
      <div class="slot next" data-block="next">
        <svelte:boundary {onerror} failed={blockFailed}>
          {#if !nextBlock.ok}
            {@render blockError(retry)}
          {:else}
            {@const { next, out } = nextBlock.value}
            <SectionCard
              title={t('club.next.title', lang)}
              action={{
                label: t('club.next.action', lang),
                a11yLabel: t('club.next.actionA11y', lang),
                href: hrefOf('calendar'),
              }}
            >
              {#if next === undefined}
                <p class="body muted">{t('club.next.none', lang)}</p>
              {:else}
                {@const home = next.fixture.homeId}
                {@const away = next.fixture.awayId}
                <MatchCard
                  home={{ club: game.clubs[home]!.def, name: nameOf(home) }}
                  away={{ club: game.clubs[away]!.def, name: nameOf(away) }}
                  meta={t('club.next.meta', lang, {
                    round: next.fixture.round,
                    date: matchDate(next.fixture.date, lang),
                  })}
                  venueLabel={t(`match.venue.${next.venue}`, lang)}
                  mine={next.venue}
                  badges={next.derby ? [{ kind: 'derby', label: t('match.derby', lang) }] : []}
                  href={hrefOf('calendar')}
                  instance="next"
                />
                {#if out !== undefined}
                  <LinkRow label={absencesLine(out, lang)} icon="squad" href={hrefOf('squad')} />
                {/if}
              {/if}
            </SectionCard>
          {/if}
        </svelte:boundary>
      </div>

      <div class="slot fans" data-block="fans">
        <svelte:boundary {onerror} failed={blockFailed}>
          {#if !fansBlock.ok}
            {@render blockError(retry)}
          {:else}
            {@const reading = fansBlock.value}
            <SectionCard title={t('club.fans.title', lang)}>
              <FanThermometer
                value={reading.value}
                mood={reading.mood}
                moodLabel={t(`fans.mood.${reading.mood}`, lang)}
                scaleLabel={t('fans.scale', lang)}
                hint={t('club.fans.hint', lang)}
              />
            </SectionCard>
          {/if}
        </svelte:boundary>
      </div>

      <div class="slot table" data-block="table">
        <svelte:boundary {onerror} failed={blockFailed}>
          {#if !tableBlock.ok}
            {@render blockError(retry)}
          {:else}
            {@const { standing, before, form } = tableBlock.value}
            <SectionCard
              title={t('club.table.title', lang)}
              action={{
                label: t('club.table.action', lang),
                a11yLabel: t('club.table.actionA11y', lang),
                href: hrefOf('table'),
              }}
            >
              <div class="standing">
                <p
                  class="titulo position"
                  data-position={before ? undefined : standing.mine.position}
                >
                  {before
                    ? '—'
                    : t('club.table.position', lang, { position: standing.mine.position })}
                </p>
                <p class="body muted">
                  {before
                    ? t('club.table.preseason', lang)
                    : `${tPlural('club.table.points', standing.mine.points, lang)} ${tPlural(
                        'club.table.played',
                        standing.mine.played,
                        lang,
                      )}`}
                </p>
              </div>
              <!-- A plain table, not a ScrollTable: three rows that never scroll, so the club
                   column takes the room left (clube.md, "Classificação"; no 50% cap). -->
              <div class="mini">
                <table>
                  <caption class="visually-hidden">{t('club.table.caption', lang)}</caption>
                  <thead>
                    <tr>
                      <th scope="col" class="rotulo">{t('table.col.club', lang)}</th>
                      {#each statColumns as column (column.id)}
                        <th scope="col" class="rotulo numeric">
                          <abbr title={column.full}>
                            <span aria-hidden="true">{column.label}</span>
                            <span class="visually-hidden">{column.full}</span>
                          </abbr>
                        </th>
                      {/each}
                    </tr>
                  </thead>
                  <tbody>
                    {#each standing.window as row (row.clubId)}
                      <TableRow
                        position={row.position}
                        club={game.clubs[row.clubId]!.def}
                        name={nameOf(row.clubId)}
                        stats={[row.played, signed(row.goalDifference, lang), row.points]}
                        isMine={row.clubId === clubId}
                        mineLabel={t('table.mine', lang)}
                        instance="mini"
                      />
                    {/each}
                  </tbody>
                </table>
              </div>
              <div class="form">
                <p class="rotulo muted">{t('club.form.title', lang)}</p>
                {#if form.length === 0}
                  <p class="body">{t('club.form.none', lang)}</p>
                {:else}
                  <ul class="results">
                    {#each form as badge, i (i)}
                      <li><StatusBadge {...badge} letterOnly /></li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </SectionCard>
          {/if}
        </svelte:boundary>
      </div>
    </div>

    <section class="more" aria-labelledby="club-more-title">
      <h2 class="rotulo muted" id="club-more-title">{t('nav.more', lang)}</h2>
      <ul>
        {#each more as entry (entry.id)}
          <li><LinkRow label={entry.label} icon={entry.icon} href={entry.href} /></li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .club {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-block-start: var(--space-4);
    container-type: inline-size;
  }
  p,
  h2,
  ul {
    margin: 0;
  }
  .muted {
    color: var(--ink-muted);
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
  }
  .who {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  .name {
    overflow-wrap: anywhere;
  }
  .blocks {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }
  .slot {
    min-width: 0;
  }
  .standing {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .position,
  .standing p {
    font-variant-numeric: tabular-nums;
  }
  .mini {
    position: relative;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    overflow: hidden;
  }
  .mini table {
    inline-size: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }
  .mini thead th {
    position: relative;
    padding: var(--space-2);
    border-block-end: 1px solid var(--line);
    color: var(--ink-muted);
    text-align: start;
    white-space: nowrap;
  }
  .mini thead th:first-child {
    padding-inline-start: var(--space-3);
  }
  .mini .numeric {
    text-align: end;
  }
  .mini abbr {
    text-decoration: none;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .results {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    padding: 0;
    list-style: none;
  }
  .more {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .more ul {
    padding: 0;
    list-style: none;
  }
  /* Two columns from 720px of the content column (a phone lying down, the desktop): Próximo
     jogo and Classificação on the left, Torcida on the right. The DOM keeps the phone's order
     (next, fans, table), so screen readers and Tab follow it at every width. 720px is the
     layout break of design-system.md ("Padrões de layout"); a CSS variable cannot sit in
     @container. */
  @container (min-width: 720px) {
    .blocks {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
    }
    .next {
      grid-column: 1;
      grid-row: 1;
    }
    .table {
      grid-column: 1;
      grid-row: 2;
    }
    .fans {
      grid-column: 2;
      grid-row: 1 / span 2;
    }
  }
  /* The sidebar has every entry from 900px (the desktop break, docs/02-architecture.md, 3; no
     token yet: componentes.md, proposal 1). */
  @media (min-width: 900px) {
    .more {
      display: none;
    }
  }
</style>
