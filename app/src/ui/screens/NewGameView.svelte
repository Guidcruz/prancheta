<script lang="ts">
  import { config, type Lang } from '@lib/config';
  import type { LastSetup, NewGameClub } from '@lib/career';
  import { t } from '@lib/i18n';
  import ActionBar from '../components/ActionBar.svelte';
  import Banner from '../components/Banner.svelte';
  import BottomSheet from '../components/BottomSheet.svelte';
  import Button from '../components/Button.svelte';
  import ClubPicker, { type ClubGroup } from '../components/ClubPicker.svelte';
  import Crest from '../components/Crest.svelte';
  import ErrorState from '../components/ErrorState.svelte';
  import OptionGroup from '../components/OptionGroup.svelte';
  import OptionsSummary from '../components/OptionsSummary.svelte';
  import ScreenHeader from '../components/ScreenHeader.svelte';
  import TextField from '../components/TextField.svelte';
  import { matchOptions, realismOptions, type CoachNameView, type StartProblem } from '../new-game';
  import { alertKey, hasAlertText } from '../save-alerts';

  /**
   * The new-game screen as the player sees it (docs/design/telas/novo-jogo.md): one step, the
   * options folded in a summary with their sheet, the clubs in three strength bands and the bar
   * with "Começar". Only texts and callbacks: NewGame.svelte keeps the choices and creates the
   * career.
   */
  interface Props {
    lang: Lang;
    groups: readonly ClubGroup[];
    selected?: string;
    /** The chosen club for the bar: crest, name, strength and band. */
    chosen?: {
      readonly club: NewGameClub['club'];
      readonly strength: number;
      readonly band: string;
    };
    coachName: string;
    coach: CoachNameView;
    setup: LastSetup;
    optionsOpen: boolean;
    creating: boolean;
    /** Creating took more than a second: the full loading screen. */
    slow: boolean;
    problem?: StartProblem;
    onback: () => void;
    onselect: (clubId: string) => void;
    onoptions: () => void;
    onclose: () => void;
    onname: (value: string) => void;
    onnameleave: () => void;
    onrealism: (value: string) => void;
    onmatch: (value: string) => void;
    onstart: () => void;
    /** "Ir para as carreiras" and "Liberar espaço": back to the list of the home screen. */
    onlist: () => void;
  }
  const {
    lang,
    groups,
    selected,
    chosen,
    coachName,
    coach,
    setup,
    optionsOpen,
    creating,
    slow,
    problem,
    onback,
    onselect,
    onoptions,
    onclose,
    onname,
    onnameleave,
    onrealism,
    onmatch,
    onstart,
    onlist,
  }: Props = $props();

  const barId = $props.id();
  const realisms = $derived(realismOptions(lang));
  const matches = $derived(matchOptions(lang));
  // "Dá para trocar depois" only when there is another mode to change to (one, for now: P3).
  const titleOf = (items: readonly { value: string; title: string }[], value: string) =>
    items.find((item) => item.value === value)?.title ?? '';
  const invalid = $derived(coach.problem !== undefined);
  const disabled = $derived(selected === undefined || invalid || groups.length === 0);

  function errorTexts(code: string): { title: string; message: string } {
    if (hasAlertText(code)) {
      return { title: t(alertKey(code, 'title'), lang), message: t(alertKey(code, 'body'), lang) };
    }
    return { title: t('error.unexpected.title', lang), message: t('error.unexpected.body', lang) };
  }
</script>

