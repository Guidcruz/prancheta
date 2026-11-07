<script lang="ts">
  import type { Lang } from '@lib/config';
  import type { CareerSummary } from '@lib/career';
  import { t } from '@lib/i18n';
  import CareerCard from '../components/CareerCard.svelte';
  import ErrorState from '../components/ErrorState.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { lastPlayedLine, progressLine } from '../career-lines';
  import { noticeActions } from '../notice-actions';
  import { alertKey, hasAlertText } from '../save-alerts';

  /**
   * Carreiras e backup inside the career frame (docs/design/telas/saves.md; T-025 part): the
   * careers on the device with the open one first and marked "Atual", and their "Mais ações".
   * A row does not open its career from here (that would close the current one): only the
   * actions. Export, import and the persistence banner come with T-020.
   */
  interface Props {
    lang: Lang;
    now: Date;
    /** The careers on the device, the open one first; `undefined` while reading. */
    careers?: readonly CareerSummary[];
    currentId: string;
    listError?: string;
    announcement?: string;
    onretry: () => void;
    onactions: (career: CareerSummary) => void;
  }
  const { lang, now, careers, currentId, listError, announcement, onretry, onactions }: Props =
    $props();

  const titleId = $props.id();
  let root: HTMLElement | undefined = $state();

  function errorTexts(code: string): { title: string; message: string } {
    if (hasAlertText(code)) {
      return { title: t(alertKey(code, 'title'), lang), message: t(alertKey(code, 'body'), lang) };
    }
    return { title: t('error.unexpected.title', lang), message: t('error.unexpected.body', lang) };
  }

  /** The focus after a delete: the list. */
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

<section class="saves" bind:this={root}>
  {#if listError}
    {@const texts = errorTexts(listError)}
    <ErrorState
      layout="block"
      title={texts.title}
      message={texts.message}
      code={t('error.code', lang, { code: listError })}
      primary={noticeActions(['retry'], { retry: onretry }, lang)[0]}
    />
  {:else if careers === undefined}
    <Skeleton label={t('home.loading', lang)} count={2} />
  {:else}
    <ul
      class="list"
      id={titleId}
      tabindex="-1"
      data-focus="list"
      aria-label={t('saves.title', lang)}
    >
      {#each careers as career (career.id)}
        {@const club = career.club.shortName}
        {@const current = career.id === currentId}
        <li data-career={career.id}>
          <CareerCard
            variant="row"
            club={career.club}
            clubName={club}
            progress={progressLine(career, lang)}
            lastPlayed={lastPlayedLine(career.updatedAt, now, lang)}
            badge={current ? t('saves.current', lang) : undefined}
            continueLabel={t('home.continue', lang)}
            disabled
            actionsLabel={t('home.career.actions', lang, { club })}
            onactions={() => onactions(career)}
          />
        </li>
      {/each}
    </ul>
    {#if careers.length === 1}
      <p class="body muted">{t('saves.onlyCurrent', lang)}</p>
    {/if}
  {/if}
  <p class="sr" aria-live="polite">{announcement ?? ''}</p>
</section>

<style>
  .saves {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .list:focus {
    outline: none;
  }
  .list:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  p {
    margin: 0;
  }
  .muted {
    color: var(--ink-muted);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
