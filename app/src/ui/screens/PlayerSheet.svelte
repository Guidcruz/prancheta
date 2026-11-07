<script lang="ts">
  import type { ClubId, GameState, PlayerId } from '@engine';
  import type { Lang } from '@lib/config';
  import { t } from '@lib/i18n';
  import BottomSheet from '../components/BottomSheet.svelte';
  import Button from '../components/Button.svelte';
  import ErrorState from '../components/ErrorState.svelte';
  import PlayerCard from '../components/PlayerCard.svelte';
  import { readBlock } from '../club';
  import { playerCard } from '../squad';

  /**
   * The full player card in a BottomSheet (docs/design/telas/jogador.md; US-016): a dialog on
   * the phone and, from 900px, the floating dialog anchored by its base. "Anterior" and "Próximo"
   * in the fixed foot follow the order of the list that opened it and never wrap. A player no
   * longer in the squad (a stale id in the history) or a card that fails to build shows an
   * ErrorState `block` inside the sheet, which keeps its close button (jogador.md, "Erro"). The
   * sheet stays mounted, so the native dialog gives the focus back to the name that opened it.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    /** The player shown; `undefined`: closed. */
    playerId: PlayerId | undefined;
    hasPrev: boolean;
    hasNext: boolean;
    /** The new name after "Anterior"/"Próximo", read once by screen readers. */
    announce?: string;
    onprev: () => void;
    onnext: () => void;
    onclose: () => void;
    /** Logs a card that failed to build (lib/errors, without personal data). */
    onerror?: (error: unknown) => void;
  }
  const {
    lang,
    game,
    clubId,
    playerId,
    hasPrev,
    hasNext,
    announce = '',
    onprev,
    onnext,
    onclose,
    onerror,
  }: Props = $props();

  let foot: HTMLElement | undefined = $state();

  /** The card, or why there is none: a stale id (`undefined`) or an error building it. */
  const read = $derived(
    playerId === undefined ? undefined : readBlock(() => playerCard(game, clubId, playerId, lang)),
  );
  const card = $derived(read?.ok ? read.value : undefined);
  // A card that failed to build is a bug: logged, like the boundary of the tab does.
  $effect(() => {
    if (read !== undefined && !read.ok) onerror?.(read.error);
  });
  const title = $derived(
    // A stale id: the sheet is named "Jogador" and the ErrorState inside says what happened.
    playerId === undefined ? '' : (card?.title ?? t('squad.col.player', lang)),
  );

  /** After a swap, a button that became disabled (first or last) hands the focus to the other. */
  export function keepFocus(): void {
    const buttons = foot ? Array.from(foot.querySelectorAll('button')) : [];
    const lost = buttons.find((b) => b.disabled && b === document.activeElement);
    if (lost !== undefined || document.activeElement === document.body) {
      buttons.find((b) => !b.disabled)?.focus();
    }
  }
</script>

{#snippet footer()}
  <div class="foot" bind:this={foot}>
    <Button variant="secondary" fullWidth disabled={!hasPrev || card === undefined} onclick={onprev}
      >{t('player.prev', lang)}</Button
    >
    <Button variant="secondary" fullWidth disabled={!hasNext || card === undefined} onclick={onnext}
      >{t('player.next', lang)}</Button
    >
    <p class="visually-hidden" aria-live="polite">{announce}</p>
  </div>
{/snippet}

<BottomSheet
  open={playerId !== undefined}
  {title}
  closeLabel={t('nav.close', lang)}
  {onclose}
  {footer}
>
  {#if playerId === undefined}
    <!-- Closed: nothing to show. -->
  {:else if card === undefined}
    <ErrorState
      layout="block"
      title={t('player.error.title', lang)}
      message={t('player.error.body', lang)}
    />
  {:else}
    <PlayerCard
      fullName={card.fullName}
      face={card.face}
      shirt={card.shirt}
      positionLabel={card.positionLabel}
      positionCode={card.positionCode}
      sector={card.sector}
      facts={card.facts}
      overall={card.overall}
      overallLabel={t('player.overall', lang)}
      badges={card.badges}
      statesTitle={t('player.states.title', lang)}
      states={card.states}
      attributesTitle={t('player.attributes.title', lang)}
      attributes={card.attributes}
      traitTitle={t('player.trait.title', lang)}
      trait={card.trait}
      seasonTitle={t('player.season.title', lang)}
      season={card.season}
    />
  {/if}
</BottomSheet>

<style>
  .foot {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
