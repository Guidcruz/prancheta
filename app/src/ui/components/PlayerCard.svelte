<script lang="ts" module>
  /** A short fact ("Idade" / "23 anos"), already translated and formatted. */
  export interface CardFact {
    label: string;
    value: string;
  }
  import type { Level } from './levels';

  /**
   * One state with a bar: condition and morale (0..100), form (3..10, `valueText` "7,2"). With
   * `level` (`levelOf` on the shown value) the number takes its band's colour, and `srText` reads
   * it with the band in words ("82, boa").
   */
  export interface CardMeter {
    id: string;
    label: string;
    value: number | undefined;
    max: number;
    valueText?: string;
    emptyText?: string;
    level?: Level;
    srText?: string;
  }
  export interface CardAttribute {
    id: string;
    label: string;
    value: number;
  }
</script>

<script lang="ts">
  import AttributeBar from './AttributeBar.svelte';
  import Avatar from './Avatar.svelte';
  import StatusBadge, { type StatusBadgeItem } from './StatusBadge.svelte';

  /**
   * PlayerCard (CardJogador, variant `full`): everything the coach reads before picking an
   * athlete, as the body of the player's BottomSheet (the sheet's title is the name the squad row
   * shows; `fullName` is the civil name under it). Avatar, position, facts, overall and badges on top; then the states, the 6
   * attributes of the position, the trait and the season. Two columns when the sheet is wide (a phone lying down,
   * the desktop dialog). Every text comes in translated; the potential has no prop, ever.
   */
  interface Props {
    /** The full name, when the title is a nickname or a short form; absent when they match. */
    fullName?: string;
    /** `Player.face`. */
    face: string;
    /** The club's first colour for the avatar's shirt. */
    shirt?: string;
    /** "Atacante". */
    positionLabel: string;
    /** "23 anos", "Camisa 9". */
    facts: readonly CardFact[];
    overall: number;
    /** "Nota geral". */
    overallLabel: string;
    badges?: readonly StatusBadgeItem[];
    statesTitle: string;
    /** Condition (absent in Realismo simplificado), morale, form. */
    states: readonly CardMeter[];
    attributesTitle: string;
    attributes: readonly CardAttribute[];
    traitTitle: string;
    trait: { name: string; description: string };
    seasonTitle: string;
    /** "Jogos" / "5", "Gols" / "2": zeros are shown, never hidden. */
    season: readonly CardFact[];
  }
  const {
    fullName,
    face,
    shirt,
    positionLabel,
    facts,
    overall,
    overallLabel,
    badges = [],
    statesTitle,
    states,
    attributesTitle,
    attributes,
    traitTitle,
    trait,
    seasonTitle,
    season,
  }: Props = $props();
</script>

<div class="card">
  {#if fullName !== undefined}
    <p class="caption muted">{fullName}</p>
  {/if}
  <div class="top">
    <Avatar {face} {shirt} size="xl" />
    <div class="id">
      <p class="body-strong">{positionLabel}</p>
      <p class="body muted facts">
        {#each facts as fact (fact.label)}
          <span class="fact-item">{fact.value}</span>
        {/each}
      </p>
      <p class="overall">
        <span class="titulo number">{overall}</span>
        <span class="caption muted">{overallLabel}</span>
      </p>
    </div>
  </div>
  {#if badges.length > 0}
    <p class="badges">
      {#each badges as badge (badge.kind)}
        <StatusBadge {...badge} />
      {/each}
    </p>
  {/if}

  <div class="grid">
    <section class="block">
      <h3 class="rotulo heading">{statesTitle}</h3>
      <dl>
        {#each states as meter (meter.id)}
          <AttributeBar
            label={meter.label}
            value={meter.value}
            max={meter.max}
            valueText={meter.valueText}
            emptyText={meter.emptyText}
            level={meter.level}
            srText={meter.srText}
          />
        {/each}
      </dl>
    </section>

    <section class="block">
      <h3 class="rotulo heading">{attributesTitle}</h3>
      <dl>
        {#each attributes as attribute (attribute.id)}
          <AttributeBar label={attribute.label} value={attribute.value} max={99} />
        {/each}
      </dl>
    </section>

    <section class="block">
      <h3 class="rotulo heading">{traitTitle}</h3>
      <p class="body-strong">{trait.name}</p>
      <p class="body muted">{trait.description}</p>
    </section>

    <section class="block">
      <h3 class="rotulo heading">{seasonTitle}</h3>
      <dl class="season">
        {#each season as fact (fact.label)}
          <div class="fact">
            <dt class="caption muted">{fact.label}</dt>
            <dd class="titulo number">{fact.value}</dd>
          </div>
        {/each}
      </dl>
    </section>
  </div>
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-2) var(--space-4);
    container-type: inline-size;
  }
  p,
  h3,
  dl,
  dd {
    margin: 0;
  }
  .top {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .id {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    column-gap: var(--space-2);
  }
  /* A dot between the facts, drawn by CSS so screen readers do not read it. */
  .fact-item + .fact-item::before {
    content: '·' / '';
    margin-inline-end: var(--space-2);
  }
  .overall {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }
  .number {
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--ink-muted);
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .grid {
    display: grid;
    gap: var(--space-4);
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    padding-block-start: var(--space-3);
    border-block-start: 1px solid var(--line);
  }
  .heading {
    color: var(--ink-muted);
  }
  .season {
    display: flex;
    gap: var(--space-8);
  }
  .fact {
    display: flex;
    flex-direction: column;
  }
  /* A wide sheet (phone lying down, 720px; desktop dialog, 540px): two columns. A phone
     standing (390px) keeps one. `breakpoint-card` (design-system.md, "Card em duas colunas"):
     a CSS variable cannot sit in @container, so the value is written here. */
  @container (min-width: 480px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: var(--space-6);
    }
  }
</style>
