<script lang="ts">
  import { onMount } from 'svelte';
  import type { Lang } from '@lib/config';
  import type { CareerService, LastSetup } from '@lib/career';
  import { t } from '@lib/i18n';
  import {
    DEFAULT_SETUP,
    OFFERED_MATCH_MODES,
    REALISMS,
    bandLabel,
    clubGroups,
    coachNameView,
    initialSetup,
    rankClubs,
    type StartProblem,
  } from '../new-game';
  import { popSheet, pushSheet, sheetOnTop } from '../sheet-history';
  import NewGameView from './NewGameView.svelte';

  /**
   * The new-game screen (docs/design/telas/novo-jogo.md, US-014): keeps the choices, reads and
   * writes the last setup through the CareerService and creates the career. What it shows for
   * each state is NewGameView.svelte.
   */
  type NoStorage = 'unsupported-browser' | 'storage-unavailable';
  interface Props {
    service: CareerService;
    lang: Lang;
    onback: () => void;
    /** The career is created and open (the frame takes over). */
    oncreated: () => void;
    /** The browser cannot save: back to the home screen, which says so. */
    onnostorage: (code: NoStorage) => void;
    /** "Ir para as carreiras" and "Liberar espaço": back to the list of the home screen. */
    onlist: () => void;
  }
  const { service, lang, onback, oncreated, onnostorage, onlist }: Props = $props();

  const SHEET = 'new-game-options';
  /** After this long, creating shows the full loading screen. */
  const SLOW_MS = 1000;

  // One service for the whole app, and a fixed list of clubs.
  // svelte-ignore state_referenced_locally
  const clubs = service.newGameClubs();
  const ranked = rankClubs(clubs);
  const groups = $derived(clubGroups(clubs, lang));

  let selected: string | undefined = $state();
  // The default nickname of the language at start.
  // svelte-ignore state_referenced_locally
  let coachName = $state(t('career.coachDefault', lang));
  let nameShown = $state(false);
  let setup: LastSetup = $state(DEFAULT_SETUP);
  /** The player changed an option before the last setup was read: it is not overwritten. */
  let changed = false;
  let optionsOpen = $state(false);
  let creating = $state(false);
  let slow = $state(false);
  let problem: StartProblem | undefined = $state();

  const coach = $derived(coachNameView(coachName, nameShown, lang));
  const chosen = $derived.by(() => {
    const entry = ranked.find((r) => r.club.id === selected);
    return entry === undefined
      ? undefined
      : { club: entry.club, strength: entry.strength, band: bandLabel(entry.band, lang) };
  });

  function select(clubId: string): void {
    if (!creating) selected = clubId;
  }

  function openOptions(): void {
    if (creating || optionsOpen) return;
    optionsOpen = true;
    pushSheet(SHEET);
  }

  /** "Pronto", the close button, Esc, a tap outside or back: the changes already apply. */
  function closeOptions(): void {
    if (!optionsOpen) return;
    nameShown = true;
    optionsOpen = false;
    popSheet(SHEET);
  }

  function setRealism(value: string): void {
    const realism = REALISMS.find((r) => r === value);
    if (realism === undefined) return;
    changed = true;
    setup = { ...setup, realism };
  }

  function setMatch(value: string): void {
    const matchMode = OFFERED_MATCH_MODES.find((m) => m === value);
    if (matchMode === undefined) return;
    changed = true;
    setup = { ...setup, matchMode };
  }

  async function start(): Promise<void> {
    if (creating || selected === undefined) return;
    if (coach.problem !== undefined) {
      nameShown = true;
      return;
    }
    creating = true;
    problem = undefined;
    const timer = setTimeout(() => (slow = true), SLOW_MS);
    const chosenSetup = setup;
    let result: Awaited<ReturnType<CareerService['create']>>;
    try {
      result = await service.create({
        coachName,
        clubId: selected,
        realism: chosenSetup.realism,
        matchMode: chosenSetup.matchMode,
      });
    } catch {
      // The service never throws; if it ever does, the button must not stay busy.
      result = { ok: false, error: 'unexpected' };
    } finally {
      clearTimeout(timer);
      creating = false;
      slow = false;
    }
    if (result.ok) {
      // Only the realism and the match mode: never the club nor the nickname (CEO decision 2).
      void service.rememberSetup(chosenSetup);
      oncreated();
      return;
    }
    const error = result.error;
    if (error === 'busy') return;
    if (error.startsWith('coach-name-')) nameShown = true;
    else if (error === 'unsupported-browser' || error === 'storage-unavailable') {
      onnostorage(error);
    } else if (error === 'career-limit') problem = { kind: 'career-limit' };
    else if (error === 'quota-exceeded') problem = { kind: 'quota-exceeded' };
    // conflict, app-outdated and save-too-new end the career on this tab: the full screen.
    else if (error !== 'conflict' && error !== 'app-outdated' && error !== 'save-too-new') {
      problem = { kind: 'error', code: error };
    }
  }

  onMount(() => {
    void service.lastSetup().then((last) => {
      if (!changed) setup = initialSetup(last);
    });
    const onPop = () => {
      if (optionsOpen && !sheetOnTop(SHEET)) closeOptions();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
</script>

<NewGameView
  {lang}
  {groups}
  {selected}
  {chosen}
  {coachName}
  {coach}
  {setup}
  {optionsOpen}
  {creating}
  {slow}
  {problem}
  onback={() => {
    if (!creating) onback();
  }}
  onselect={select}
  onoptions={openOptions}
  onclose={closeOptions}
  onname={(value) => (coachName = value)}
  onnameleave={() => (nameShown = true)}
  onrealism={setRealism}
  onmatch={setMatch}
  onstart={() => void start()}
  {onlist}
/>
