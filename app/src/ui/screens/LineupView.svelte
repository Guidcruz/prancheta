<script lang="ts">
  import { BENCH_SIZE, sheetProblems, type ClubId, type DraftSheet, type GameState } from '@engine';
  import type { Lang } from '@lib/config';
  import { t, tPlural } from '@lib/i18n';
  import Banner from '../components/Banner.svelte';
  import Button from '../components/Button.svelte';
  import LineupGroup from '../components/LineupGroup.svelte';
  import LineupIssues from '../components/LineupIssues.svelte';
  import LineupPitch from '../components/LineupPitch.svelte';
  import LineupRow from '../components/LineupRow.svelte';
  import LineupStatusBar, { type StatusBarAction } from '../components/LineupStatusBar.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import StrengthBars from '../components/StrengthBars.svelte';
  import {
    benchCount,
    benchRows,
    incompleteMessage,
    lineupIssues,
    outFreeRow,
    outRows,
    pitchSlots,
    shownStrength,
    strengthItems,
    samePlace,
    type Place,
    type PlaceStates,
    type ShownStrength,
  } from '../lineup';

  /**
   * The Escalação view (docs/design/telas/escalacao.md; US-017): the strength of the team, the
   * formation, the pitch, the warnings, "Sugerir escalação", the bench, the players left out and
   * the status bar at the thumb. Server-renderable: the props are the whole input; the screen
   * (Lineup.svelte) owns the swaps, the drag, the card and the history. Every number comes from
   * the engine's readings through ui/lineup.ts.
   */
  interface Status {
    message: string;
    detail?: string;
    tone?: 'neutral' | 'danger';
    actions?: readonly StatusBarAction[];
    /** Changes with every message said, also a repeated one (it is announced again). */
    said?: number;
  }
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    /** The sheet shown (reconciled; `coachSheet`). */
    sheet: DraftSheet;
    /** Picked, dragged over, origin of the drag, refused. */
    states?: PlaceStates;
    /** The strength before the last change: the arrows and signed numbers. */
    before?: ShownStrength;
    /** The reason under the row of the athlete of a refused swap. */
    refusal?: { place: Place; message: string };
    status?: Status;
    /** Condition shown below which a starter is tired (`ai.rotationCondition`). */
    tiredBelow: number;
    loading?: boolean;
    onplace?: (place: Place, event: MouseEvent) => void;
    onpress?: (place: Place, event: PointerEvent) => void;
    oncomplete?: () => void;
    onsuggest?: () => void;
    ontactic?: () => void;
  }
  const {
    lang,
    game,
    clubId,
    sheet,
    states = {},
    before,
    refusal,
    status = { message: '' },
    tiredBelow,
    loading = false,
    onplace,
    onpress,
    oncomplete,
    onsuggest,
    ontactic,
  }: Props = $props();
  const id = $props.id();
  const hintId = `${id}-hint`;

  const realism = $derived(game.rules.realism);
  const formation = $derived(sheet.lineup.formation);
  const check = $derived(sheetProblems(game, clubId, sheet));
  const strength = $derived(strengthItems(shownStrength(game, clubId, sheet), before, lang));
  const slots = $derived(pitchSlots(game, clubId, sheet, states, lang));
  const bench = $derived(benchRows(game, sheet, states, lang));
  const out = $derived(outRows(game, clubId, sheet, states, lang));
  const freeOut = $derived(outFreeRow(states, lang));
  const issues = $derived(lineupIssues(game, clubId, sheet, check, tiredBelow, lang));
  const columns = $derived(
    realism === 'full'
      ? [t('squad.col.overall', lang), t('squad.col.condition', lang)]
      : [t('squad.col.overall', lang)],
  );
  /** While a player is picked, every place points to the hint of the status bar. */
  const describedby = $derived(states.selected === undefined ? undefined : hintId);
  /** "Formação 4-4-2" with the formation in bold: the text around it comes from the content. */
  const formationLine = $derived.by(() => {
    const MARK = '\u0001';
    const [pre = '', post = ''] = t('lineup.formation.line', lang, { formation: MARK }).split(MARK);
    return { pre, post };
  });
  const refusalOf = (place: Place) =>
    samePlace(place, refusal?.place) ? refusal?.message : undefined;
</script>

