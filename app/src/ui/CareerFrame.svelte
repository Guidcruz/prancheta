<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { sheetProblems, type DraftSheet, type GameState, type MatchMode } from '@engine';
  import type { Lang } from '@lib/config';
  import {
    roundBlock,
    seasonOver,
    type CareerService,
    type CareerState,
    type LiveMatch,
    type MatchSpeed,
    type PlayError,
    type PlayInput,
    type RoundBlock,
  } from '@lib/career';
  import type { ErrorLog } from '@lib/errors';
  import { shieldSpecFor, shieldSvg } from '@lib/generators/shield';
  import { t, tPlural } from '@lib/i18n';
  import AppShell from './components/AppShell.svelte';
  import Banner from './components/Banner.svelte';
  import BottomSheet from './components/BottomSheet.svelte';
  import Button from './components/Button.svelte';
  import ErrorBoundary from './components/ErrorBoundary.svelte';
  import ErrorState from './components/ErrorState.svelte';
  import LineupIssues, { BLOCKING_ISSUES } from './components/LineupIssues.svelte';
  import LinkRow from './components/LinkRow.svelte';
  import OptionGroup from './components/OptionGroup.svelte';
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
  import { createDraftWriter } from './draft-writer';
  import { coachSheet, lineupIssues } from './lineup';
  import { roundSheet } from './tactic';
  import { noticeActions } from './notice-actions';
  import {
    CALENDAR_DESTINATION,
    HOME_DESTINATION,
    SAVES_DESTINATION,
    calendarRoundHref,
    calendarRoundOf,
    destinationOf,
    hrefOf,
    labelKeyOf,
    type DestinationId,
  } from './router';
  import { cameFromList, originOf, roundFromAddress, withoutOrigin } from './calendar';
  import { alertKey, draftActions, hasAlertText, unsavedActions } from './save-alerts';
  import { pushSheet, sheetOnTop } from './sheet-history';
  import { summaryRound } from './round';
  import { RoundFlow, areaErrorOf, isRoundHash, playOutcome } from './round-flow';
  import { MATCH_ENTRY, MATCH_HASH, isMatchHash, playModeOptions, watchModeOf } from './match-flow';
  import type { WatchMode } from './match/steps';
  import MatchScreen, { type FinishOutcome } from './screens/MatchScreen.svelte';
  import RoundSummary, { type RoundSaveState } from './screens/RoundSummary.svelte';
  import CalendarRound from './screens/CalendarRound.svelte';
  import CalendarView from './screens/CalendarView.svelte';
  import ClubView from './screens/ClubView.svelte';
  import Placeholder from './screens/Placeholder.svelte';
  import Saves from './screens/Saves.svelte';
  import SquadTab, { type SquadViewId } from './screens/SquadTab.svelte';
  import TableView from './screens/TableView.svelte';
  import type { SquadSort } from './squad';

  /**
   * The frame of an open career (docs/design/telas/navegacao.md): tabs at the bottom on the
   * phone, sidebar from 900px, the "Mais" menu, the notice band, "Jogar rodada" and the error
   * boundary around the screen of each destination. Clube and Elenco are the T-028 screens (the
   * Elenco tab with the Escalação of T-029), Tabela the T-031 one, Calendário the T-084 one (with
   * its Rodada subscreen, `#/calendar/round/N`) and Carreiras e backup the T-025 one; the others
   * are placeholders until their tasks (T-034...).
   *
   * The coach's sheet (ADR-0021; T-029) is read here, because "Jogar rodada" needs it on every
   * tab: the draft of the save (or the edit held while a round is played, `draft-writer.ts`), or
   * the engine's suggestion while the coach never touched it. A sheet that cannot go to the round
   * keeps the button tappable with its reason, and the tap opens "Escalação incompleta".
   *
   * "Jogar rodada" plays and stores the round, and only then the round summary (T-030;
   * resumo-rodada.md) takes the whole screen, with its own address (`#/round`, `round-flow.ts`);
   * "Continuar" or the back gesture returns to the tab, with the focus on "Jogar rodada", which
   * ignores taps for about 500 ms.
   *
   * In the assisted modes (T-032; partida.md, "Fluxo da rodada nos modos assistidos") the coach's
   * match comes whole from `CareerService.liveMatch` and the narrated match takes the screen
   * (`#/match`, pushed); at the final whistle (or Pular) the round is played and stored with the
   * very same input, and the summary replaces the match (`#/round`, `replaceState`). The phone's
   * back during the match puts `#/match` back and asks "Sair da partida?". "Jogar rodada" has the
   * selector of the match mode beside it, whose choice holds only when the round is played.
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
  /** The round summary takes the screen (`#/round`); `current` stays the tab under it. */
  let summaryShown = $state(false);

  /** The narrated match of the round being played (T-032), over the tab (`#/match`). */
  interface MatchSession {
    readonly careerId: string;
    /** The very input `playRound` gets at the end. */
    readonly input: PlayInput;
    readonly live: LiveMatch;
    readonly mode: WatchMode;
    readonly speed: MatchSpeed;
    /** The career before the round: the names and clubs the match shows. */
    readonly game: GameState;
  }
  let match: MatchSession | undefined = $state.raw();
  /** The round of the match, once asked: a second ask gets the same answer (no second round). */
  let finished: Promise<FinishOutcome> | undefined;
  let matchScreen: { backAnswer: () => string; openLeave: () => void } | undefined = $state();
  /** The live match is being computed: "Jogar rodada" is busy ("Calculando a rodada..."). */
  let computing = $state(false);
  /**
   * The Rodada subscreen of the Calendário (`#/calendar/round/N`, calendario.md): the round shown,
   * or `undefined` for the list. Always a round already played (`roundFromAddress`).
   */
  let calendarRound: number | undefined = $state();
  /** The list was reached back from a Rodada: it shows that round's card instead of the next. */
  let calendarOrigin: number | undefined = $state();
  /** The back of the Rodada asked `history.back()` and its popstate has not come yet. */
  let leavingRound = false;
  /** The frame's title: the Rodada focuses it and names its list with it. */
  const TITLE_ID = 'frame-title';
  /** The Rodada shown, only on the Calendário. */
  const roundShown = $derived(current === CALENDAR_DESTINATION ? calendarRound : undefined);
  /** Each screen of the content area under its own boundary, the list and each Rodada too. */
  const screenKey = $derived(roundShown === undefined ? current : `${current}/${roundShown}`);
  /** A refusal of `playRound` other than busy (never silent): the content area shows its code. */
  let playError: PlayError | undefined = $state();
  const flow = new RoundFlow(() => history);
  let sheetOpen = $state(false);
  /** The "Mais" sheet asked `history.back()` and its popstate has not come yet. */
  let closingSheet = false;
  let noticeBand: HTMLElement | undefined = $state();
  let errorArea: HTMLElement | undefined = $state();
  /**
   * The content area shows the unexpected error: a bug while playing (`crash`), or a save the
   * store refused as not of the format (`invalid-save`), with its code.
   */
  const areaError = $derived(areaErrorOf(career, playError));

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
  /** The parameters the rounds are played with: the suggestion shown is the one played. */
  const params = $derived(service.params);
  const writer = createDraftWriter({
    get state() {
      return service.state;
    },
    setDraft: (next) => service.setDraft(next),
  });
  const held = writer.held;
  /** The sheet shown and played: the edit held, the coach's draft or the engine's suggestion. */
  const sheet = $derived(
    coachSheet(
      save.game,
      save.career.clubId,
      ($held?.careerId === save.careerId ? $held.sheet : undefined) ?? save.career.draft,
      params,
    ),
  );
  /** The coach never touched the sheet: the round plays the engine's suggestion, as shown. */
  const untouched = $derived(save.career.draft === undefined && $held === undefined);
  const check = $derived(sheetProblems(save.game, save.career.clubId, sheet));
  /**
   * The view of the Elenco tab while this career is open (escalacao.md, "Navegação"): the
   * frame's state, never the save's, and no entry in the history.
   */
  let squadView: { careerId: string; view: SquadViewId } | undefined = $state();
  const view = $derived(squadView?.careerId === save.careerId ? squadView.view : 'squad');
  const setView = (next: SquadViewId) => (squadView = { careerId: save.careerId, view: next });
  /**
   * The order of the Elenco while this career is open (elenco.md): the screen's state, kept here
   * because the tab remounts on every visit; never in the save.
   */
  let squadSort: { careerId: string; sort: SquadSort } | undefined = $state();
  const sort = $derived(
    squadSort?.careerId === save.careerId ? squadSort.sort : ('position' as const),
  );
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
  /** The sheet cannot go to the round (US-017): the button keeps working and says why. */
  const lineupBlocked = $derived(block === undefined && !check.ready);
  const modeLabel = $derived(t(`newGame.match.${save.career.matchMode}`, lang));
  const playRound = $derived({
    state:
      career.busy || computing
        ? ('busy' as const)
        : block || lineupBlocked
          ? ('blocked' as const)
          : ('ready' as const),
    label: t('play.label', lang),
    hint:
      block !== undefined
        ? t(BLOCK_KEYS[block], lang)
        : lineupBlocked
          ? t('play.blocked.lineup', lang)
          : undefined,
    busyLabel: t('play.busy', lang),
    // The selector only where there is a round to play (proposal 33): not with the last round
    // unsaved nor with the season over.
    ...(block === undefined
      ? {
          mode: {
            label: modeLabel,
            a11yLabel: t('play.mode.open', lang, { mode: modeLabel }),
            onopen: openMode,
          },
        }
      : {}),
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
        actions: noticeActions(
          unsavedActions(unsaved),
          { retry, home: onhome, free: openSaves },
          lang,
        ),
      });
    }
    // The coach's sheet did not reach the device; with a round unsaved its banner covers both.
    const draftUnsaved = career.draftUnsaved;
    if (draftUnsaved !== undefined && unsaved === undefined) {
      const code = hasAlertText(draftUnsaved) ? draftUnsaved : 'write-failed';
      list.push({
        key: `draft-${draftUnsaved}`,
        tone: 'danger',
        title: t(alertKey(code, 'title'), lang),
        message: t(alertKey(code, 'body'), lang),
        actions: noticeActions(
          draftActions(draftUnsaved),
          { retry: () => void service.retryDraft(), free: openSaves },
          lang,
        ),
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

  /** "Tentar de novo" of the content area's error. */
  function retryArea(): void {
    if (areaError === 'invalid-save') {
      retry();
      return;
    }
    playError = undefined;
    service.dismissCrash();
  }

  /** A tap on "Jogar rodada": ignored for a moment after the summary closes (CEO decision 2). */
  function onplay(): void {
    flow.tap(handlePlay);
  }

  function handlePlay(mode?: MatchMode): void {
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
    if (!check.ready) {
      openCheck(mode);
      return;
    }
    play(mode);
  }

  /**
   * Plays the round with the sheet shown: a ready sheet passes as it is (`completeSheet`, ADR-0021,
   * item 2), an incomplete one gets the best available ("Completar e jogar"). Untouched, the
   * engine plays its own suggestion and the draft stays absent. `mode` is the one chosen in the
   * sheet of the match mode: it goes with the round (and is stored with it); without it, the
   * career's. "Só resultado" plays at once; the assisted modes open the match first.
   */
  function play(mode?: MatchMode): void {
    const sent = roundSheet(save.game, save.career.clubId, sheet, untouched, check.ready);
    const input: PlayInput = {
      ...(sent === undefined ? {} : { sheet: sent }),
      ...(mode === undefined ? {} : { matchMode: mode }),
    };
    const watch = watchModeOf(mode ?? save.career.matchMode);
    if (watch !== undefined) {
      void startMatch(input, watch);
      return;
    }
    const careerId = save.careerId;
    void service.playRound(input).then((answer) => {
      // The career may have been closed meanwhile (back to the home screen).
      if (service.snapshot.save?.careerId !== careerId) return;
      const outcome = playOutcome(answer, service.snapshot.status);
      if (outcome.kind === 'error') playError = outcome.code;
      // Only now, with the write over (stored or refused), the summary opens (resumo-rodada.md,
      // "Fluxo da rodada", step 4).
      else if (outcome.kind === 'summary') openSummary();
    });
  }

  // ------------------------------------------------------- the round summary (T-030; US-019)

  const summarySave: RoundSaveState = $derived(
    career.unsaved === undefined ? 'saved' : career.busy ? 'saving' : 'unsaved',
  );
  /** The summary's band: only the notice of the refused write (resumo-rodada.md, "Estados"). */
  const summaryNotices = $derived(notices.filter((notice) => notice.key.startsWith('unsaved-')));
  const summaryCopy = $derived({
    title: t('error.unexpected.title', lang),
    message: t('round.error.body', lang),
    retry: t('action.retry', lang),
    home: t('round.error.leave', lang),
  });

  /** What waits for a sheet's entry on its way out (the summary, the match). */
  let afterClose: (() => void) | undefined;

  /** Runs `next` now, or once the entry of a sheet closing has left the history. */
  function whenClosed(next: () => void): void {
    if (closingSheet || closingCheck || closingMode) afterClose = next;
    else {
      afterClose = undefined;
      next();
    }
  }

  function openSummary(): void {
    whenClosed(showSummary);
  }

  function showSummary(): void {
    // A sheet opened while the round was computed closes: its entry becomes the summary's.
    sheetOpen = false;
    checkOpen = false;
    flow.open();
    summaryShown = true;
  }

  /** "Continuar" (and "Sair do resumo"): back to the tab under the summary. */
  function closeSummary(): void {
    // The Rodada of the Calendário has its own address under the summary (calendario.md).
    const to = flow.close(
      current,
      roundShown === undefined ? undefined : calendarRoundHref(roundShown),
    );
    // Without the summary's entry on top, there is no popstate: the tab shows here.
    if (to !== undefined) leftSummary();
  }

  function leftSummary(): void {
    summaryShown = false;
    // Back to the address under the summary; a list of the Calendário opens on the new next round.
    readRoute(false);
    flow.left();
    void focusPlay();
  }

  /** The focus back on "Jogar rodada": the one visible at this width (bottom or sidebar). */
  async function focusPlay(): Promise<void> {
    await tick();
    const buttons = document.querySelectorAll<HTMLElement>('button.play');
    for (const button of buttons) {
      if (button.getClientRects().length > 0) {
        button.focus();
        return;
      }
    }
  }

  /** The address changed (back, forward, a link): the tab, or the summary of the last round. */
  function followHash(): void {
    // During the match the address is the match's (the popstate handles the back).
    if (match !== undefined) return;
    // Forward to a match that is over, or an address typed: the Clube, with no new entry.
    if (isMatchHash(location.hash)) {
      current = flow.toClub();
      return;
    }
    if (isRoundHash(location.hash)) {
      if (summaryRound(save.game) === undefined) {
        summaryShown = false;
        current = flow.toClub();
      } else summaryShown = true;
      return;
    }
    if (summaryShown) leftSummary();
    else readRoute(true);
  }

  // ----------------------------------------------- the narrated match (T-032; US-020, US-019)

  /**
   * Computes the coach's match and opens it. The button shows "Calculando a rodada..." while the
   * match is computed: a frame is drawn first, since `liveMatch` takes the thread.
   */
  async function startMatch(input: PlayInput, mode: WatchMode): Promise<void> {
    if (computing) return;
    computing = true;
    const careerId = save.careerId;
    const speed = service.matchSpeed();
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    // The career may have been closed meanwhile (back to the home screen).
    if (service.snapshot.save?.careerId !== careerId) {
      computing = false;
      return;
    }
    const live = service.liveMatch(input);
    const session = live.ok
      ? { careerId, input, live: live.value, mode, speed: await speed, game: save.game }
      : undefined;
    computing = false;
    if (!live.ok) {
      // "Erro ao montar a partida": the content area shows the error; nothing was applied.
      if (live.error !== 'busy') playError = live.error;
      return;
    }
    if (service.snapshot.save?.careerId !== careerId) return;
    whenClosed(() => openMatch(session!));
  }

  function openMatch(session: MatchSession): void {
    // A sheet opened while the match was computed closes: its entry becomes the match's.
    sheetOpen = false;
    checkOpen = false;
    modeOpen = false;
    const state: unknown = history.state;
    const sheetEntry =
      typeof state === 'object' && state !== null && Boolean((state as { sheet?: unknown }).sheet);
    if (sheetEntry) history.replaceState(MATCH_ENTRY, '', MATCH_HASH);
    else history.pushState(MATCH_ENTRY, '', MATCH_HASH);
    finished = undefined;
    match = session;
  }

  /** Plays and stores the round of the match, once; a failure can be asked again. */
  function finishMatch(): Promise<FinishOutcome> {
    const session = match;
    if (session === undefined) return Promise.resolve('none');
    if (finished !== undefined) return finished;
    const run = (async (): Promise<FinishOutcome> => {
      // "Tentar de novo" after a bug at the end: the career in memory is the one before it.
      if (service.snapshot.crash !== undefined) service.dismissCrash();
      const answer = await service.playRound(session.input);
      if (service.snapshot.save?.careerId !== session.careerId) return 'none';
      if (!answer.ok) return 'failed';
      if (service.snapshot.status !== 'open') return 'none';
      return answer.value.saved ? 'saved' : 'unsaved';
    })();
    finished = run;
    void run.then((outcome) => {
      if (outcome === 'failed' && finished === run) finished = undefined;
    });
    return run;
  }

  /** "Ver resumo", or Pular once stored: the summary in place of the match (`replaceState`). */
  function matchToSummary(): void {
    if (match === undefined) return;
    // The sheet of the match closing (Pular from "Sair da partida?"): its entry leaves first.
    if (history.state?.sheet !== undefined) {
      afterMatchSheet = matchToSummary;
      return;
    }
    match = undefined;
    flow.replace();
    summaryShown = true;
  }

  /** The summary waits for the sheet of the match to leave the history. */
  let afterMatchSheet: (() => void) | undefined;

  /**
   * "Voltar sem jogar" after the round failed at the end (partida.md, "Erro ao jogar no fim"): back
   * to the tab, with the round still to play.
   */
  function leaveMatch(): void {
    if (match === undefined) return;
    service.dismissCrash();
    match = undefined;
    if (isMatchHash(location.hash)) history.back();
    void focusPlay();
  }

  /** The match drew an error and "Ir direto ao resultado": the round is played and stored. */
  function skipBrokenMatch(): void {
    void finishMatch().then((outcome) => {
      if (outcome === 'saved' || outcome === 'unsaved') matchToSummary();
      else if (outcome === 'failed') {
        // The bug at the end: the content area shows the unexpected error, the round to play.
        service.dismissCrash();
        playError = 'unexpected';
        leaveMatch();
      }
    });
  }

  /** The phone's back took the match's entry away (partida.md, "Navegação", decision 6). */
  function matchBack(): void {
    const answer = matchScreen?.backAnswer() ?? 'stay';
    if (answer === 'summary') {
      // The round is stored: back opens the summary over the tab (back again returns to it).
      match = undefined;
      showSummary();
      return;
    }
    if (answer === 'leave') {
      service.dismissCrash();
      match = undefined;
      readRoute(false);
      void focusPlay();
      return;
    }
    // No way out without playing: the match's entry comes back, and the match asks.
    history.pushState(MATCH_ENTRY, '', MATCH_HASH);
    if (answer === 'ask') matchScreen?.openLeave();
  }

  function rememberSpeed(speed: MatchSpeed): void {
    void service.rememberMatchSpeed(speed);
  }

  const matchCopy = $derived({
    title: t('error.unexpected.title', lang),
    message: t('match.error.body', lang),
    retry: t('action.retry', lang),
    home: t('match.error.skip', lang),
  });

  // --------------------------------------- the sheet of the match mode (T-032; US-019, scen. 2)

  const MODE = 'play-mode';
  let modeOpen = $state(false);
  let closingMode = false;
  /** The card marked in the sheet: it holds only when "Jogar rodada" is tapped there. */
  let modeChoice: MatchMode = $state('result');
  const modeOptions = $derived(playModeOptions(save.career.matchMode, lang));

  function openMode(): void {
    if (modeOpen || computing || career.busy) return;
    modeChoice = save.career.matchMode;
    modeOpen = true;
    pushSheet(MODE);
  }

  function closeMode(): void {
    if (closingMode) return;
    if (sheetOnTop(MODE)) {
      closingMode = true;
      history.back();
    }
    modeOpen = false;
  }

  /** "Jogar rodada" in the sheet: the round with the mode chosen. */
  function playFromMode(): void {
    if (!modeOpen) return;
    const chosen = modeChoice;
    if (areaError === undefined && block === undefined && !check.ready) {
      // "Escalação incompleta" takes the place of this sheet, with the mode chosen.
      if (sheetOnTop(MODE)) history.replaceState({ ...(history.state ?? {}), sheet: CHECK }, '');
      modeOpen = false;
      checkMode = chosen;
      checkOpen = true;
      return;
    }
    closeMode();
    handlePlay(chosen);
  }

  // --------------------------------------------- the Calendário and its Rodada (T-084; US-024)

  /**
   * Shows the destination of the address. An address of the Rodada whose round is not played (or
   * is not a round) becomes `#/calendar` with no new entry (calendario.md, "Endereço que não
   * vale"). With `fromHistory`, a list reached back from a Rodada shows that round's card.
   */
  function readRoute(fromHistory: boolean): void {
    const next = destinationOf(location.hash);
    const text = calendarRoundOf(location.hash);
    const round = text === undefined ? undefined : roundFromAddress(save.game, text);
    if (text !== undefined && round === undefined) {
      history.replaceState(null, '', hrefOf(CALENDAR_DESTINATION));
    }
    calendarRound = round;
    const list = next === CALENDAR_DESTINATION && round === undefined;
    calendarOrigin = list && fromHistory ? originOf(history.state) : undefined;
    // A list shown without its origin forgets it, so coming back to this entry later (from
    // another tab) opens on the next round, not on an old card.
    if (list && calendarOrigin === undefined) {
      const state = withoutOrigin(history.state);
      if (state !== undefined) history.replaceState(state, '');
    }
    current = next;
  }

  /** A tap on a played card of the list: the Rodada, with its own entry (back returns here). */
  function openRound(round: number): void {
    // The list's entry keeps the round it was left for, so back shows its card again.
    history.replaceState({ ...(history.state ?? {}), calendarFrom: round }, '');
    history.pushState({ calendarList: true }, '', calendarRoundHref(round));
    leavingRound = false;
    calendarOrigin = undefined;
    calendarRound = round;
  }

  /**
   * The back of the Rodada's header: `history.back()` when the entry below is the list;
   * otherwise (an address typed) the address becomes the list's, with no new entry, and the list
   * shows the card of the round. An entry with `calendarList` is only ever pushed right on top of
   * the list's (`openRound`), so the entry below it is always the list, also when the Rodada was
   * reached by forward: back is right there too, and `replaceState` is only for a typed address.
   */
  function leaveRound(): void {
    if (leavingRound) return;
    if (cameFromList(history.state)) {
      leavingRound = true;
      history.back();
      return;
    }
    const from = calendarRound;
    history.replaceState(
      from === undefined ? null : { calendarFrom: from },
      '',
      hrefOf(CALENDAR_DESTINATION),
    );
    calendarRound = undefined;
    calendarOrigin = from;
  }

  // ------------------------------------------------- "Escalação incompleta" (escalacao.md; US-017)

  const CHECK = 'lineup-check';
  let checkOpen = $state(false);
  let closingCheck = false;
  /** The mode chosen in the sheet of the match mode, when "Escalação incompleta" came from it. */
  let checkMode: MatchMode | undefined;
  const blocking = $derived(
    lineupIssues(
      save.game,
      save.career.clubId,
      sheet,
      check,
      params.ai.rotationCondition,
      lang,
    ).filter((issue) => BLOCKING_ISSUES.includes(issue.kind)),
  );

  function openCheck(mode?: MatchMode): void {
    checkMode = mode;
    checkOpen = true;
    pushSheet(CHECK);
  }

  function closeCheck(): void {
    if (closingCheck) return;
    if (sheetOnTop(CHECK)) {
      closingCheck = true;
      history.back();
    } else checkOpen = false;
  }

  /** "Completar e jogar": fills only what is missing and plays (CEO decision 4). */
  function completeAndPlay(): void {
    if (!checkOpen) return;
    closeCheck();
    checkOpen = false;
    play(checkMode);
  }

  /** "Ajustar a escalação": closes the sheet and shows the Escalação. */
  function adjust(): void {
    if (!checkOpen) return;
    setView('lineup');
    if (current === 'squad') {
      closeCheck();
      return;
    }
    checkOpen = false;
    // Replaces the sheet's entry, as a pick of the "Mais" menu: back returns to the tab before.
    history.replaceState(null, '', hrefOf('squad'));
    current = 'squad';
  }

  function edit(next: DraftSheet): void {
    void writer.write(next);
  }

  function openSheet(): void {
    sheetOpen = true;
    // The back gesture closes the sheet: it gets its own entry in the history.
    history.pushState({ sheet: true }, '');
  }

  function closeSheet(): void {
    // A double tap on "Fechar": the first back is on its way; a second one would leave the tab.
    if (closingSheet) return;
    if (history.state?.sheet === true) {
      closingSheet = true;
      history.back();
    } else sheetOpen = false;
  }

  function pick(event: MouseEvent, id: DestinationId): void {
    event.preventDefault();
    sheetOpen = false;
    // Replaces the sheet's entry: back from the destination returns to the tab before it.
    history.replaceState(null, '', hrefOf(id));
    calendarRound = undefined;
    current = id;
  }

  /** "Liberar espaço": Carreiras e backup, with its own entry (back returns to the tab). */
  function openSaves(): void {
    if (current === SAVES_DESTINATION && !summaryShown) return;
    history.pushState({ saves: true }, '', hrefOf(SAVES_DESTINATION));
    // From the summary's notice: back returns to the summary.
    summaryShown = false;
    calendarRound = undefined;
    current = SAVES_DESTINATION;
  }

  /** The back of Carreiras e backup: where it came from, or the Clube tab. */
  function back(): void {
    if (history.state?.saves === true) {
      history.back();
      return;
    }
    history.replaceState(null, '', hrefOf(HOME_DESTINATION));
    current = HOME_DESTINATION;
  }

  function onBoundaryError(error: unknown): void {
    void log.record({ kind: 'programming', code: 'unexpected', screen: current, error });
  }

  onMount(() => {
    // A career always opens on its tab, never on a summary nor on a match (CEO decision 3 of
    // resumo-rodada.md; partida.md, "Navegação": the match was not played).
    if (isRoundHash(location.hash) || isMatchHash(location.hash)) current = flow.toClub();
    else readRoute(true);
    const onHash = followHash;
    const onPop = () => {
      if (match !== undefined) {
        if (!isMatchHash(location.hash)) matchBack();
        else if (afterMatchSheet !== undefined && history.state?.sheet === undefined) {
          const next = afterMatchSheet;
          afterMatchSheet = undefined;
          next();
        }
        return;
      }
      leavingRound = false;
      closingSheet = false;
      closingCheck = false;
      closingMode = false;
      if (sheetOpen && history.state?.sheet !== true) sheetOpen = false;
      if (checkOpen && !sheetOnTop(CHECK)) checkOpen = false;
      if (modeOpen && !sheetOnTop(MODE)) modeOpen = false;
      if (afterClose !== undefined) {
        const next = afterClose;
        afterClose = undefined;
        next();
      }
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
    title={roundShown === undefined
      ? t(labelKeyOf(current), lang)
      : t('round.title', lang, { round: roundShown })}
    titleId={TITLE_ID}
    backLabel={t('nav.back', lang)}
    onback={current === SAVES_DESTINATION
      ? back
      : roundShown !== undefined
        ? leaveRound
        : undefined}
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
        announce={false}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        actions={notice.actions}
      />
    {/each}
  </div>
{/snippet}

{#if match !== undefined}
  <ErrorBoundary
    layout="screen"
    copy={matchCopy}
    code={t('error.code', lang, { code: 'unexpected' })}
    onerror={(error) =>
      void log.record({ kind: 'programming', code: 'unexpected', screen: 'match', error })}
    onhome={skipBrokenMatch}
  >
    <MatchScreen
      bind:this={matchScreen}
      {lang}
      game={match.game}
      live={match.live}
      mode={match.mode}
      speed={match.speed}
      onspeed={rememberSpeed}
      onfinish={finishMatch}
      onsummary={matchToSummary}
      onleave={leaveMatch}
    />
  </ErrorBoundary>
{:else if summaryShown}
  <ErrorBoundary
    layout="screen"
    copy={summaryCopy}
    code={t('error.code', lang, { code: 'unexpected' })}
    onerror={(error) =>
      void log.record({ kind: 'programming', code: 'unexpected', screen: 'round', error })}
    onhome={closeSummary}
  >
    <RoundSummary
      {lang}
      game={save.game}
      clubId={save.career.clubId}
      save={summarySave}
      notices={summaryNotices}
      sheets={save.career.matchSheets}
      oncontinue={closeSummary}
      onerror={(error) =>
        void log.record({ kind: 'programming', code: 'unexpected', screen: 'round', error })}
    />
  </ErrorBoundary>
{:else}
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
    wide={current === 'squad' && view === 'lineup'}
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
            onclick: retryArea,
            icon: 'retry',
          }}
          secondary={[{ label: boundaryCopy.home, onclick: onhome }]}
        />
      </div>
    {:else}
      {#key screenKey}
        <ErrorBoundary
          copy={boundaryCopy}
          code={t('error.code', lang, { code: 'unexpected' })}
          onerror={onBoundaryError}
          {onhome}
        >
          {#if current === SAVES_DESTINATION}
            <Saves {service} {lang} currentId={save.careerId} />
          {:else if current === 'club'}
            <ClubView
              {lang}
              game={save.game}
              clubId={save.career.clubId}
              {more}
              onerror={onBoundaryError}
            />
          {:else if current === 'squad'}
            <SquadTab
              {lang}
              game={save.game}
              clubId={save.career.clubId}
              {view}
              onview={setView}
              {sort}
              onsort={(next) => (squadSort = { careerId: save.careerId, sort: next })}
              {sheet}
              {params}
              onedit={edit}
              onerror={onBoundaryError}
            />
          {:else if current === 'table'}
            <TableView {lang} game={save.game} clubId={save.career.clubId} />
          {:else if current === CALENDAR_DESTINATION && roundShown !== undefined}
            <CalendarRound
              {lang}
              game={save.game}
              clubId={save.career.clubId}
              round={roundShown}
              sheets={save.career.matchSheets}
              titleId={TITLE_ID}
              onerror={onBoundaryError}
            />
          {:else if current === CALENDAR_DESTINATION}
            <CalendarView
              {lang}
              game={save.game}
              clubId={save.career.clubId}
              origin={calendarOrigin}
              onopen={openRound}
            />
          {:else}
            <Placeholder message={t('screen.soon', lang)} lines={placeholderLines} />
          {/if}
        </ErrorBoundary>
      {/key}
    {/if}
  </AppShell>
{/if}

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

{#snippet checkFooter()}
  <div class="check-foot">
    <Button variant="primary" fullWidth icon="play" onclick={completeAndPlay}
      >{t('lineup.check.play', lang)}</Button
    >
    <Button variant="secondary" fullWidth onclick={adjust}>{t('lineup.check.adjust', lang)}</Button>
  </div>
{/snippet}

{#snippet modeFooter()}
  <Button variant="primary" fullWidth icon="play" onclick={playFromMode}
    >{t('play.label', lang)}</Button
  >
{/snippet}

<BottomSheet
  open={modeOpen}
  title={t('play.mode.title', lang)}
  closeLabel={t('nav.close', lang)}
  onclose={closeMode}
  footer={modeFooter}
>
  <div class="mode">
    <OptionGroup
      name="play-mode"
      legend={t('newGame.options.match', lang)}
      options={modeOptions}
      value={modeChoice}
      columns={1}
      onchange={(value) => {
        const next = modeOptions.find((option) => option.value === value);
        if (next !== undefined) modeChoice = next.value as MatchMode;
      }}
    />
    <p class="caption hint">{t('play.mode.note', lang)}</p>
  </div>
</BottomSheet>

<BottomSheet
  open={checkOpen}
  title={t('lineup.check.title', lang)}
  closeLabel={t('nav.close', lang)}
  onclose={closeCheck}
  footer={checkFooter}
>
  <div class="check">
    <p class="body">{t('lineup.check.message', lang)}</p>
    <LineupIssues title={t('lineup.issues.title', lang)} items={blocking} hideTitle level={3} />
    <p class="caption hint">{t('lineup.check.hint', lang)}</p>
  </div>
</BottomSheet>

<style>
  .mode {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .mode p {
    margin: 0;
  }
  .check {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .check p {
    margin: 0;
  }
  .hint {
    color: var(--ink-muted);
  }
  .check-foot {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
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
