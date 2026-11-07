<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    completeSheet,
    draftFromSheet,
    type ClubId,
    type DraftSheet,
    type GameParams,
    type GameState,
    type PlayerId,
  } from '@engine';
  import type { Lang } from '@lib/config';
  import { t } from '@lib/i18n';
  import LineupChip from '../components/LineupChip.svelte';
  import type { StatusBarAction } from '../components/LineupStatusBar.svelte';
  import {
    cardOrder,
    nameList,
    outPlayers,
    playerAt,
    restedPlayers,
    samePlace,
    shownStrength,
    strengthChange,
    suggestedSheet,
    swapPlaces,
    type Place,
    type ShownStrength,
    type SwapResult,
  } from '../lineup';
  import { blockTouchScroll, placeElementAt, pressPlace } from '../lineup-drag';
  import { sheetOnTop } from '../sheet-history';
  import LineupView from './LineupView.svelte';
  import PlayerSheet from './PlayerSheet.svelte';

  /**
   * The Escalação view with its behaviour (docs/design/telas/escalacao.md, "Trocar lugares",
   * "Barra de estado"): the three ways to swap two places (two taps, Enter and Enter, drag and
   * drop) that end in the same `swapPlaces`; the refusal of an injured or suspended player; the
   * status bar's messages; "Sugerir escalação", "Completar automaticamente" and their "Desfazer"
   * (one level, until the next swap); the player card with its own entry in the history. Every
   * change goes out at once through `onedit` (no "Salvar"): the frame sends it to the career.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    /** The sheet shown (`coachSheet`): the coach's draft, or the engine's suggestion. */
    sheet: DraftSheet;
    params: Pick<GameParams, 'ai'>;
    onedit: (sheet: DraftSheet) => void;
    /** "Mudar na Tática": the frame switches the view. */
    ontactic: () => void;
    onerror?: (error: unknown) => void;
  }
  const { lang, game, clubId, sheet, params, onedit, ontactic, onerror }: Props = $props();

  const tiredBelow = $derived(params.ai.rotationCondition);

  type Status =
    | { kind: 'none' }
    | { kind: 'selected'; player: PlayerId }
    | { kind: 'done'; text: string }
    | { kind: 'refused'; text: string }
    | { kind: 'auto'; text: string };

  let root: HTMLElement | undefined = $state();
  let selected: Place | undefined = $state();
  let status: Status = $state({ kind: 'none' });
  /**
   * Counts the messages said: a message equal to the last one (the same refusal twice) is still
   * a new one, and the status bar says it again.
   */
  let said = $state(0);
  /** The athlete of the last refused swap: his row shows why, until the next action. */
  let refusal: { place: Place; message: string } | undefined = $state();
  /** The strength before the last change, while the sheet is the one that change made. */
  let change: { before: ShownStrength; key: string } | undefined = $state();
  /** The sheet before the last "Sugerir" or "Completar", while the sheet is the one it made. */
  let undo: { sheet: DraftSheet; key: string } | undefined = $state();
  let drag: { origin: Place; target?: Place; x: number; y: number } | undefined = $state();

  const keyOf = (s: DraftSheet) => JSON.stringify(s.lineup);
  const currentKey = $derived(keyOf(sheet));
  const before = $derived(change?.key === currentKey ? change.before : undefined);
  const canUndo = $derived(undo?.key === currentKey);

  const nameOf = (id: PlayerId | undefined | null) =>
    id === null || id === undefined ? '' : (game.players[id]?.name.full ?? '');

  const statusBody = $derived.by(() => {
    const actions: StatusBarAction[] = [];
    switch (status.kind) {
      case 'selected':
        actions.push(
          { label: t('lineup.select.card', lang), icon: 'info', onclick: openSelectedCard },
          { label: t('lineup.select.cancel', lang), icon: 'close', onclick: cancelFromBar },
        );
        return {
          message: t('lineup.select.selected', lang, { name: nameOf(status.player) }),
          detail: t('lineup.select.hint', lang),
          actions,
        };
      case 'refused':
        return { message: status.text, tone: 'danger' as const };
      case 'auto':
        if (canUndo)
          actions.push({ label: t('lineup.undo', lang), icon: 'undo', onclick: undoLast });
        return { message: status.text, actions };
      case 'done':
        return { message: status.text };
      default:
        return { message: '' };
    }
  });

  const statusView = $derived({ ...statusBody, said });

  const states = $derived({
    ...(selected === undefined ? {} : { selected }),
    ...(drag === undefined ? {} : { origin: drag.origin }),
    ...(drag?.target === undefined ? {} : { target: drag.target }),
    ...(refusal === undefined ? {} : { refused: refusal.place }),
  });

  /** The element of a place in the DOM (a pitch slot or a row). */
  function elementOf(place: Place, of: DraftSheet = sheet): HTMLElement | undefined {
    if (root === undefined) return undefined;
    if (place.part === 'starters') {
      return root.querySelector<HTMLElement>(`[data-slot="${place.index}"]`) ?? undefined;
    }
    if (place.part === 'bench') {
      return root.querySelector<HTMLElement>(`[data-place="bench-${place.index}"]`) ?? undefined;
    }
    const n = outPlayers(game, clubId, of).findIndex((p) => p.id === place.id);
    return n < 0
      ? undefined
      : (root.querySelector<HTMLElement>(`[data-place="out-${n}"]`) ?? undefined);
  }

  /** The place of an element hit by the drag. */
  function placeOf(element: HTMLElement | undefined): Place | undefined {
    if (element === undefined || root === undefined || !root.contains(element)) return undefined;
    const slot = element.dataset.slot;
    if (slot !== undefined) return { part: 'starters', index: Number(slot) };
    const match = /^(bench|out)-(\d+)$/.exec(element.dataset.place ?? '');
    if (match === null) return undefined;
    const index = Number(match[2]);
    if (match[1] === 'bench') return { part: 'bench', index };
    const player = outPlayers(game, clubId, sheet)[index];
    return player === undefined ? undefined : { part: 'out', id: player.id };
  }

  /** Where the player of `place` sits in `of`, for the message under his row. */
  function placeOfPlayer(id: PlayerId, of: DraftSheet): Place {
    const starter = of.lineup.starters.indexOf(id);
    if (starter >= 0) return { part: 'starters', index: starter };
    const reserve = of.lineup.bench.indexOf(id);
    if (reserve >= 0) return { part: 'bench', index: reserve };
    return { part: 'out', id };
  }

  function say(next: Status): void {
    status = next;
    said += 1;
  }

  function cancel(): void {
    selected = undefined;
    say({ kind: 'none' });
  }

  async function cancelFromBar(): Promise<void> {
    const was = selected;
    cancel();
    await tick();
    if (was !== undefined) elementOf(was)?.focus();
  }

  /** A tap, a click or Enter on a place: pick, cancel, or the second step of the swap. */
  function tap(place: Place): void {
    refusal = undefined;
    if (selected === undefined) {
      const id = playerAt(sheet, place);
      // A free place has nobody to pick: it only receives one.
      if (id === null) return;
      selected = place;
      say({ kind: 'selected', player: id });
      return;
    }
    if (samePlace(selected, place)) {
      cancel();
      return;
    }
    const from = selected;
    selected = undefined;
    void swap(from, place);
  }

  function message(
    result: Extract<SwapResult, { ok: true }>,
    now: ShownStrength,
    was: ShownStrength,
  ): string {
    const parts: string[] = [];
    if (result.kind === 'swap') {
      parts.push(t('lineup.swap.done', lang, { a: nameOf(result.moved), b: nameOf(result.other) }));
    } else if (result.to === 'bench' && result.from !== 'bench') {
      // A move inside the bench changes nothing the player needs to hear.
      parts.push(t('lineup.move.bench', lang, { name: nameOf(result.moved) }));
    } else if (result.to === 'out') {
      parts.push(t('lineup.move.out', lang, { name: nameOf(result.moved) }));
    }
    parts.push(...strengthChange(now, was, lang));
    for (const { role, player } of result.removed) {
      parts.push(t(`lineup.roles.removed.${role}`, lang, { name: nameOf(player) }));
    }
    return parts.join(' ');
  }

  async function swap(from: Place, to: Place): Promise<void> {
    const result = swapPlaces(game, sheet, from, to);
    if (result === undefined) {
      say({ kind: 'none' });
      return;
    }
    if (!result.ok) {
      const { player, reason } = result.refused;
      refusal = {
        place: placeOfPlayer(player, sheet),
        message: t(`lineup.refuse.${reason}.short`, lang),
      };
      say({
        kind: 'refused',
        text: t(`lineup.refuse.${reason}`, lang, { name: nameOf(player) }),
      });
      await tick();
      elementOf(to)?.focus();
      return;
    }
    const was = shownStrength(game, clubId, sheet);
    const now = shownStrength(game, clubId, result.sheet);
    change = { before: was, key: keyOf(result.sheet) };
    undo = undefined;
    say({ kind: 'done', text: message(result, now, was) });
    // Where the first player arrived (the second tap, or the drop).
    const arrived = placeOfPlayer(result.moved, result.sheet);
    onedit(result.sheet);
    await tick();
    elementOf(arrived, result.sheet)?.focus();
  }

  /** "Sugerir escalação", "Completar automaticamente": a change with "Desfazer" (one level). */
  function automatic(next: DraftSheet, text: string): void {
    selected = undefined;
    refusal = undefined;
    change = {
      before: shownStrength(game, clubId, sheet),
      key: keyOf(next),
    };
    undo = { sheet, key: keyOf(next) };
    say({ kind: 'auto', text });
    onedit(next);
  }

  function suggest(): void {
    const next = suggestedSheet(game, clubId, sheet, params);
    const rested = restedPlayers(game, sheet, next, tiredBelow).map((p) => p.name.full);
    automatic(
      next,
      rested.length > 0
        ? t('lineup.suggest.rested', lang, { names: nameList(rested, lang) })
        : t('lineup.suggest.done', lang),
    );
  }

  function complete(): void {
    automatic(draftFromSheet(completeSheet(game, clubId, sheet)), t('lineup.complete.done', lang));
  }

  function undoLast(): void {
    if (undo === undefined) return;
    const back = undo.sheet;
    change = { before: shownStrength(game, clubId, sheet), key: keyOf(back) };
    undo = undefined;
    say({ kind: 'done', text: t('lineup.undo.done', lang) });
    onedit(back);
  }

  // ------------------------------------------------------------------------------- drag and drop

  function press(place: Place, event: PointerEvent): void {
    if (playerAt(sheet, place) === null) return;
    pressPlace<Place>(event, {
      placeAt: (x, y) => placeOf(placeElementAt(x, y)),
      start: (x, y) => {
        // A drag replaces any pick: the bar's "selecionado" goes with it.
        selected = undefined;
        refusal = undefined;
        say({ kind: 'none' });
        drag = { origin: place, x, y };
      },
      move: (x, y, target) => {
        if (drag !== undefined) drag = { origin: drag.origin, x, y, ...(target ? { target } : {}) };
      },
      drop: (target) => {
        const origin = drag?.origin;
        drag = undefined;
        if (origin === undefined || target === undefined) return;
        // Dropped where it started: as a tap (it picks the player).
        if (samePlace(origin, target)) tap(origin);
        else void swap(origin, target);
      },
      cancel: () => (drag = undefined),
      // The bar sticks above the frame's dock (`--tabbar-h` + `--play-h` on the phone, nothing
      // from 900px): its offset is what covers the bottom of the window.
      bottomInset: () => {
        const bar = root?.querySelector<HTMLElement>('.bar-slot');
        return bar === undefined || bar === null
          ? 0
          : parseFloat(getComputedStyle(bar).bottom) || 0;
      },
    });
  }

  const ghost = $derived.by(() => {
    if (drag === undefined) return undefined;
    const id = playerAt(sheet, drag.origin);
    const player = id === null ? undefined : game.players[id];
    if (player === undefined) return undefined;
    return {
      x: drag.x,
      y: drag.y,
      code: t(`position.${player.position}.short`, lang),
      name: player.name.display,
      overall: player.overall,
    };
  });

  // ---------------------------------------------------------------------------------- the card

  const SHEET = 'player';
  let openId: PlayerId | undefined = $state();
  let origin: HTMLElement | undefined;
  let closing = false;
  let announce = $state('');
  let card: ReturnType<typeof PlayerSheet> | undefined = $state();
  const order = $derived(cardOrder(game, clubId, sheet));
  const at = $derived(openId === undefined ? -1 : order.indexOf(openId));

  function openSelectedCard(): void {
    if (status.kind !== 'selected') return;
    const id = status.player;
    // Back to "Ver card" when it is still there; else to the picked place.
    origin =
      root?.querySelector<HTMLElement>(
        `.bar .action[aria-label="${CSS.escape(t('lineup.select.card', lang))}"]`,
      ) ?? (selected === undefined ? undefined : elementOf(selected));
    history.pushState({ ...(history.state ?? {}), sheet: SHEET, player: id }, '');
    announce = '';
    openId = id;
  }

  async function step(by: -1 | 1): Promise<void> {
    const next = order[at + by];
    if (at < 0 || next === undefined) return;
    history.replaceState({ ...(history.state ?? {}), sheet: SHEET, player: next }, '');
    openId = next;
    announce = nameOf(next);
    await tick();
    card?.keepFocus();
  }

  async function closed(): Promise<void> {
    const back = origin;
    openId = undefined;
    origin = undefined;
    await tick();
    back?.focus();
  }

  function closeCard(): void {
    if (closing) return;
    if (sheetOnTop(SHEET)) {
      closing = true;
      history.back();
    } else void closed();
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || selected === undefined || openId !== undefined) return;
    if (event.target instanceof Element && event.target.closest('dialog') !== null) return;
    event.preventDefault();
    cancel();
  }

  onMount(() => {
    const onPop = () => {
      closing = false;
      const id: unknown = sheetOnTop(SHEET) ? history.state?.player : undefined;
      if (typeof id !== 'string') {
        if (openId !== undefined) void closed();
      } else if (id !== openId) {
        openId = id;
      }
    };
    window.addEventListener('popstate', onPop);
    const unblock = root === undefined ? () => undefined : blockTouchScroll(root);
    return () => {
      window.removeEventListener('popstate', onPop);
      unblock();
    };
  });

  // A change of the sheet from outside (a round played) drops a pick left on a free place.
  $effect(() => {
    if (selected !== undefined && playerAt(sheet, selected) === null) {
      selected = undefined;
      if (status.kind === 'selected') say({ kind: 'none' });
    }
  });
