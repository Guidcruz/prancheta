<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { ClubId, DraftSheet, Formation, GameState, PlayerId } from '@engine';
  import { ROLE_LIST_MAX } from '@lib/career';
  import type { Lang } from '@lib/config';
  import { t } from '@lib/i18n';
  import BottomSheet from '../components/BottomSheet.svelte';
  import Button from '../components/Button.svelte';
  import RoleEditor from '../components/RoleEditor.svelte';
  import { shownStrength, type RoleName, type ShownStrength } from '../lineup';
  import { sheetOnTop } from '../sheet-history';
  import {
    ROLES,
    addToRole,
    formationMessage,
    isPosture,
    isPressure,
    misplacedCount,
    moveInRole,
    removeFromRole,
    roleOrderMessage,
    roleSheetView,
    withFormation,
    withTactic,
  } from '../tactic';
  import TacticView from './TacticView.svelte';

  /**
   * The Tática view with its behaviour (docs/design/telas/tatica.md, funcoes.md; US-018): the
   * formation change (`reshapeLineup`, nobody leaves the team) with the arrows of the strength and
   * the message of the live region; the posture and the pressure; and the sheets of the captain,
   * the penalty and the free-kick takers, one at a time, each with its own entry in the history
   * (the phone's back, the "X", Esc, the backdrop and "Pronto" close it, and the focus goes back
   * to the line that opened it). Every change goes out at once through `onedit` (no "Salvar"):
   * the frame sends it to the career by the same writer as the Escalação.
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    /** The sheet shown (`coachSheet`): the coach's draft, or the engine's suggestion. */
    sheet: DraftSheet;
    onedit: (sheet: DraftSheet) => void;
  }
  const { lang, game, clubId, sheet, onedit }: Props = $props();

  /** The strength before the last formation change, while the lineup is the one it made. */
  let change: { before: ShownStrength; key: string } | undefined = $state();
  let announce = $state('');
  const keyOf = (s: DraftSheet) => JSON.stringify(s.lineup);
  const before = $derived(change?.key === keyOf(sheet) ? change.before : undefined);

  function formation(next: Formation): void {
    const reshaped = withFormation(game, clubId, sheet, next);
    if (reshaped === undefined) return;
    const was = shownStrength(game, clubId, sheet);
    const now = shownStrength(game, clubId, reshaped);
    change = { before: was, key: keyOf(reshaped) };
    announce = formationMessage(next, now, was, misplacedCount(game, reshaped), lang);
    onedit(reshaped);
  }

  function posture(value: string): void {
    const next = isPosture(value) ? withTactic(sheet, { posture: value }) : undefined;
    if (next !== undefined) onedit(next);
  }

  function pressure(value: string): void {
    const next = isPressure(value) ? withTactic(sheet, { pressure: value }) : undefined;
    if (next !== undefined) onedit(next);
  }

  // ------------------------------------------------------------------------- the role sheets

  const SHEET = 'role';
  let open: RoleName | undefined = $state();
  /** The line that opened the sheet: the focus goes back to it. */
  let opener: HTMLElement | undefined;
  let closing = false;
  let said = $state('');
  let body: HTMLElement | undefined = $state();
  const view = $derived(
    open === undefined ? undefined : roleSheetView(game, clubId, sheet, open, lang),
  );

  const isRole = (value: unknown): value is RoleName =>
    typeof value === 'string' && (ROLES as readonly string[]).includes(value);

  function openSheet(role: RoleName, event: MouseEvent): void {
    opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    history.pushState({ ...(history.state ?? {}), sheet: SHEET, role }, '');
    said = '';
    open = role;
  }

  async function closed(): Promise<void> {
    const back = opener;
    open = undefined;
    opener = undefined;
    await tick();
    back?.focus();
  }

  function closeSheet(): void {
    if (closing) return;
    if (sheetOnTop(SHEET)) {
      closing = true;
      history.back();
    } else void closed();
  }

  /** Where the focus goes after a change of the list (funcoes.md, "Acessibilidade"). */
  type Focus =
    | { readonly entry: PlayerId; readonly tool: 'up' | 'down' | 'remove' }
    | { readonly add: PlayerId };

  function target(focus: Focus): HTMLElement | undefined {
    if (body === undefined) return undefined;
    if ('add' in focus) {
      return (
        body.querySelector<HTMLElement>(`[data-role-add="${CSS.escape(focus.add)}"]`) ?? undefined
      );
    }
    const entry = body.querySelector<HTMLElement>(`[data-role-entry="${CSS.escape(focus.entry)}"]`);
    const tool = (name: string) =>
      entry?.querySelector<HTMLButtonElement>(`[data-role-tool="${name}"]`) ?? undefined;
    const wanted = tool(focus.tool);
    if (wanted === undefined || !wanted.disabled) return wanted;
    // Subir on the first or Descer on the last is disabled: the other order button of his.
    return tool(focus.tool === 'up' ? 'down' : 'up');
  }

  async function editRole(
    next: DraftSheet | undefined,
    role: RoleName,
    focus: Focus,
  ): Promise<void> {
    if (next === undefined) return;
    said = roleOrderMessage(game, next, role, lang);
    onedit(next);
    await tick();
    target(focus)?.focus();
  }

  function up(id: string): void {
    if (open !== undefined)
      void editRole(moveInRole(sheet, open, id, -1), open, { entry: id, tool: 'up' });
  }
  function down(id: string): void {
    if (open !== undefined)
      void editRole(moveInRole(sheet, open, id, 1), open, { entry: id, tool: 'down' });
  }
  function remove(id: string): void {
    if (open !== undefined) void editRole(removeFromRole(sheet, open, id), open, { add: id });
  }
  function add(id: string): void {
    if (open !== undefined)
      void editRole(addToRole(sheet, open, id), open, { entry: id, tool: 'remove' });
  }

  onMount(() => {
    const onPop = () => {
      closing = false;
      const role: unknown = sheetOnTop(SHEET) ? history.state?.role : undefined;
      if (!isRole(role)) {
        if (open !== undefined) void closed();
      } else if (role !== open) {
        open = role;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
</script>

<TacticView
  {lang}
  {game}
  {clubId}
  {sheet}
  {before}
  {announce}
  onformation={formation}
  onposture={posture}
  onpressure={pressure}
  onrole={openSheet}
/>

{#snippet footer()}
  <Button variant="secondary" fullWidth onclick={closeSheet}>{t('roles.done', lang)}</Button>
{/snippet}

<BottomSheet
  open={view !== undefined}
  title={view?.title ?? ''}
  closeLabel={t('nav.close', lang)}
  onclose={closeSheet}
  {footer}
>
  <div bind:this={body}>
    {#if view}
      <RoleEditor
        intro={view.intro}
        listTitle={t('roles.list', lang)}
        othersTitle={t('roles.others', lang)}
        emptyText={t('roles.empty', lang)}
        autoText={view.autoText}
        nowText={view.nowText}
        fullText={t('roles.full', lang, { max: ROLE_LIST_MAX })}
        noStartersText={view.noStartersText}
        max={ROLE_LIST_MAX}
        list={view.list}
        others={view.others}
        onup={up}
        ondown={down}
        onremove={remove}
        onadd={add}
      />
    {/if}
    <!-- The new order of the list, said after each change (funcoes.md). -->
    <p class="visually-hidden" role="status">{said}</p>
  </div>
</BottomSheet>

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