<div class="lineup">
  {#if loading}
    <Skeleton label={t('lineup.loading', lang)} count={3} />
  {:else}
    {#if !check.ready}
      <Banner
        announce={false}
        tone="warning"
        title={t('lineup.invalid.title', lang)}
        message={incompleteMessage(check, lang)}
        actions={[{ label: t('lineup.complete', lang), onclick: () => oncomplete?.() }]}
      />
    {/if}
    {#if check.available < 11}
      <Banner
        announce={false}
        tone="info"
        title={t('lineup.issues.title', lang)}
        message={tPlural('lineup.issue.short', check.available, lang)}
      />
    {/if}
    <div class="columns">
      <div class="main">
        <StrengthBars
          title={t('lineup.strength.title', lang)}
          items={strength}
          helpLabel={t('lineup.strength.help.label', lang)}
          help={t(`lineup.strength.help.${realism === 'full' ? 'full' : 'simplified'}`, lang)}
        />
        <div class="formation">
          <p class="body">
            {formationLine.pre}<strong class="body-strong">{formation}</strong>{formationLine.post}
          </p>
          <Button variant="ghost" onclick={() => ontactic?.()}
            >{t('lineup.formation.change', lang)}</Button
          >
        </div>
        <LineupPitch
          {formation}
          {slots}
          label={t('lineup.pitch.label', lang, { formation })}
          emptyLabel={t('lineup.slot.empty', lang)}
          captainShort={t('lineup.captain.short', lang)}
          {describedby}
          onslot={(index, event) => onplace?.({ part: 'starters', index }, event)}
          onslotpointerdown={(index, event) => onpress?.({ part: 'starters', index }, event)}
        />
        <LineupIssues title={t('lineup.issues.title', lang)} items={issues} />
        <div class="suggest">
          <Button icon="suggest" onclick={() => onsuggest?.()}>{t('lineup.suggest', lang)}</Button>
        </div>
      </div>
      <div class="lists">
        <LineupGroup
          title={t('lineup.bench.title', lang)}
          count={t('lineup.bench.count', lang, { count: benchCount(sheet), max: BENCH_SIZE })}
          {columns}
        >
          {#each bench as row (row.dataPlace)}
            <LineupRow
              positionCode={row.positionCode}
              secondaryCode={row.secondaryCode}
              a11yLabel={row.a11yLabel}
              name={row.name}
              emptyLabel={t('lineup.bench.empty', lang)}
              badges={row.badges}
              cells={row.cells}
              state={row.state}
              message={refusalOf(row.place)}
              place={row.dataPlace}
              {describedby}
              onclick={(event) => onplace?.(row.place, event)}
              onpointerdown={(event) => onpress?.(row.place, event)}
            />
          {/each}
        </LineupGroup>
        <LineupGroup title={t('lineup.out.title', lang)} {columns}>
          <!-- "Deixar de fora", always first and always there, so nothing jumps on a pick. -->
          <LineupRow
            a11yLabel={freeOut.a11yLabel}
            emptyLabel={t('lineup.out.free', lang)}
            state={freeOut.state}
            place={freeOut.dataPlace}
            {describedby}
            onclick={(event) => onplace?.(freeOut.place, event)}
            onpointerdown={(event) => onpress?.(freeOut.place, event)}
          />
          {#each out as row (row.dataPlace)}
            <LineupRow
              positionCode={row.positionCode}
              secondaryCode={row.secondaryCode}
              a11yLabel={row.a11yLabel}
              name={row.name}
              badges={row.badges}
              cells={row.cells}
              state={row.state}
              message={refusalOf(row.place)}
              place={row.dataPlace}
              {describedby}
              onclick={(event) => onplace?.(row.place, event)}
              onpointerdown={(event) => onpress?.(row.place, event)}
            />
          {/each}
        </LineupGroup>
      </div>
    </div>
  {/if}
  <!-- Always in the DOM (the one live region of the screen), last, so it can stick to the foot. -->
  <LineupStatusBar
    message={status.message}
    detail={status.detail}
    detailId={hintId}
    tone={status.tone}
    actions={status.actions}
    said={status.said}
  />
</div>

<style>
  .lineup {
    /* The two columns follow the content's width (the "tabela vira cartões" 720px), not the
       window's: a variable does not work in @container. */
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-block-start: var(--space-4);
    min-width: 0;
  }
  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-6);
    align-items: start;
  }
  .main,
  .lists {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }
  @container (min-width: 720px) {
    .columns {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .formation {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .formation p {
    margin: 0;
  }
  .suggest {
    display: flex;
  }
</style>
