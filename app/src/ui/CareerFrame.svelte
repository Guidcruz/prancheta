<script lang="ts">
  import { onMount } from 'svelte';
  import { sheetProblems, type DraftSheet } from '@engine';
  import type { Lang } from '@lib/config';
  import {
    roundBlock,
    seasonOver,
    type CareerService,
    type CareerState,
    type RoundBlock,
  } from '@lib/career';
  import type { ErrorLog } from '@lib/errors';
  import { shieldSpecFor, shieldSvg } from '@lib/generators/shield';
  import { t, tPlural } from '@lib/i18n';
  import AppShell from './components/AppShell.svelte';
  import Banner from './components/Banner.svelte';
  import BottomSheet from './components/BottomSheet.svelte';
  import Button from './components/Button.svelte';
  import ErrorBoundary from './components/ErrorBoundary.svelte';
  import ErrorState from './components/ErrorState.svelte';
  import LineupIssues, { BLOCKING_ISSUES } from './components/LineupIssues.svelte';
  import LinkRow from './components/LinkRow.svelte';
  import ScreenHeader from './components/ScreenHeader.svelte';
  import type { TabItem } from './components/TabBar.svelte';
  import type { NoticeAction } from './components/actions';
  import {
    NAV_EXTRA,
    NAV_SETTINGS,
    NAV_TABS,
    NAV_TUTORIAL,
    type NavDestination,
  } from './components/nav-items';
  import { createDraftWriter } from './draft-writer';
  import { coachSheet, lineupIssues } from './lineup';
  import { roundSheet } from './tactic';
  import { noticeActions } from './notice-actions';
  import {
    HOME_DESTINATION,
    SAVES_DESTINATION,
    destinationOf,
    hrefOf,
    labelKeyOf,
    type DestinationId,
  } from './router';
  import { alertKey, draftActions, hasAlertText, unsavedActions } from './save-alerts';
  import { pushSheet, sheetOnTop } from './sheet-history';
  import ClubView from './screens/ClubView.svelte';
  import Placeholder from './screens/Placeholder.svelte';
  import Saves from './screens/Saves.svelte';
  import SquadTab, { type SquadViewId } from './screens/SquadTab.svelte';
  import type { SquadSort } from './squad';

  /**
   * The frame of an open career (docs/design/telas/navegacao.md): tabs at the bottom on the
   * phone, sidebar from 900px, the "Mais" menu, the notice band, "Jogar rodada" and the error
   * boundary around the screen of each destination. Clube and Elenco are the T-028 screens (the
   * Elenco tab with the Escalação of T-029) and Carreiras e backup the T-025 one; the others are
   * placeholders until their tasks (T-031, T-034...).
   *
   * The coach's sheet (ADR-0021; T-029) is read here, because "Jogar rodada" needs it on every
   * tab: the draft of the save (or the edit held while a round is played, `draft-writer.ts`), or
   * the engine's suggestion while the coach never touched it. A sheet that cannot go to the round
   * keeps the button tappable with its reason, and the tap opens "Escalação incompleta".
   */
  interface Props {
    career: CareerState;
    service: CareerService;
    log: ErrorLog;
    lang: Lang;
    onhome: () => void;
  }
  const { career, service, log, lang, onhome }: Props = $props();

  let current: DestinationId = $state(
    destinationOf(typeof location === 'undefined' ? '' : location.hash),
  );
  let sheetOpen = $state(false);
  /** The "Mais" sheet asked `history.back()` and its popstate has not come yet. */
  let closingSheet = false;
  let noticeBand: HTMLElement | undefined = $state();
  let errorArea: HTMLElement | undefined = $state();
  /**
   * The content area shows the unexpected error: a bug while playing (`crash`), or a save the
   * store refused as not of the format (`invalid-save`), with its code.
   */
  const areaError = $derived(
    career.crash !== undefined
      ? ('unexpected' as const)
      : career.unsaved === 'invalid-save'
        ? ('invalid-save' as const)
        : undefined,
  );

  const item = (d: NavDestination): TabItem => ({
    id: d.id,
    icon: d.icon,
    label: t(d.labelKey, lang),
    href: hrefOf(d.id),
  });
  const tabs = $derived(NAV_TABS.map(item));
  // Rede social is on until Preferências can turn it off (T-041).
  const extra = $derived(NAV_EXTRA.map(item));
  const settings = $derived(NAV_SETTINGS.map(item));
  const more = $derived([...extra, ...settings, item(NAV_TUTORIAL)]);

  const save = $derived(career.save!);
  /** The parameters the rounds are played with: the suggestion shown is the one played. */
  const params = $derived(service.params);
  const writer = createDraftWriter({
    get state() {
      return service.state;
    },
    setDraft: (next) => service.setDraft(next),
  });
  const held = writer.held;
  /** The sheet shown and played: the edit held, the coach's draft or the engine's suggestion. */
  const sheet = $derived(
    coachSheet(
      save.game,
      save.career.clubId,
      ($held?.careerId === save.careerId ? $held.sheet : undefined) ?? save.career.draft,
      params,
    ),
  );
  /** The coach never touched the sheet: the round plays the engine's suggestion, as shown. */
  const untouched = $derived(save.career.draft === undefined && $held === undefined);
  const check = $derived(sheetProblems(save.game, save.career.clubId, sheet));
  /**
   * The view of the Elenco tab while this career is open (escalacao.md, "Navegação"): the
   * frame's state, never the save's, and no entry in the history.
   */
  let squadView: { careerId: string; view: SquadViewId } | undefined = $state();
  const view = $derived(squadView?.careerId === save.careerId ? squadView.view : 'squad');
  const setView = (next: SquadViewId) => (squadView = { careerId: save.careerId, view: next });
  /**
   * The order of the Elenco while this career is open (elenco.md): the screen's state, kept here
   * because the tab remounts on every visit; never in the save.
   */
  let squadSort: { careerId: string; sort: SquadSort } | undefined = $state();
  const sort = $derived(
    squadSort?.careerId === save.careerId ? squadSort.sort : ('position' as const),
  );
  const club = $derived.by(() => {
    const def = save.game.clubs[save.career.clubId]?.def;
    return def === undefined
      ? undefined
      : { name: def.name, crestSvg: shieldSvg(shieldSpecFor(def), 32) };
  });

  const BLOCK_KEYS: Readonly<Record<RoundBlock, string>> = {
    unsaved: 'play.blocked.unsaved',
    'season-over': 'play.blocked.seasonOver',
  };
  const block = $derived(roundBlock(career));
  /** The sheet cannot go to the round (US-017): the button keeps working and says why. */
  const lineupBlocked = $derived(block === undefined && !check.ready);
  const playRound = $derived({
    state: career.busy
      ? ('busy' as const)
      : block || lineupBlocked
        ? ('blocked' as const)
        : ('ready' as const),
    label: t('play.label', lang),
    hint:
      block !== undefined
        ? t(BLOCK_KEYS[block], lang)
        : lineupBlocked
          ? t('play.blocked.lineup', lang)
          : undefined,
    busyLabel: t('play.busy', lang),
    onplay,
  });

  interface Notice {
    readonly key: string;
    readonly tone: 'danger' | 'warning' | 'info';
    readonly title: string;
    readonly message: string;
    readonly actions: NoticeAction[];
  }
  const TONE_ORDER = { danger: 0, warning: 1, info: 2 } as const;
  const notices = $derived.by(() => {
    const list: Notice[] = [];
    const unsaved = career.unsaved;
    // `invalid-save` is a bug: it takes the content area as an unexpected error, not a banner.
    if (unsaved !== undefined && unsaved !== 'invalid-save') {
      list.push({
        key: `unsaved-${unsaved}`,
        tone: 'danger',
        title: t(alertKey(unsaved, 'title'), lang),
        message: t(alertKey(unsaved, 'body'), lang),
        actions: noticeActions(
          unsavedActions(unsaved),
          { retry, home: onhome, free: openSaves },
          lang,
        ),
      });
    }
    // The coach's sheet did not reach the device; with a round unsaved its banner covers both.
    const draftUnsaved = career.draftUnsaved;
    if (draftUnsaved !== undefined && unsaved === undefined) {
      const code = hasAlertText(draftUnsaved) ? draftUnsaved : 'write-failed';
      list.push({
        key: `draft-${draftUnsaved}`,
        tone: 'danger',
        title: t(alertKey(code, 'title'), lang),
        message: t(alertKey(code, 'body'), lang),
        actions: noticeActions(
          draftActions(draftUnsaved),
          { retry: () => void service.retryDraft(), free: openSaves },
          lang,
        ),
      });
    }
    if (career.roundsLost > 0) {
      list.push({
        key: 'rounds-lost',
        tone: 'warning',
        title: t('save.roundsLost.title', lang),
        message: tPlural('save.roundsLost.body', career.roundsLost, lang),
        actions: [
          {
            label: t('save.roundsLost.action.ok', lang),
            onclick: () => service.dismissRoundsLost(),
          },
        ],
      });
    }
    // The gravest on top, at most two visible; the others wait (erros-e-avisos.md).
    return list.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, 2);
  });

  const placeholderLines = $derived(
    seasonOver(save.game)
      ? [t('career.seasonOver', lang, { season: save.game.year })]
      : [t('career.progress', lang, { season: save.game.year, round: save.game.round })],
  );

  const boundaryCopy = $derived({
    title: t('error.unexpected.title', lang),
    message: t('error.unexpected.body', lang),
    retry: t('action.retry', lang),
    home: t('action.home', lang),
  });

  function retry(): void {
    void service.retrySave();
  }

  function onplay(): void {
    if (areaError !== undefined) {
      // The way out is in the error of the content area: take the focus there.
      errorArea?.querySelector<HTMLElement>('h2')?.focus();
      return;
    }
    if (block === 'unsaved') {
      // "Ao tocar, leva ao aviso com as saídas" (navegacao.md): the banner of the notice band.
      noticeBand?.scrollIntoView({ block: 'nearest' });
      noticeBand?.querySelector<HTMLElement>('button, a')?.focus();
      return;
    }
    // The end of the season has its own screens (T-037).
    if (block === 'season-over') return;
    if (!check.ready) {
      openCheck();
      return;
    }
    play();
  }

  /**
   * Plays the round with the sheet shown: a ready sheet passes as it is (`completeSheet`, ADR-0021,
   * item 2), an incomplete one gets the best available ("Completar e jogar"). Untouched, the
   * engine plays its own suggestion and the draft stays absent.
   */
  function play(): void {
    const sent = roundSheet(save.game, save.career.clubId, sheet, untouched, check.ready);
    void service.playRound(sent === undefined ? {} : { sheet: sent });
  }

  // ------------------------------------------------- "Escalação incompleta" (escalacao.md; US-017)

  const CHECK = 'lineup-check';
  let checkOpen = $state(false);
  let closingCheck = false;
  const blocking = $derived(
    lineupIssues(
      save.game,
      save.career.clubId,
      sheet,
      check,
      params.ai.rotationCondition,
      lang,
    ).filter((issue) => BLOCKING_ISSUES.includes(issue.kind)),
  );

  function openCheck(): void {
    checkOpen = true;
    pushSheet(CHECK);
  }

  function closeCheck(): void {
    if (closingCheck) return;
    if (sheetOnTop(CHECK)) {
      closingCheck = true;
      history.back();
    } else checkOpen = false;
  }

  /** "Completar e jogar": fills only what is missing and plays (CEO decision 4). */
  function completeAndPlay(): void {
    if (!checkOpen) return;
    closeCheck();
    checkOpen = false;
    play();
  }

  /** "Ajustar a escalação": closes the sheet and shows the Escalação. */
  function adjust(): void {
    if (!checkOpen) return;
    setView('lineup');
    if (current === 'squad') {
      closeCheck();
      return;
    }
    checkOpen = false;
    // Replaces the sheet's entry, as a pick of the "Mais" menu: back returns to the tab before.
    history.replaceState(null, '', hrefOf('squad'));
    current = 'squad';
  }

  function edit(next: DraftSheet): void {
    void writer.write(next);
  }

  function openSheet(): void {
    sheetOpen = true;
    // The back gesture closes the sheet: it gets its own entry in the history.
    history.pushState({ sheet: true }, '');
  }

  function closeSheet(): void {
    // A double tap on "Fechar": the first back is on its way; a second one would leave the tab.
    if (closingSheet) return;
    if (history.state?.sheet === true) {
      closingSheet = true;
      history.back();
    } else sheetOpen = false;
  }

  function pick(event: MouseEvent, id: DestinationId): void {
    event.preventDefault();
    sheetOpen = false;
    // Replaces the sheet's entry: back from the destination returns to the tab before it.
    history.replaceState(null, '', hrefOf(id));
    current = id;
  }

  /** "Liberar espaço": Carreiras e backup, with its own entry (back returns to the tab). */
  function openSaves(): void {
    if (current === SAVES_DESTINATION) return;
    history.pushState({ saves: true }, '', hrefOf(SAVES_DESTINATION));
    current = SAVES_DESTINATION;
  }

  /** The back of Carreiras e backup: where it came from, or the Clube tab. */
  function back(): void {
    if (history.state?.saves === true) {
      history.back();
      return;
    }
    history.replaceState(null, '', hrefOf(HOME_DESTINATION));
    current = HOME_DESTINATION;
  }

  function onBoundaryError(error: unknown): void {
    void log.record({ kind: 'programming', code: 'unexpected', screen: current, error });
  }

  onMount(() => {
    const onHash = () => (current = destinationOf(location.hash));
    const onPop = () => {
      closingSheet = false;
      closingCheck = false;
      if (sheetOpen && history.state?.sheet !== true) sheetOpen = false;
      if (checkOpen && !sheetOnTop(CHECK)) checkOpen = false;
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onPop);
    };
  });