{#snippet barSummary()}
  {#if chosen}
    <Crest club={chosen.club} size="sm" instance="bar" />
    <span class="chosen">
      <span class="body-strong">{chosen.club.shortName}</span>
      <span class="caption line">
        {invalid
          ? t('newGame.bar.invalidName', lang)
          : t('newGame.bar.club', lang, { strength: chosen.strength, band: chosen.band })}
      </span>
    </span>
  {:else}
    <span class="body line">{t('newGame.bar.noClub', lang)}</span>
  {/if}
{/snippet}

<main class="new" aria-busy={creating || undefined}>
  <ScreenHeader title={t('newGame.title', lang)} backLabel={t('nav.back', lang)} {onback} />
  <div class="content" inert={creating || undefined}>
    <OptionsSummary
      title={t('newGame.options.title', lang)}
      items={[
        { label: t('newGame.options.coach', lang), value: coachName.trim() },
        { label: t('newGame.options.realism', lang), value: titleOf(realisms, setup.realism) },
        { label: t('newGame.options.match', lang), value: titleOf(matches, setup.matchMode) },
      ]}
      actionLabel={t('newGame.options.change', lang)}
      problem={invalid ? t('newGame.options.problem', lang) : undefined}
      onclick={onoptions}
    />
    {#if groups.length > 0}
      <ClubPicker
        name="club"
        legend={t('newGame.clubs.legend', lang)}
        hint={t('newGame.clubs.hint', lang)}
        strengthLabel={t('newGame.strength', lang)}
        {groups}
        {selected}
        {onselect}
      />
    {:else}
      {@const texts = errorTexts('invalid-clubs')}
      <ErrorState
        layout="block"
        title={texts.title}
        message={texts.message}
        code={t('error.code', lang, { code: 'invalid-clubs' })}
      />
    {/if}
  </div>
  {#if problem}
    <div class="problem">
      {#if problem.kind === 'career-limit'}
        <Banner
          tone="warning"
          title={t(alertKey('career-limit', 'title'), lang)}
          message={t(alertKey('career-limit', 'body'), lang)}
          actions={[{ label: t('newGame.limit.action', lang), onclick: onlist }]}
        />
      {:else if problem.kind === 'quota-exceeded'}
        <Banner
          tone="danger"
          title={t(alertKey('quota-exceeded', 'title'), lang)}
          message={t(alertKey('quota-exceeded', 'body'), lang)}
          actions={[{ label: t('action.free', lang), onclick: onlist }]}
        />
      {:else}
        {@const texts = errorTexts(problem.code)}
        <ErrorState
          layout="block"
          title={texts.title}
          message={texts.message}
          code={t('error.code', lang, { code: problem.code })}
          primary={{ label: t('action.retry', lang), onclick: onstart, icon: 'retry' }}
        />
      {/if}
    </div>
  {/if}
  <ActionBar summary={barSummary} summaryId={barId}>
    <Button
      variant="primary"
      disabled={disabled && !creating}
      busy={creating}
      busyLabel={t('newGame.start.busy', lang)}
      describedby={disabled && !creating ? barId : undefined}
      onclick={onstart}>{t('newGame.start', lang)}</Button
    >
  </ActionBar>
</main>

<BottomSheet
  open={optionsOpen}
  title={t('newGame.options.title', lang)}
  closeLabel={t('nav.close', lang)}
  {onclose}
>
  <div class="options">
    <div class="coach" onfocusout={onnameleave}>
      <TextField
        label={t('newGame.coach.label', lang)}
        value={coachName}
        hint={t('newGame.coach.hint', lang)}
        counter={coach.counter}
        counterOver={coach.over}
        error={coach.error}
        oninput={onname}
        onenter={onnameleave}
      />
    </div>
    <OptionGroup
      name="realism"
      legend={t('newGame.options.realism', lang)}
      note={t('newGame.realism.note', lang)}
      options={realisms}
      value={setup.realism}
      columns={2}
      onchange={onrealism}
    />
    <OptionGroup
      name="match"
      legend={t('newGame.options.match', lang)}
      note={matches.length > 1 ? t('newGame.match.note', lang) : undefined}
      options={matches}
      value={setup.matchMode}
      columns={1}
      onchange={onmatch}
    />
    <Button variant="secondary" fullWidth onclick={onclose}
      >{t('newGame.options.done', lang)}</Button
    >
  </div>
</BottomSheet>

{#if slow}
  <div class="loading" role="status">
    <p class="titulo brand">{config.name}</p>
    <p class="body">{t('newGame.loading', lang)}</p>
  </div>
{/if}

<style>
  .new {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    max-width: var(--layout-wide-max);
    margin: 0 auto;
    /* Room under the last item for the fixed bar (ActionBar.svelte). */
    padding-bottom: calc(
      var(--touch) + 2 * var(--space-3) + var(--space-6) + env(safe-area-inset-bottom)
    );
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-2) var(--space-4) 0;
    flex: 1;
  }
  .problem {
    padding: var(--space-4) var(--space-4) 0;
  }
  .chosen {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .line {
    color: var(--ink-muted);
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-2) var(--space-2) 0;
  }
  .loading {
    position: fixed;
    inset: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-8) var(--space-4);
    background: var(--surface-0);
    color: var(--ink);
    text-align: center;
  }
  .loading p {
    margin: 0;
  }
  .brand {
    text-transform: uppercase;
  }
  /* Desktop breakpoint (docs/02-architecture.md, 3). No token yet: componentes.md, proposal 1.
     The bar sticks to the bottom of the column instead of the window. */
  @media (min-width: 900px) {
    .new {
      padding-bottom: 0;
    }
  }
</style>
