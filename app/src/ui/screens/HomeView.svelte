<script lang="ts">
  import { config, type Lang } from '@lib/config';
  import { MAX_CAREERS, type CareerSummary } from '@lib/career';
  import { t } from '@lib/i18n';
  import Banner from '../components/Banner.svelte';
  import Button from '../components/Button.svelte';
  import CareerCard from '../components/CareerCard.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorState from '../components/ErrorState.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import type { NoticeAction } from '../components/actions';
  import { lastPlayedLine, progressLine } from '../career-lines';
  import { noticeActions } from '../notice-actions';
  import { alertKey, hasAlertText } from '../save-alerts';

  /**
   * The home screen as the player sees it (docs/design/telas/inicio.md), for each state: reading,
   * no careers, the list, full (10), opening one, an error opening or listing, and a browser that
   * cannot save. Only texts and callbacks: Home.svelte reads the list and drives the delete.
   */
  interface Props {
    lang: Lang;
    /** "Today" for the date of the last round played. */
    now: Date;
    /** The careers on the device, the most recent first; `undefined` while reading. */
    careers?: readonly CareerSummary[];
    /** The list could not be read: ErrorState `block` in its place. */
    listError?: 'read-failed' | 'app-outdated';
    /** Nothing can be saved in this browser: no "Nova carreira" nor "Continuar". */
    noStorage?: 'unsupported-browser' | 'storage-unavailable';
    /** The career being opened (its button is busy). */
    openingId?: string;
    /** Careers written by a newer build (`save-too-new` when opening). */
    tooNew?: readonly string[];
    /** The career just tapped is no longer on the device (`not-found`). */
    notFound?: boolean;
    /** A bug while opening (`unexpected`): shown with its code. */
    openError?: string;
    /** The text of the last delete, for the polite live region. */
    announcement?: string;
    onopen: (careerId: string) => void;
    onupdate: () => void;
    onnew: () => void;
    onretry: () => void;
    onactions: (career: CareerSummary) => void;
  }
  const {
    lang,
    now,
    careers,
    listError,
    noStorage,
    openingId,
    tooNew = [],
    notFound = false,
    openError,
    announcement,
    onopen,
    onupdate,
    onnew,
    onretry,
    onactions,
  }: Props = $props();

  const titleId = $props.id();
  let root: HTMLElement | undefined = $state();

  const full = $derived(careers !== undefined && careers.length >= MAX_CAREERS);
  const featured = $derived(careers?.[0]);
  const rows = $derived(careers?.slice(1) ?? []);

  /** Texts of a block error: the code's own, or the unexpected error's for a bug. */
  function blockTexts(code: string): { title: string; message: string } {
    if (hasAlertText(code)) {
      return { title: t(alertKey(code, 'title'), lang), message: t(alertKey(code, 'body'), lang) };
    }
    return { title: t('error.unexpected.title', lang), message: t('error.unexpected.body', lang) };
  }

  function listAction(code: 'read-failed' | 'app-outdated'): NoticeAction | undefined {
    return noticeActions(
      [code === 'app-outdated' ? 'reload' : 'retry'],
      { retry: onretry },
      lang,
    )[0];
  }

  /** What a card shows and does, with the problem of a career written by a newer build. */
  function card(career: CareerSummary) {
    const club = career.club.shortName;
    const newer = tooNew.includes(career.id);
    return {
      club: career.club,
      clubName: club,
      progress: progressLine(career, lang),
      lastPlayed: lastPlayedLine(career.updatedAt, now, lang),
      badge: newer ? t('home.badge.tooNew', lang) : undefined,
      badgeTone: newer ? ('warning' as const) : ('neutral' as const),
      notice: newer ? t(alertKey('save-too-new', 'title'), lang) : undefined,
      continueLabel: newer ? t('action.update', lang) : t('home.continue', lang),
      continueA11yLabel: newer
        ? t('action.update', lang)
        : t('home.career.continueA11y', lang, { club }),
      busy: openingId === career.id,
      busyLabel: t('home.career.opening', lang),
      oncontinue: newer ? onupdate : () => onopen(career.id),
      actionsLabel: t('home.career.actions', lang, { club }),
      onactions: () => onactions(career),
    };
  }

  /** The focus after a delete: the list's heading, or the empty state when none is left. */
  export function focusList(): void {
    root?.querySelector<HTMLElement>('[data-focus="list"]')?.focus();
  }

  /** The focus back on a career's "Mais ações" button (a cancelled delete), by its name. */
  export function focusActions(careerId: string): void {
    const career = careers?.find((c) => c.id === careerId);
    if (career === undefined) return;
    const label = t('home.career.actions', lang, { club: career.club.shortName });
    const item = [...(root?.querySelectorAll<HTMLElement>('[data-career]') ?? [])].find(
      (el) => el.dataset.career === careerId,
    );
    [...(item?.querySelectorAll<HTMLElement>('button') ?? [])]
      .find((button) => button.getAttribute('aria-label') === label)
      ?.focus();
  }
