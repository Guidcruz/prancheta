<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * "Jogar rodada": the primary of every tabbed screen. `float` sits centred above the phone's
   * tab bar; `side` fills the foot of the desktop sidebar. It never disappears and is never
   * greyed out without a reason: `blocked` stays tappable and shows `hint` under the label.
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
    onplay?: () => void;
  }
  const { state = 'ready', label, hint, busyLabel, placement = 'float', onplay }: Props = $props();
  const hintId = $props.id();
</script>

<button
  type="button"
  class="play {placement} {state}"
  aria-busy={state === 'busy' || undefined}
  aria-describedby={state === 'blocked' && hint ? hintId : undefined}
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
    {#if state === 'blocked' && hint}
      <span class="caption hint" id={hintId}>{hint}</span>
    {/if}
  </span>
  {#if state === 'busy' && busyLabel}
    <span class="visually-hidden" role="status">{busyLabel}</span>
  {/if}
</button>

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
