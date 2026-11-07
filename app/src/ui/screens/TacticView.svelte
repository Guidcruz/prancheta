<script lang="ts">
  import {
    sheetProblems,
    type ClubId,
    type DraftSheet,
    type Formation,
    type GameState,
  } from '@engine';
  import type { Lang } from '@lib/config';
  import { t } from '@lib/i18n';
  import FormationPicker from '../components/FormationPicker.svelte';
  import LineupIssues from '../components/LineupIssues.svelte';
  import LinkRow from '../components/LinkRow.svelte';
  import OptionGroup from '../components/OptionGroup.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import StrengthBars from '../components/StrengthBars.svelte';
  import { shownStrength, strengthItems, type RoleName, type ShownStrength } from '../lineup';
  import {
    ROLES,
    formationOptions,
    postureOptions,
    pressureOptions,
    roleLineValue,
    tacticIssues,
  } from '../tactic';

  /**
   * The Tática view (docs/design/telas/tatica.md; US-018): the formation, the strength of the team
   * and the warnings of the formation on top (it changes little), then the posture, the pressure
   * and the lines of the roles at the thumb. Server-renderable: the props are the whole input; the
   * screen (Tactic.svelte) owns the changes, the live region's message and the role sheets. Every
   * number and rule comes from the engine's readings through ui/lineup.ts and ui/tactic.ts. No
   * primary button: the primary is "Jogar rodada".
   */
  interface Props {
    lang: Lang;
    game: GameState;
    clubId: ClubId;
    /** The sheet shown (reconciled; `coachSheet`). */
    sheet: DraftSheet;
    /** The strength before the last formation change: the arrows and signed numbers. */
    before?: ShownStrength;
    /** The message of the live region (after a formation change). */
    announce?: string;
    loading?: boolean;
    onformation?: (formation: Formation) => void;
    onposture?: (value: string) => void;
    onpressure?: (value: string) => void;
    /** A role's line was tapped: the screen opens its sheet. */
    onrole?: (role: RoleName, event: MouseEvent) => void;
  }
  const {
    lang,
    game,
    clubId,
    sheet,
    before,
    announce = '',
    loading = false,
    onformation,
    onposture,
    onpressure,
    onrole,
  }: Props = $props();
  const id = $props.id();

  const realism = $derived(game.rules.realism);
  const check = $derived(sheetProblems(game, clubId, sheet));
  const strength = $derived(strengthItems(shownStrength(game, clubId, sheet), before, lang));
  const issues = $derived(tacticIssues(game, clubId, sheet, check, lang));
  const roles = $derived(
    ROLES.map((role) => ({
      role,
      label: t(`roles.${role}`, lang),
      value: roleLineValue(game, clubId, sheet, role, lang),
    })),
  );
</script>

<div class="tactic">
  {#if loading}
    <Skeleton label={t('tactic.loading', lang)} count={3} />
  {:else}
    <FormationPicker
      name="{id}-formation"
      legend={t('tactic.formation.legend', lang)}
      note={t('tactic.formation.note', lang)}
      options={formationOptions(lang)}
      value={sheet.lineup.formation}
      onchange={(formation) => onformation?.(formation)}
    />
    <StrengthBars
      title={t('lineup.strength.title', lang)}
      items={strength}
      helpLabel={t('lineup.strength.help.label', lang)}
      help={t(`lineup.strength.help.${realism === 'full' ? 'full' : 'simplified'}`, lang)}
    />
    <LineupIssues title={t('tactic.issues.title', lang)} items={issues} />
    <OptionGroup
      name="{id}-posture"
      legend={t('tactic.posture.legend', lang)}
      options={postureOptions(lang)}
      value={sheet.tactic.posture}
      onchange={(value) => onposture?.(value)}
    />
    <OptionGroup
      name="{id}-pressure"
      legend={t('tactic.pressure.legend', lang)}
      options={pressureOptions(lang)}
      value={sheet.tactic.pressure}
      onchange={(value) => onpressure?.(value)}
    />
    <section class="roles" aria-labelledby="{id}-roles">
      <h2 class="body-strong heading" id="{id}-roles">{t('tactic.roles.title', lang)}</h2>
      <ul>
        {#each roles as line (line.role)}
          <li data-role={line.role}>
            <LinkRow
              label={line.label}
              value={line.value}
              onclick={(event) => onrole?.(line.role, event)}
            />
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  <!-- Always in the DOM, so the message after a formation change is announced (tatica.md). -->
  <p class="visually-hidden" role="status">{announce}</p>
</div>

<style>
  .tactic {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding-block: var(--space-4);
    min-width: 0;
  }
  .heading {
    margin: 0 0 var(--space-1);
  }
  .roles ul {
    margin: 0;
    padding: 0;
    list-style: none;
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
