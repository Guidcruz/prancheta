<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Lang } from '@lib/config';
  import type { CareerService, CareerSummary } from '@lib/career';
  import { t } from '@lib/i18n';
  import { DeleteFlow, type FocusTarget } from '../delete-flow';
  import { popSheet, pushSheet, sheetOnTop } from '../sheet-history';
  import CareerSheets from './CareerSheets.svelte';
  import HomeView from './HomeView.svelte';

  /**
   * The home screen (docs/design/telas/inicio.md, US-034): reads the careers on the device, opens
   * one (App.svelte does the opening), starts a new one and deletes one with the double
   * confirmation. What it shows for each state is HomeView.svelte.
   */
  type NoStorage = 'unsupported-browser' | 'storage-unavailable';
  interface Props {
    service: CareerService;
    lang: Lang;
    /** Careers refused when opening as written by a newer build. */
    tooNew?: readonly string[];
    /** The career just tapped is no longer on the device. */
    notFound?: boolean;
    /** A bug while opening, by its code. */
    openError?: string;
    /** The browser could not save when creating a career (the new-game screen came back). */
    noStorage?: NoStorage;
    /** Focus the list once read ("Liberar espaço" of the new-game screen). */
    focusList?: boolean;
    onopen: (careerId: string) => void;
    onnew: () => void;
  }
  const {
    service,
    lang,
    tooNew = [],
    notFound = false,
    openError,
    noStorage,
    focusList = false,
    onopen,
    onnew,
  }: Props = $props();

  const SHEET = 'career-actions';
  // One service for the whole app: it never changes.
  // svelte-ignore state_referenced_locally
  const career = service.state;
  const flow = new DeleteFlow((id) => service.remove(id));
  const flowState = flow.state;

  let careers: CareerSummary[] | undefined = $state();
  let listError: 'read-failed' | 'app-outdated' | undefined = $state();
  let listNoStorage: NoStorage | undefined = $state();
  let requested: string | undefined = $state();
  let announcement: string | undefined = $state();
  let now = $state(new Date());
  let view: ReturnType<typeof HomeView> | undefined = $state();

  const opening = $derived($career.status === 'opening' ? requested : undefined);
  const blocked = $derived($career.busy || $flowState.stage !== 'idle');

  async function load(): Promise<void> {
    listError = undefined;
    const listed = await service.list();
    now = new Date();
    if (listed.ok) {
      careers = listed.value;
      return;
    }
    careers = undefined;
    if (listed.error === 'storage-unavailable') listNoStorage = listed.error;
    else listError = listed.error;
  }

  function open(careerId: string): void {
    // One opening at a time: the other cards and "Nova carreira" do nothing until it ends.
    if (blocked) return;
    requested = careerId;
    onopen(careerId);
  }

  function startNew(): void {
    if (blocked) return;
    onnew();
  }

  async function focus(target: FocusTarget | undefined): Promise<void> {
    if (target === undefined) return;
    await tick();
    if (target.kind === 'actions') view?.focusActions(target.careerId);
    else view?.focusList();
  }

  function actions(summary: CareerSummary): void {
    if ($career.busy) return;
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

  function reload(): void {
    location.reload();
  }

  onMount(() => {
    void load().then(() => {
      if (focusList) void focus({ kind: 'list' });
    });
    // The back gesture over a sheet ends the flow without deleting.
    const onPop = () => {
      if (flow.open && !sheetOnTop(SHEET)) cancel();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
</script>

<HomeView
  bind:this={view}
  {lang}
  {now}
  {careers}
  {listError}
  noStorage={noStorage ?? listNoStorage}
  openingId={opening}
  {tooNew}
  {notFound}
  {openError}
  {announcement}
  onopen={open}
  onupdate={reload}
  onnew={startNew}
  onretry={() => void load()}
  onactions={actions}
/>

<CareerSheets
  {lang}
  flow={$flowState}
  onchoose={() => flow.chooseDelete()}
  onproceed={() => flow.proceed()}
  onconfirm={() => void confirm()}
  oncancel={cancel}
/>