</script>

<main class="home" bind:this={root}>
  <header class="brand">
    <div class="name">
      {#if config.logo.hasBrand}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG from config/prancheta.config.ts, never user input -->
        <span class="logo" aria-hidden="true">{@html config.logo.mark}</span>
      {/if}
      <h1 class="titulo">{config.name}</h1>
    </div>
    <p class="body slogan">{config.slogan[lang]}</p>
    <p class="caption fiction">{t('home.fiction', lang)}</p>
  </header>

  {#if notFound}
    <div class="band">
      <Banner
        tone="warning"
        title={t(alertKey('not-found', 'title'), lang)}
        message={t(alertKey('not-found', 'body'), lang)}
      />
    </div>
  {/if}

  <section class="careers" aria-labelledby={careers?.length ? titleId : undefined}>
    {#if noStorage}
      {@const texts = blockTexts(noStorage)}
      <ErrorState
        layout="block"
        title={texts.title}
        message={texts.message}
        code={t('error.code', lang, { code: noStorage })}
        primary={noticeActions(['help'], {}, lang)[0]}
      />
    {:else}
      {#if openError}
        {@const texts = blockTexts(openError)}
        <ErrorState
          layout="block"
          title={texts.title}
          message={texts.message}
          code={t('error.code', lang, { code: openError })}
        />
      {/if}
      {#if listError}
        {@const texts = blockTexts(listError)}
        <ErrorState
          layout="block"
          title={texts.title}
          message={texts.message}
          code={t('error.code', lang, { code: listError })}
          primary={listAction(listError)}
        />
        <Button variant="secondary" fullWidth icon="plus" onclick={onnew}
          >{t('home.new', lang)}</Button
        >
      {:else if careers === undefined}
        <Skeleton label={t('home.loading', lang)} shape="featured" />
        <!-- The first skeleton announces the wait; these two rows only fill the space. -->
        <div aria-hidden="true"><Skeleton label="" count={2} /></div>
      {:else if featured === undefined}
        <div class="empty" tabindex="-1" data-focus="list">
          <EmptyState
            icon="club"
            title={t('home.empty.title', lang)}
            message={t('home.empty.body', lang)}
          >
            <Button variant="primary" fullWidth icon="plus" onclick={onnew}
              >{t('home.new', lang)}</Button
            >
          </EmptyState>
        </div>
      {:else}
        <div class="head">
          <h2 class="subtitulo" id={titleId} tabindex="-1" data-focus="list">
            {t('home.careers.title', lang)}
          </h2>
          <span class="caption count"
            >{t('home.careers.count', lang, { count: careers.length, max: MAX_CAREERS })}</span
          >
        </div>
        <ul class="list">
          <li data-career={featured.id}>
            <CareerCard variant="featured" {...card(featured)} />
          </li>
          {#each rows as career (career.id)}
            <li data-career={career.id}>
              <CareerCard variant="row" {...card(career)} />
            </li>
          {/each}
        </ul>
        {#if full}
          <Banner
            tone="warning"
            title={t(alertKey('career-limit', 'title'), lang)}
            message={t('home.limit.body', lang)}
          />
        {:else}
          <Button variant="secondary" fullWidth icon="plus" onclick={onnew}
            >{t('home.new', lang)}</Button
          >
        {/if}
      {/if}
    {/if}
    <!-- The busy text of a row (the featured card's button has its own). -->
    <p class="sr" aria-live="polite">
      {openingId !== undefined && openingId !== featured?.id
        ? t('home.career.opening', lang)
        : (announcement ?? '')}
    </p>
  </section>

  <footer class="caption foot">
    <a class="link" href={config.paths.site + 'devlog/'}>{t('home.devlog', lang)}</a>
    <span>{t('home.version', lang, { version: config.version })}</span>
  </footer>
</main>

<style>
  .home {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: var(--layout-content-max);
    margin: 0 auto;
    padding: var(--space-8) var(--space-4) var(--space-6);
  }
  .brand {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .name {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .logo {
    display: inline-flex;
    width: var(--space-8);
    height: var(--space-8);
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  h1 {
    text-transform: uppercase;
  }
  .slogan,
  .fiction,
  .count,
  .foot {
    color: var(--ink-muted);
  }
  .careers {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }
  h2:focus,
  .empty:focus {
    outline: none;
  }
  h2:focus-visible,
  .empty:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .count {
    font-variant-numeric: tabular-nums;
    flex: none;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .foot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .link {
    color: var(--info);
    min-height: var(--touch);
    display: inline-flex;
    align-items: center;
  }
</style>
