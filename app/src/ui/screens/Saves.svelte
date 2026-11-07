<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Lang } from '@lib/config';
  import type { CareerService, CareerSummary } from '@lib/career';
  import { t } from '@lib/i18n';
  import { DeleteFlow, type FocusTarget } from '../delete-flow';
  import { popSheet, pushSheet, sheetOnTop } from '../sheet-history';
  import CareerSheets from './CareerSheets.svelte';
  import SavesView from './SavesView.svelte';

  /**
   * Carreiras e backup inside the frame (docs/design/telas/saves.md): reads the careers, puts the
   * open one first and deletes the others with the double confirmation of the home screen. It is
   * where "Liberar espaço" leads when a round could not be saved (`quota-exceeded`); after a
   * delete the banner with "Tentar de novo" stays in the band of the frame.
   */
  interface Props {
    service: CareerService;
    lang: Lang;
    /** The career open in the frame: listed first, never deleted from here. */
    currentId: string;
  }
  const { service, lang, currentId }: Props = $props();

  const SHEET = 'saves-actions';
  const flow = new DeleteFlow((id) => service.remove(id), { protectedId: () => currentId });
  const flowState = flow.state;

  let careers: CareerSummary[] | undefined = $state();
  let listError: string | undefined = $state();
  let announcement: string | undefined = $state();
  let now = $state(new Date());
  let view: ReturnType<typeof SavesView> | undefined = $state();

  async function load(): Promise<void> {
    listError = undefined;
    const listed = await service.list();
    now = new Date();
    if (!listed.ok) {
      careers = undefined;
      listError = listed.error;
      return;
    }
    // The open career first, then the others from the most recent (the store's order).
    careers = [
      ...listed.value.filter((c) => c.id === currentId),
      ...listed.value.filter((c) => c.id !== currentId),
    ];
  }

  async function focus(target: FocusTarget | undefined): Promise<void> {
    if (target === undefined) return;
    await tick();
    if (target.kind === 'actions') view?.focusActions(target.careerId);
    else view?.focusList();
  }

  function actions(summary: CareerSummary): void {
    if (flow.openActions(summary)) pushSheet(SHEET);
  }

  function cancel(): void {
    const target = flow.cancel();
    if (target === undefined) return;
    popSheet(SHEET);
    void focus(target);
  }

  async function confirm(): Promise<void> {
    const outcome = await flow.confirm();
    if (outcome.kind !== 'deleted') return;
    popSheet(SHEET);
    announcement = t('home.deleted', lang, { club: outcome.career.club.shortName });
    await load();
    void focus({ kind: 'list' });
  }

  onMount(() => {
    void load();
    const onPop = () => {
      if (flow.open && !sheetOnTop(SHEET)) cancel();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
</script>

<SavesView
  bind:this={view}
  {lang}
  {now}
  {careers}
  {currentId}
  {listError}
  {announcement}
  onretry={() => void load()}
  onactions={actions}
/>

<CareerSheets
  {lang}
  flow={$flowState}
  {currentId}
  onchoose={() => flow.chooseDelete()}
  onproceed={() => flow.proceed()}
  onconfirm={() => void confirm()}
  oncancel={cancel}
/>
