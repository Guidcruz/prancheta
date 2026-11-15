<script lang="ts" module>
  /** The selector of the match mode beside "Jogar rodada" (T-032; proposal 33). */
  export interface PlayMode {
    /** The current mode, under the label ("Só lances principais"), already translated. */
    label: string;
    /** The name of the segment (play.mode.open, with the current mode). */
    a11yLabel: string;
    /** Opens the sheet of the match mode. */
    onopen: () => void;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * "Jogar rodada": the primary of every tabbed screen. `float` sits centred above the phone's
   * tab bar; `side` fills the foot of the desktop sidebar. It never disappears and is never
   * greyed out without a reason: `blocked` stays tappable and shows `hint` under the label.
   *
   * With `mode` (T-032; design-system.md, "'Jogar rodada' com seletor", proposal 33) it becomes a
   * split button, still one primary: the label with the current mode under it in `caption` (the
   * reason takes its place when blocked), and on the right, after a 1px line in the text colour, a
   * 48px segment with `chevron-down` that opens the sheet of the match mode. Both targets have the
   * height of the button. While busy the segment goes away. The label stays the button's name;
   * the line under it describes it.
   */
  interface Props {
    state?: 'ready' | 'blocked' | 'busy';
    /** Already translated (play.label). */
    label: string;
    /** Why the round is blocked (play.blocked.*); shown under the label. */
    hint?: string;
    /** Announced while busy (play.busy). */
    busyLabel?: string;
    placement?: 'float' | 'side';
    /** The selector of the match mode: only where there is a round to play. */
    mode?: PlayMode;
    onplay?: () => void;
  }
  const {
    state = 'ready',
    label,
    hint,
    busyLabel,
    placement = 'float',
    mode,
    onplay,
  }: Props = $props();
  const hintId = $props.id();
  const split = $derived(mode !== undefined && state !== 'busy');
  /** The line under the label: the reason when blocked, otherwise the current mode. */
  const line = $derived(state === 'blocked' && hint ? hint : split ? mode?.label : undefined);
</script>

{#snippet main()}
  <button
    type="button"
    class="play {placement} {state}"
    class:joined={split}
    aria-busy={state === 'busy' || undefined}
    aria-label={split ? label : undefined}
    aria-describedby={line ? hintId : undefined}
    onclick={state === 'busy' ? undefined : onplay}
  >
    {#if state === 'busy'}
      <span class="spinner" aria-hidden="true"></span>
    {:else if state === 'blocked'}
      <Icon name="warning" size={22} />
    {:else}
      <Icon name="play" size={22} />
    {/if}
    <span class="text">
      <span class="botao">{label}</span>
      {#if line}
        <span class="caption hint" id={hintId}>{line}</span>
      {/if}
    </span>
    {#if state === 'busy' && busyLabel}
      <span class="visually-hidden" role="status">{busyLabel}</span>
    {/if}
  </button>
{/snippet}

{#if split && mode}
  <div class="split {placement} {state}">
    {@render main()}
    <button
      type="button"
      class="segment"
      aria-haspopup="dialog"
      aria-label={mode.a11yLabel}
      onclick={mode.onopen}
    >
      <Icon name="chevron-down" size={22} />
    </button>
  </div>
{:else}
  {@render main()}
{/if}

<style>
  .play {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: calc(var(--touch) + var(--space-2));
    padding: var(--space-2) var(--space-6);
    border: 2px solid transparent;
    border-radius: var(--radius-pill);
    background: var(--grass);
    color: var(--on-grass);
    cursor: pointer;
    text-align: left;
    box-shadow: var(--shadow-card);
  }
  .float {
    max-width: calc(100vw - 2 * var(--space-4));
  }
  .side {
    width: 100%;
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .hint {
    /* The reason is always in text, not only in the warning colour. */
    color: inherit;
  }
  .blocked {
    background: var(--floodlight);
    color: var(--on-floodlight);
  }
  .busy {
    cursor: progress;
  }
  /* The split button (proposal 33): one pill, the label and the segment inside it. */
  .split {
    display: inline-flex;
    align-items: stretch;
    border-radius: var(--radius-pill);
    background: var(--grass);
    color: var(--on-grass);
    box-shadow: var(--shadow-card);
  }
  .split.blocked {
    background: var(--floodlight);
    color: var(--on-floodlight);
  }
  .joined {
    flex: 1;
    min-width: 0;
    max-width: none;
    justify-content: flex-start;
    padding-right: var(--space-4);
    border-radius: var(--radius-pill) 0 0 var(--radius-pill);
    background: transparent;
    color: inherit;
    box-shadow: none;
  }
  .segment {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 48px;
    min-height: calc(var(--touch) + var(--space-2));
    padding: 0 var(--space-1) 0 0;
    border: 2px solid transparent;
    /* The line between the two targets: 1px in the text colour (on-grass; on-floodlight when
       blocked). */
    border-left: 1px solid currentColor;
    border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .spinner {
    /* The size of the icon it replaces (Icon size 22); no icon-size token yet: componentes.md,
       "Propostas ao design system". */
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: var(--radius-pill);
    border: 2px solid currentColor;
    border-right-color: transparent;
    /* Duration waits for the motion tokens (componentes.md, proposal 2); app.css stops it under
       prefers-reduced-motion, and the still ring and the status text stay. */
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
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
