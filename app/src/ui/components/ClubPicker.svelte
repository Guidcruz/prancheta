<script lang="ts" module>
  import type { ShieldClub } from '@lib/generators/shield';

  export interface ClubChoice {
    club: ShieldClub;
    /** Short name, already from the club data. */
    label: string;
    /** "Rio de Janeiro (RJ)", already formatted. */
    detail?: string;
    strength: number;
  }

  /** A difficulty band (temporada.md, "Força e dificuldade na escolha do clube"). */
  export interface ClubGroup {
    id: string;
    /** "Favoritos", already translated. */
    title: string;
    /** The band of one club, for screen readers ("Favorito"). */
    bandLabel: string;
    clubs: readonly ClubChoice[];
  }
</script>

<script lang="ts">
  import ClubOption from './ClubOption.svelte';

  /**
   * The 20 clubs of the new game, grouped by difficulty band (the screen sorts and groups them).
   * One radio group for the whole list: the bands are only headings. One column on the phone,
   * a grid from 900px.
   */
  interface Props {
    /** Group name of the radios. */
    name: string;
    /** "Escolha o seu clube" (newGame.clubs.legend). */
    legend: string;
    /** A line under the legend (newGame.clubs.hint). */
    hint?: string;
    strengthLabel: string;
    groups: readonly ClubGroup[];
    selected?: string;
    onselect: (clubId: string) => void;
  }
  const { name, legend, hint, strengthLabel, groups, selected, onselect }: Props = $props();
  const hintId = $props.id();
</script>

<fieldset class="picker" aria-describedby={hint ? hintId : undefined}>
  <legend class="subtitulo">{legend}</legend>
  {#if hint}<p class="body hint" id={hintId}>{hint}</p>{/if}
  {#each groups as group (group.id)}
    <section class="group" aria-labelledby="{hintId}-{group.id}">
      <h3 class="rotulo band" id="{hintId}-{group.id}">{group.title}</h3>
      <ul>
        {#each group.clubs as choice (choice.club.id)}
          <li>
            <ClubOption
              {name}
              club={choice.club}
              label={choice.label}
              detail={choice.detail}
              strength={choice.strength}
              {strengthLabel}
              bandLabel={group.bandLabel}
              checked={selected === choice.club.id}
              onselect={() => onselect(choice.club.id)}
            />
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</fieldset>

<style>
  .picker {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
  }
  .hint {
    margin: var(--space-1) 0 0;
    color: var(--ink-muted);
  }
  .group {
    margin-top: var(--space-6);
  }
  .band {
    margin: 0 0 var(--space-2);
    color: var(--ink-muted);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  /* Desktop breakpoint (docs/02-architecture.md, 3). No token yet: componentes.md, proposal 1. */
  @media (min-width: 900px) {
    ul {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