</script>

<svelte:window onkeydown={onKey} />

<div bind:this={root}>
  <LineupView
    {lang}
    {game}
    {clubId}
    {sheet}
    {states}
    {before}
    {refusal}
    status={statusView}
    {tiredBelow}
    onplace={(place) => tap(place)}
    onpress={press}
    oncomplete={complete}
    onsuggest={suggest}
    {ontactic}
  />
</div>

{#if ghost}
  <div class="ghost" style="left: {ghost.x}px; top: {ghost.y}px" aria-hidden="true">
    <LineupChip
      ghost
      slotCode={ghost.code}
      a11yLabel=""
      name={ghost.name}
      overall={ghost.overall}
    />
  </div>
{/if}

<PlayerSheet
  bind:this={card}
  {lang}
  {game}
  {clubId}
  playerId={openId}
  hasPrev={at > 0}
  hasNext={at >= 0 && at < order.length - 1}
  {announce}
  onprev={() => void step(-1)}
  onnext={() => void step(1)}
  onclose={closeCard}
  {onerror}
/>

<style>
  /* The copy that follows the finger, 48px above it (escalacao.md): space-8 + space-4. */
  .ghost {
    position: fixed;
    z-index: 10;
    translate: -50% calc(-100% - var(--space-8) - var(--space-4));
    pointer-events: none;
  }
</style>
