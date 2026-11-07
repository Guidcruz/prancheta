<script lang="ts">
  import { onMount } from 'svelte';
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
  import ErrorBoundary from './components/ErrorBoundary.svelte';
  import ErrorState from './components/ErrorState.svelte';
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
  import { noticeActions } from './notice-actions';
  import { destinationOf, hrefOf, labelKeyOf, type DestinationId } from './router';
  import { alertKey, unsavedActions } from './save-alerts';
  import Placeholder from './screens/Placeholder.svelte';

  /**
   * The frame of an open career (docs/design/telas/navegacao.md): tabs at the bottom on the
   * phone, sidebar from 900px, the "Mais" menu, the notice band, "Jogar rodada" and the error
   * boundary around the screen of each destination. The screens themselves are placeholders
   * until their tasks (T-028, T-031, T-034...).
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
  const playRound = $derived({
    state: career.busy ? ('busy' as const) : block ? ('blocked' as const) : ('ready' as const),
    label: t('play.label', lang),
    hint: block === undefined ? undefined : t(BLOCK_KEYS[block], lang),
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
        actions: noticeActions(unsavedActions(unsaved), { retry, home: onhome }, lang),
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
    void service.playRound();
  }

  function openSheet(): void {
    sheetOpen = true;
    // The back gesture closes the sheet: it gets its own entry in the history.
    history.pushState({ sheet: true }, '');
  }

  function closeSheet(): void {
    if (history.state?.sheet === true) history.back();
    else sheetOpen = false;
  }

  function pick(event: MouseEvent, id: DestinationId): void {
    event.preventDefault();
    sheetOpen = false;
    // Replaces the sheet's entry: back from the destination returns to the tab before it.
    history.replaceState(null, '', hrefOf(id));
    current = id;
  }

  function onBoundaryError(error: unknown): void {
    void log.record({ kind: 'programming', code: 'unexpected', screen: current, error });
  }

  onMount(() => {
    const onHash = () => (current = destinationOf(location.hash));
    const onPop = () => {
      if (sheetOpen && history.state?.sheet !== true) sheetOpen = false;
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
        <Placeholder message={t('screen.soon', lang)} lines={placeholderLines} />
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

<style>
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
