<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { ClubId, GameState, PlayerId } from '@engine';
  import type { Lang } from '@lib/config';
  import { sheetOnTop } from '../sheet-history';
  import { sortOrDefault, sortPlayers, squadPlayers, type SquadSort } from '../squad';
  import PlayerSheet from './PlayerSheet.svelte';
  import SquadView from './SquadView.svelte';

  /**
   * The Elenco tab with its player card (elenco.md, jogador.md). The card has its own entry in
   * the history (the phone's back closes it and stays on `#/squad`); "Anterior" and "Próximo"
   * replace that entry, so back never walks the squad. The chosen order lives in the frame while
   * the career is open (`sort`, `onsort`): it is the screen's state, never the save's.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    sort: SquadSort;
    onsort: (sort: SquadSort) => void;
    /** Logs a card that failed to build. */
    onerror?: (error: unknown) => void;
  }
  const { lang, game, clubId, sort, onsort, onerror }: Props = $props();

  const SHEET = 'player';
  let openId: PlayerId | undefined = $state();
  /** The name button of the player that opened the card: the focus returns there. */
  let origin: HTMLElement | undefined;
  /** `history.back()` was asked and its popstate has not come yet: a second close waits. */
  let closing = false;
  let announce = $state('');
  let view: ReturnType<typeof SquadView> | undefined = $state();
  let sheet: ReturnType<typeof PlayerSheet> | undefined = $state();

  const current = $derived(sortOrDefault(sort, game.rules.realism));
  const players = $derived(sortPlayers(squadPlayers(game, clubId), current));
  const at = $derived(openId === undefined ? -1 : players.findIndex((p) => p.id === openId));

  /** The player of the sheet's entry in the history, when that entry is the current one. */
  function playerOfEntry(): PlayerId | undefined {
    if (!sheetOnTop(SHEET)) return undefined;
    const id: unknown = history.state?.player;
    return typeof id === 'string' ? id : undefined;
  }

  function open(id: PlayerId): void {
    history.pushState({ ...(history.state ?? {}), sheet: SHEET, player: id }, '');
    announce = '';
    origin = view?.nameButton(id);
    openId = id;
  }

  async function step(by: -1 | 1): Promise<void> {
    const next = players[at + by];
    if (at < 0 || next === undefined) return;
    history.replaceState({ ...(history.state ?? {}), sheet: SHEET, player: next.id }, '');
    openId = next.id;
    announce = next.name.full;
    await tick();
    sheet?.keepFocus();
  }

  async function closed(): Promise<void> {
    const back = origin;
    openId = undefined;
    origin = undefined;
    await tick();
    // Always to the name of the player that opened the card: the native dialog gives the focus
    // back to whatever had it, and a tap on a cell of the row leaves it on the table's box.
    back?.focus();
  }

  function close(): void {
    // A double tap on the X: the first back is on its way; a second one would leave the tab.
    if (closing) return;
    // Back removes the sheet's entry; the popstate then closes the sheet.
    if (sheetOnTop(SHEET)) {
      closing = true;
      history.back();
    } else void closed();
  }

  onMount(() => {
    const onPop = () => {
      closing = false;
      const id = playerOfEntry();
      if (id === undefined) {
        if (openId !== undefined) void closed();
      } else if (id !== openId) {
        // Forward to the sheet's entry: the card opens again on its player.
        origin ??= view?.nameButton(id);
        openId = id;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
</script>

<SquadView
  bind:this={view}
  {lang}
  {game}
  {clubId}
  sort={current}
  {players}
  {onsort}
  onopen={open}
/>

<PlayerSheet
  bind:this={sheet}
  {lang}
  {game}
  {clubId}
  playerId={openId}
  hasPrev={at > 0}
  hasNext={at >= 0 && at < players.length - 1}
  {announce}
  onprev={() => void step(-1)}
  onnext={() => void step(1)}
  onclose={close}
  {onerror}
/>
