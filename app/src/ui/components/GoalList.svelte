<script lang="ts" module>
  /** One goal, its texts already formatted by the screen ("23'", "minuto 23", "pênalti"). */
  export interface GoalItem {
    minute: string;
    /** The minute as read by a screen reader; the visible one is hidden from it. */
    minuteA11y: string;
    /** The scorer's display name. */
    name: string;
    /** The short kind ("pênalti", "falta"), when not a goal from open play. */
    kind?: string;
    /** The kind as read ("de pênalti"). */
    kindA11y?: string;
  }

  /** One side's goals: the list's accessible name ("Gols de Leões") and its goals. */
  export interface GoalColumn {
    label: string;
    goals: readonly GoalItem[];
  }
</script>

<script lang="ts">
  /**
   * GoalList (componentes.md, "Casca da T-030"): the goals of one match in two lists side by side,
   * home on the left, each in the order of the minute, one goal per line that wraps. The minute in
   * `numero` and the kind in `caption`. The visible parts are hidden from screen readers, which
   * read one sentence per goal, with a pause between its parts ("minuto 23, Fulano, de
   * pênalti"). With no goal at all, `emptyText` in place of the lists. Nothing is tappable.
   */
  interface Props {
    columns: readonly [GoalColumn, GoalColumn];
    emptyText: string;
  }
  const { columns, emptyText }: Props = $props();
  const empty = $derived(columns.every((column) => column.goals.length === 0));
  /** What a screen reader reads of a goal: the full texts, in the order they are shown. */
  const spoken = (goal: GoalItem) =>
    [goal.minuteA11y, goal.name, goal.kind === undefined ? undefined : (goal.kindA11y ?? goal.kind)]
      .filter((part) => part !== undefined)
      .join(', ');
</script>

{#if empty}
  <p class="body none">{emptyText}</p>
{:else}
  <div class="goals">
    {#each columns as column, i (i)}
      <ul class="column" aria-label={column.label}>
        {#each column.goals as goal, j (j)}
          <li class="goal">
            <span class="numero minute" aria-hidden="true">{goal.minute}</span>
            <span class="body who" aria-hidden="true"
              >{goal.name}{#if goal.kind}<span class="caption kind">{` ${goal.kind}`}</span
                >{/if}</span
            >
            <span class="visually-hidden">{spoken(goal)}</span>
          </li>
        {/each}
      </ul>
    {/each}
  </div>
{/if}

<style>
  .none {
    margin: 0;
    color: var(--ink-muted);
    text-align: center;
  }
  .goals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .goal {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }
  .minute {
    flex: none;
    font-variant-numeric: tabular-nums;
  }
  .who {
    min-width: 0;
    overflow-wrap: break-word;
  }
  .kind {
    color: var(--ink-muted);
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