</script>

{#snippet header()}
  <ScreenHeader
    title={t(labelKeyOf(current), lang)}
    backLabel={t('nav.back', lang)}
    onback={current === SAVES_DESTINATION ? back : undefined}
    moreLabel={t('nav.more', lang)}
    onmore={openSheet}
  />
{/snippet}

{#snippet noticeList()}
  <!-- Always mounted, so a notice that appears later is announced (a live region added together
       with its content often is not). -->
  <div class="band" role="status" bind:this={noticeBand}>
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
{/snippet}

<AppShell
  {tabs}
  sideExtra={extra}
  sideSettings={settings}
  {current}
  {club}
  {playRound}
  navLabel={t('nav.label', lang)}
  skipLabel={t('nav.skip', lang)}
  {header}
  notices={noticeList}
  wide={current === 'squad' && view === 'lineup'}
>
  {#if areaError !== undefined}
    <div bind:this={errorArea}>
      <ErrorState
        layout="area"
        title={boundaryCopy.title}
        message={boundaryCopy.message}
        code={t('error.code', lang, { code: areaError })}
        primary={{
          label: boundaryCopy.retry,
          onclick: areaError === 'unexpected' ? () => service.dismissCrash() : retry,
          icon: 'retry',
        }}
        secondary={[{ label: boundaryCopy.home, onclick: onhome }]}
      />
    </div>
  {:else}
    {#key current}
      <ErrorBoundary
        copy={boundaryCopy}
        code={t('error.code', lang, { code: 'unexpected' })}
        onerror={onBoundaryError}
        {onhome}
      >
        {#if current === SAVES_DESTINATION}
          <Saves {service} {lang} currentId={save.careerId} />
        {:else if current === 'club'}
          <ClubView
            {lang}
            game={save.game}
            clubId={save.career.clubId}
            {more}
            onerror={onBoundaryError}
          />
        {:else if current === 'squad'}
          <SquadTab
            {lang}
            game={save.game}
            clubId={save.career.clubId}
            {view}
            onview={setView}
            {sort}
            onsort={(next) => (squadSort = { careerId: save.careerId, sort: next })}
            {sheet}
            {params}
            onedit={edit}
            onerror={onBoundaryError}
          />
        {:else}
          <Placeholder message={t('screen.soon', lang)} lines={placeholderLines} />
        {/if}
      </ErrorBoundary>
    {/key}
  {/if}
</AppShell>

<BottomSheet
  open={sheetOpen}
  title={t('nav.more', lang)}
  closeLabel={t('nav.close', lang)}
  onclose={closeSheet}
>
  <ul class="more">
    {#each more as entry (entry.id)}
      <li>
        <LinkRow
          label={entry.label}
          icon={entry.icon}
          href={entry.href}
          onclick={(event) => pick(event, entry.id)}
        />
      </li>
    {/each}
  </ul>
</BottomSheet>

{#snippet checkFooter()}
  <div class="check-foot">
    <Button variant="primary" fullWidth icon="play" onclick={completeAndPlay}
      >{t('lineup.check.play', lang)}</Button
    >
    <Button variant="secondary" fullWidth onclick={adjust}>{t('lineup.check.adjust', lang)}</Button>
  </div>
{/snippet}

<BottomSheet
  open={checkOpen}
  title={t('lineup.check.title', lang)}
  closeLabel={t('nav.close', lang)}
  onclose={closeCheck}
  footer={checkFooter}
>
  <div class="check">
    <p class="body">{t('lineup.check.message', lang)}</p>
    <LineupIssues title={t('lineup.issues.title', lang)} items={blocking} hideTitle level={3} />
    <p class="caption hint">{t('lineup.check.hint', lang)}</p>
  </div>
</BottomSheet>

<style>
  .check {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .check p {
    margin: 0;
  }
  .hint {
    color: var(--ink-muted);
  }
  .check-foot {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .band {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .more {
    list-style: none;
    margin: 0;
    padding: 0;
  }
</style>
