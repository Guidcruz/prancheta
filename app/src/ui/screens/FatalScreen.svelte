<script lang="ts">
  import type { Lang } from '@lib/config';
  import type { FatalCode } from '@lib/career';
  import { t } from '@lib/i18n';
  import ErrorState from '../components/ErrorState.svelte';
  import { alertKey, fatalActions } from '../save-alerts';
  import { noticeActions } from '../notice-actions';

  /**
   * A save error after which this tab cannot go on (erros-e-avisos.md: `conflict`,
   * `app-outdated`, `save-too-new`, `all-corrupt`, ...): ErrorState `screen`, no tabs, with the
   * code for support (CEO decision 2) and, after a write, the line that the round was not saved.
   */
  interface Props {
    code: FatalCode;
    unsaved: boolean;
    lang: Lang;
    onretry: () => void;
    onhome: () => void;
  }
  const { code, unsaved, lang, onretry, onhome }: Props = $props();
  const actions = $derived(
    noticeActions(fatalActions(code), { retry: onretry, home: onhome }, lang),
  );
  // Only `app-outdated` has its own line; the other texts already say the round was not saved.
  const extra = $derived(
    unsaved && code === 'app-outdated' ? t(alertKey(code, 'bodyUnsaved'), lang) : undefined,
  );
</script>

<main>
  <ErrorState
    layout="screen"
    title={t(alertKey(code, 'title'), lang)}
    message={t(alertKey(code, 'body'), lang)}
    {extra}
    code={t('error.code', lang, { code })}
    primary={actions[0]}
    secondary={actions.slice(1)}
  />
</main>
