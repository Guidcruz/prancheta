<script lang="ts" module>
  /** The views of the Elenco tab (escalacao.md, "Navegação"). */
  export type SquadViewId = 'squad' | 'lineup' | 'tactic';
  export const SQUAD_VIEWS: readonly SquadViewId[] = ['squad', 'lineup', 'tactic'];
</script>

<script lang="ts">
  import type { ClubId, DraftSheet, GameParams, GameState } from '@engine';
  import type { Lang } from '@lib/config';
  import { t } from '@lib/i18n';
  import SegmentedControl from '../components/SegmentedControl.svelte';
  import type { SquadSort } from '../squad';
  import Lineup from './Lineup.svelte';
  import Squad from './Squad.svelte';
  import Tactic from './Tactic.svelte';

  /**
   * The Elenco tab with the selector Elenco | Escalação | Tática on top (escalacao.md,
   * "Navegação"; elenco.md). Changing the view adds no entry to the history: the phone's back
   * leaves the tab as before. The view chosen lives in the frame while the career is open, as the
   * order of the Elenco does. The Escalação (T-029) and the Tática (T-077) edit the same coach's
   * sheet through `onedit`.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    view: SquadViewId;
    onview: (view: SquadViewId) => void;
    sort: SquadSort;
    onsort: (sort: SquadSort) => void;
    /** The coach's sheet as shown (`coachSheet`). */
    sheet: DraftSheet;
    params: Pick<GameParams, 'ai'>;
    onedit: (sheet: DraftSheet) => void;
    onerror?: (error: unknown) => void;
  }
  const { lang, game, clubId, view, onview, sort, onsort, sheet, params, onedit, onerror }: Props =
    $props();

  const options = $derived(
    SQUAD_VIEWS.map((value) => ({ value, label: t(`squad.view.${value}`, lang) })),
  );
</script>

<div class="tab">
  <SegmentedControl
    name="squad-view"
    legend={t('squad.view.legend', lang)}
    hideLegend
    {options}
    value={view}
    onchange={(value) => onview(value as SquadViewId)}
  />
  {#if view === 'lineup'}
    <Lineup
      {lang}
      {game}
      {clubId}
      {sheet}
      {params}
      {onedit}
      ontactic={() => onview('tactic')}
      {onerror}
    />
  {:else if view === 'tactic'}
    <Tactic {lang} {game} {clubId} {sheet} {onedit} />
  {:else}
    <Squad {lang} {game} {clubId} {sort} {onsort} {onerror} />
  {/if}
</div>

<style>
  .tab {
    display: flex;
    flex-direction: column;
    padding-block-start: var(--space-4);
    min-width: 0;
  }
</style>
