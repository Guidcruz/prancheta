<script lang="ts">
  import type { ClubId, GameState, Player, PlayerId } from '@engine';
  import type { Lang } from '@lib/config';
  import { t, tPlural } from '@lib/i18n';
  import GroupRow from '../components/GroupRow.svelte';
  import PlayerRow, { type PlayerCell } from '../components/PlayerRow.svelte';
  import ScrollTable, { type TableColumn } from '../components/ScrollTable.svelte';
  import SegmentedControl from '../components/SegmentedControl.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import {
    formText,
    playerBadges,
    shownCondition,
    shownMorale,
    sortOrDefault,
    sortsFor,
    squadGroups,
    type SquadSort,
  } from '../squad';

  /**
   * The Elenco tab (docs/design/telas/elenco.md; US-016): the order (Posição, Nota and, in
   * Realismo completo, Condição) and the squad table with the fixed player column. A tap on a
   * player asks the screen to open the card. Server-renderable: the props are the whole input;
   * the sorted list comes in, so the card's "Anterior" and "Próximo" follow the same order.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    sort: SquadSort;
    /** The squad in `sort` order (`sortPlayers`). */
    players: readonly Player[];
    onsort: (sort: SquadSort) => void;
    onopen: (id: PlayerId) => void;
    loading?: boolean;
  }
  const { lang, game, clubId, sort, players, onsort, onopen, loading = false }: Props = $props();

  let table: HTMLElement | undefined = $state();

  const realism = $derived(game.rules.realism);
  const current = $derived(sortOrDefault(sort, realism));
  const options = $derived(
    sortsFor(realism).map((value) => ({ value, label: t(`squad.sort.${value}`, lang) })),
  );
  const columns = $derived.by((): TableColumn[] => {
    const list: TableColumn[] = [
      { id: 'player', label: t('squad.col.player', lang) },
      {
        id: 'overall',
        label: t('squad.col.overall', lang),
        full: t('squad.col.overall.full', lang),
        numeric: true,
        ...(current === 'overall' ? { sort: 'descending' as const } : {}),
      },
    ];
    if (realism === 'full') {
      list.push({
        id: 'condition',
        label: t('squad.col.condition', lang),
        full: t('squad.col.condition.full', lang),
        numeric: true,
        ...(current === 'condition' ? { sort: 'ascending' as const } : {}),
      });
    }
    list.push(
      { id: 'morale', label: t('squad.col.morale', lang), numeric: true },
      {
        id: 'form',
        label: t('squad.col.form', lang),
        full: t('squad.col.form.full', lang),
        numeric: true,
      },
      { id: 'age', label: t('squad.col.age', lang), numeric: true },
    );
    return list;
  });
  const groups = $derived(squadGroups(players, current, lang));
  const caption = $derived(
    tPlural('squad.caption', players.length, lang, {
      club: game.clubs[clubId]?.def.shortName ?? '',
    }),
  );

  function cells(player: Player): PlayerCell[] {
    const form = formText(player, lang);
    return [
      player.overall,
      ...(realism === 'full' ? [shownCondition(player)] : []),
      shownMorale(player),
      form ?? { text: '—', sr: t('squad.form.none', lang) },
      player.age,
    ];
  }

  /** The name button of a player of the list (where the focus returns after the card). */
  export function nameButton(id: PlayerId): HTMLElement | undefined {
    const at = players.findIndex((p) => p.id === id);
    const buttons = table?.querySelectorAll<HTMLElement>('tbody th[scope="row"] button');
    return at >= 0 ? buttons?.[at] : undefined;
  }
</script>

<div class="squad" bind:this={table}>
  {#if loading}
    <Skeleton label={t('squad.loading', lang)} count={8} />
  {:else}
    <SegmentedControl
      name="squad-sort"
      legend={t('squad.sort.legend', lang)}
      {options}
      value={current}
      onchange={(value) => onsort(value as SquadSort)}
    />
    <ScrollTable {caption} showCaption {columns}>
      {#each groups as group, g (group.label ?? g)}
        {#if group.label !== undefined}
          <GroupRow label={group.label} colspan={columns.length} />
        {/if}
        {#each group.players as player (player.id)}
          <PlayerRow
            name={player.name.display}
            positionCode={t(`position.${player.position}.short`, lang)}
            positionLabel={t(`position.${player.position}`, lang)}
            badges={playerBadges(player, realism, lang)}
            cells={cells(player)}
            onopen={() => onopen(player.id)}
          />
        {/each}
      {/each}
    </ScrollTable>
  {/if}
</div>

<style>
  .squad {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-block-start: var(--space-4);
    min-width: 0;
  }
</style>
