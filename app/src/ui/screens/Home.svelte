<script lang="ts">
  import { onMount } from 'svelte';
  import { config, type Lang } from '@lib/config';
  import type { CareerService, CareerSummary, CreateError, OpenError } from '@lib/career';
  import { t } from '@lib/i18n';
  import { shieldSpecFor, shieldSvg } from '@lib/generators/shield';
  import Banner from '../components/Banner.svelte';
  import Button from '../components/Button.svelte';
  import ErrorState from '../components/ErrorState.svelte';
  import LinkRow from '../components/LinkRow.svelte';
  import { noticeActions } from '../notice-actions';
  import { alertKey, hasAlertText } from '../save-alerts';

  /**
   * Provisional home screen, only so the career frame can be reached (T-023): the careers on the
   * device ("Continuar") and a new career with the default options. The real Início and Novo jogo
   * (club, nickname, realism, match mode, last setup, delete with double confirmation) are T-025.
   */
  interface Props {
    service: CareerService;
    lang: Lang;
    /** An opening error to show in place of the list (not-found, save-too-new...). */
    openError?: OpenError | 'unexpected';
    onopen: (careerId: string) => void;
  }
  const { service, lang, openError, onopen }: Props = $props();

  let careers: CareerSummary[] | undefined = $state();
  let listError: string | undefined = $state();
  let createError: CreateError | undefined = $state();
  let creating = $state(false);

  // The app's own crest (not a club): fixed crest data, brand colours from the config.
  const shield = shieldSvg(
    shieldSpecFor({
      id: 'prancheta',
      colors: [config.colors.primary, config.colors.accent],
      size: 'big',
      titles: { league: 0 },
      crestShape: 'french',
      crestPattern: 'chevron',
      crestBase: 0,
      crestSymbol: 'sol',
    }),
    96,
  );

  // Without storage nothing can be saved: no "Novo jogo" nor "Continuar" (erros-e-avisos.md).
  const noStorage = $derived(
    listError === 'storage-unavailable' ||
      listError === 'unsupported-browser' ||
      createError === 'unsupported-browser' ||
      createError === 'storage-unavailable',
  );
  const blockCode = $derived(
    openError ??
      listError ??
      (createError !== undefined &&
      createError !== 'career-limit' &&
      !createError.startsWith('coach-name')
        ? createError
        : undefined),
  );

  async function load(): Promise<void> {
    const listed = await service.list();
    if (listed.ok) {
      careers = listed.value;
      listError = undefined;
    } else {
      listError = listed.error;
    }
  }

  async function create(): Promise<void> {
    const first = service.clubs()[0];
    if (first === undefined || creating) return;
    creating = true;
    createError = undefined;
    try {
      const created = await service.create({
        coachName: t('career.coachDefault', lang),
        clubId: first.id,
        realism: 'full',
        matchMode: 'result',
      });
      if (!created.ok) createError = created.error;
    } catch {
      // The service never throws; if it ever does, the button must not stay busy.
      createError = 'unexpected';
    } finally {
      creating = false;
    }
  }

  /** Texts of a block error: the code's own, or the unexpected error's for a bug. */
  function blockTexts(code: string): { title: string; message: string } {
    if (hasAlertText(code)) {
      return { title: t(alertKey(code, 'title'), lang), message: t(alertKey(code, 'body'), lang) };
    }
    return { title: t('error.unexpected.title', lang), message: t('error.unexpected.body', lang) };
  }

  onMount(() => {
    void load();
  });
</script>

<main class="home">
  <header>
    {#if config.logo.hasBrand}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG from config/prancheta.config.ts, never user input -->
      <div class="logo">{@html config.logo.mark}</div>
    {/if}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG from our own generator with constant inputs, never user input -->
    <div class="shield">{@html shield}</div>
    <h1 class="titulo">{config.name}</h1>
    <p class="body subtitle">{t('home.subtitle', lang)}</p>
  </header>

  <section class="careers">
    {#if blockCode !== undefined}
      {@const texts = blockTexts(blockCode)}
      <ErrorState
        layout="block"
        title={texts.title}
        message={texts.message}
        code={t('error.code', lang, { code: blockCode })}
        primary={noStorage ? noticeActions(['help'], {}, lang)[0] : undefined}
      />
    {/if}
    {#if createError === 'career-limit'}
      <Banner
        tone="warning"
        title={t(alertKey('career-limit', 'title'), lang)}
        message={t(alertKey('career-limit', 'body'), lang)}
      />
    {/if}
    {#if !noStorage}
      {#if careers === undefined && listError === undefined}
        <p class="body muted">{t('home.loading', lang)}</p>
      {:else if careers !== undefined && careers.length > 0}
        <h2 class="subtitulo">{t('home.careers', lang)}</h2>
        <ul>
          {#each careers as career (career.id)}
            <li>
              <LinkRow
                label={t('home.careerLine', lang, {
                  club: career.club.name,
                  season: career.season,
                  round: career.round,
                })}
                value={t('home.continue', lang)}
                onclick={() => onopen(career.id)}
              />
            </li>
          {/each}
        </ul>
      {/if}
      <div class="new">
        <Button variant="primary" fullWidth busy={creating} onclick={create}
          >{t('home.new', lang)}</Button
        >
      </div>
    {/if}
  </section>

  <footer class="caption">
    <a class="link" href={config.paths.site + 'devlog/'}>{t('home.devlog', lang)}</a>
    <span>{t('home.version', lang, { version: config.version })}</span>
  </footer>
</main>

<style>
  .home {
    min-height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: var(--space-6);
    padding: var(--space-8) var(--space-4) var(--space-6);
    max-width: 480px;
    margin: 0 auto;
  }
  header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-3);
  }
  .logo {
    width: 64px;
    height: 64px;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  .subtitle,
  .muted {
    color: var(--ink-muted);
  }
  .subtitle {
    max-width: 32ch;
  }
  .careers {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .new {
    margin-top: var(--space-3);
  }
  footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    color: var(--ink-muted);
  }
  .link {
    color: var(--info);
    min-height: var(--touch);
    display: inline-flex;
    align-items: center;
  }
</style>
