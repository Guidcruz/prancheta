<script lang="ts">
  import { onMount } from 'svelte';
  import type { OpenError } from '@lib/career';
  import { detectLang, t } from '@lib/i18n';
  import { careers, errors } from './app-context';
  import CareerFrame from './CareerFrame.svelte';
  import ErrorBoundary from './components/ErrorBoundary.svelte';
  import { HOME_DESTINATION, hrefOf } from './router';
  import FatalScreen from './screens/FatalScreen.svelte';
  import Home from './screens/Home.svelte';

  /**
   * The game's root: the home screen, the frame of an open career, or a full-screen save error
   * (conflict, app-outdated...). State comes only from the CareerService (lib/career).
   */
  const lang = detectLang();
  const career = careers.state;

  let openError: OpenError | undefined = $state();
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
    // Every career opens on the Clube tab.
    history.replaceState(null, '', hrefOf(HOME_DESTINATION));
    const opened = await careers.open(careerId);
    if (!opened.ok && opened.error !== 'busy') openError = opened.error;
  }

  function goHome(): void {
    careers.close();
    openError = undefined;
    history.replaceState(null, '', location.pathname + location.search);
    homeVisit++;
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
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
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
      <Home service={careers} {lang} {openError} onopen={(id) => void open(id)} />
    </ErrorBoundary>
  {/key}
{/if}
