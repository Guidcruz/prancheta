<script lang="ts">
  import { onMount } from 'svelte';
  import type { OpenError } from '@lib/career';
  import { detectLang, t } from '@lib/i18n';
  import { careers, errors } from './app-context';
  import CareerFrame from './CareerFrame.svelte';
  import ErrorBoundary from './components/ErrorBoundary.svelte';
  import {
    enterNewGame,
    landOnClub,
    leaveNewGame as leaveNewGameEntry,
    screenAfterPop,
    screenOfHash,
  } from './home-routes';
  import { HOME_DESTINATION, hrefOf } from './router';
  import FatalScreen from './screens/FatalScreen.svelte';
  import Home from './screens/Home.svelte';
  import NewGame from './screens/NewGame.svelte';

  /**
   * The game's root: the home screen or the new-game screen (outside a career), the frame of an
   * open career, or a full-screen save error (conflict, app-outdated...). State comes only from
   * the CareerService (lib/career). The new-game screen has its own entry in the history
   * (`#/new`), so the phone's back gesture returns to the home screen.
   */
  type NoStorage = 'unsupported-browser' | 'storage-unavailable';
  const lang = detectLang();
  const career = careers.state;

  let screen: 'home' | 'new' = $state(
    typeof location === 'undefined' ? 'home' : screenOfHash(location.hash),
  );
  /** The last opening failure shown on the home screen (a bug, by its code). */
  let openError: OpenError | 'unexpected' | undefined = $state();
  /** Careers refused when opening as written by a newer build: their cards say so. */
  let tooNew: string[] = $state([]);
  let notFound = $state(false);
  /**
   * The browser could not save (when creating or opening a career). Cleared when a career opens
   * or is created, which proves the storage works again.
   */
  let noStorage: NoStorage | undefined = $state();
  let focusList = $state(false);
  let lastOpened: string | undefined;
  /** Remounts the home screen (and its list) after going back to it. */
  let homeVisit = $state(0);

  const boundaryCopy = {
    title: t('error.unexpected.title', lang),
    message: t('error.unexpected.body', lang),
    retry: t('action.retry', lang),
    home: t('action.home', lang),
  };

  async function open(careerId: string): Promise<void> {
    lastOpened = careerId;
    openError = undefined;
    notFound = false;
    focusList = false;
    // Every career opens on the Clube tab.
    history.replaceState(null, '', hrefOf(HOME_DESTINATION));
    const opened = await careers.open(careerId);
    if (opened.ok) noStorage = undefined;
    if (opened.ok || opened.error === 'busy') return;
    const error = opened.error;
    // On the home screen (inicio.md, "Estados"); the other codes are full screens (status fatal).
    if (error === 'save-too-new') {
      if (!tooNew.includes(careerId)) tooNew = [...tooNew, careerId];
    } else if (error === 'not-found') {
      // The card goes away when the list is read again; the band says why.
      notFound = true;
      homeVisit++;
    } else if (error === 'unsupported-browser' || error === 'storage-unavailable') {
      noStorage = error;
    } else {
      // A bug (`unexpected`); the other codes already took the full screen (status fatal).
      openError = error;
    }
  }

  function goHome(): void {
    careers.close();
    openError = undefined;
    notFound = false;
    focusList = false;
    screen = 'home';
    history.replaceState(null, '', location.pathname + location.search);
    homeVisit++;
  }

  function openNewGame(): void {
    notFound = false;
    openError = undefined;
    focusList = false;
    screen = enterNewGame(history);
  }

  /** Back from the new-game screen: its entry goes away, as with the back gesture. */
  function leaveNewGame(list = false): void {
    focusList = list;
    screen = leaveNewGameEntry(history, location);
    homeVisit++;
  }

  function created(): void {
    noStorage = undefined;
    screen = landOnClub(history);
  }

  function cannotSave(code: NoStorage): void {
    // The store may have ended the career on this tab (status fatal): the home screen says it.
    careers.close();
    noStorage = code;
    leaveNewGame();
  }

  function retryOpen(): void {
    if (lastOpened !== undefined) void open(lastOpened);
  }

  onMount(() => {
    // Errors outside any boundary (event handlers, promises): logged, never sent anywhere.
    const onError = (event: ErrorEvent) =>
      void errors.record({
        kind: 'programming',
        code: 'uncaught',
        screen: 'window',
        error: event.error,
      });
    const onRejection = (event: PromiseRejectionEvent) =>
      void errors.record({
        kind: 'programming',
        code: 'unhandled-rejection',
        screen: 'window',
        error: event.reason,
      });
    // Back and forward between the home screen and the new-game screen.
    const onPop = () => {
      const next = screenAfterPop(screen, location.hash, $career.status);
      if (next === undefined) return;
      if (next === 'home') homeVisit++;
      screen = next;
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('popstate', onPop);
    };
  });
</script>

{#if $career.status === 'fatal' && $career.fatal}
  <FatalScreen
    code={$career.fatal.code}
    unsaved={$career.fatal.unsaved}
    {lang}
    onretry={retryOpen}
    onhome={goHome}
  />
{:else if $career.status === 'open' && $career.save}
  <CareerFrame career={$career} service={careers} log={errors} {lang} onhome={goHome} />
{:else if screen === 'new'}
  <ErrorBoundary
    layout="screen"
    copy={boundaryCopy}
    code={t('error.code', lang, { code: 'unexpected' })}
    onerror={(error) =>
      void errors.record({ kind: 'programming', code: 'unexpected', screen: 'new-game', error })}
    onhome={goHome}
  >
    <NewGame
      service={careers}
      {lang}
      onback={() => leaveNewGame()}
      oncreated={created}
      onnostorage={cannotSave}
      onlist={() => leaveNewGame(true)}
    />
  </ErrorBoundary>
{:else}
  {#key homeVisit}
    <ErrorBoundary
      layout="screen"
      copy={boundaryCopy}
      code={t('error.code', lang, { code: 'unexpected' })}
      onerror={(error) =>
        void errors.record({ kind: 'programming', code: 'unexpected', screen: 'home', error })}
      onhome={goHome}
    >
      <Home
        service={careers}
        {lang}
        {tooNew}
        {notFound}
        {openError}
        {noStorage}
        {focusList}
        onopen={(id) => void open(id)}
        onnew={openNewGame}
      />
    </ErrorBoundary>
  {/key}
{/if}
