<script lang="ts" module>
  import type { IconName } from './Icon.svelte';

  export interface StatusBarAction {
    /** "Cancelar", "Ver card", "Desfazer", already translated. */
    label: string;
    /** Below 480px of width only the icon shows; the label stays as the accessible name. */
    icon: IconName;
    onclick: () => void;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * LineupStatusBar: the line at the thumb that says what is going on in the lineup
   * (escalacao.md, "Barra de estado"): who is picked and what to do next, why a move was refused,
   * or the last automatic change with "Desfazer". It sticks to the bottom of the screen, above
   * "Jogar rodada" and the tab bar on the phone (it reads the frame's `--tabbar-h` and
   * `--play-h`), and to the bottom of the column from 900px. Put it last in the screen, so the
   * sticky position has room to work.
   *
   * The live region is always in the DOM, also with nothing to say, so the first message is
   * announced (polite). With an empty `message` the bar takes no space.
   */
  interface Props {
    /** "Ildo selecionado", "Ildo está lesionado e não pode ser escalado." Empty: hidden. */
    message: string;
    /** Second line: "Toque em outro jogador ou numa vaga para trocar." */
    detail?: string;
    /** Id for the chips' `aria-describedby` while a player is picked. */
    detailId?: string;
    tone?: 'neutral' | 'danger';
    actions?: readonly StatusBarAction[];
    /**
     * Changes with every message the screen says. The same text said again (a second refusal of
     * the same player) leaves the region empty for one frame and writes it back, so screen
     * readers announce it again; a new text is announced by itself.
     */
    said?: number;
  }
  const { message, detail, detailId, tone = 'neutral', actions = [], said }: Props = $props();

  /** The text is out of the region for a frame, so a repeated message is a new one. */
  let quiet = $state(false);
  let last: { said: number | undefined; message: string } | undefined;
  $effect(() => {
    const now = { said, message };
    const repeated =
      last !== undefined &&
      now.said !== last.said &&
      now.message === last.message &&
      message !== '';
    last = now;
    if (!repeated) return;
    quiet = true;
    const frame = requestAnimationFrame(() => (quiet = false));
    return () => {
      cancelAnimationFrame(frame);
      quiet = false;
    };
  });
</script>

<div class="bar-slot">
  <div class="bar {tone}" class:hidden={message === ''} role="status">
    {#if message !== ''}
      {#if tone === 'danger'}<Icon name="warning" size={20} />{/if}
      <p class="text">
        <span class="body-strong">{quiet ? '' : message}</span>
        {#if detail}<span class="caption detail" id={detailId}>{detail}</span>{/if}
      </p>
      {#if actions.length > 0}
        <span class="actions">
          {#each actions as action (action.label)}
            <button
              type="button"
              class="action body-strong"
              aria-label={action.label}
              onclick={action.onclick}
            >
              <Icon name={action.icon} size={20} />
              <span class="action-label" aria-hidden="true">{action.label}</span>
            </button>
          {/each}
        </span>
      {/if}
    {/if}
  </div>
</div>

<style>
  .bar-slot {
    container-type: inline-size;
    position: sticky;
    /* Above the floating "Jogar rodada" and the tab bar of the frame (AppShell). */
    inset-block-end: calc(
      var(--tabbar-h, 0px) + var(--play-h, 0px) + var(--space-4) + env(safe-area-inset-bottom)
    );
    z-index: 1;
    margin-block-start: var(--space-3);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-2);
    color: var(--ink);
    box-shadow: var(--shadow-lift);
  }
  .bar.hidden {
    padding: 0;
    border: 0;
    box-shadow: none;
  }
  .danger {
    border-color: var(--danger);
    background: var(--danger-soft);
  }
  .danger > :global(svg) {
    color: var(--danger);
  }
  .text {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    margin: 0;
    min-inline-size: 0;
  }
  .detail {
    color: var(--ink-muted);
  }
  .danger .detail {
    color: var(--ink);
  }
  .actions {
    display: flex;
    flex: none;
    gap: var(--space-1);
  }
  .action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-block-size: var(--touch);
    min-inline-size: var(--touch);
    justify-content: center;
    padding: 0 var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-1);
    color: var(--ink);
    cursor: pointer;
  }
  /* Narrow bar: icons only, so the bar stays one line high over the pitch. breakpoint-card
     (design-system.md): a variable does not work in @container. */
  .action-label {
    display: none;
  }
  @container (min-width: 480px) {
    .action-label {
      display: inline;
    }
    .action {
      padding: 0 var(--space-3);
    }
  }
  .action:hover {
    border-color: var(--ink-muted);
  }
  .action:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  /* Phone on its side (844×390): the frame's dock already takes about a third of the height, so
     the bar keeps one line: no second line (still read through aria-describedby) and icons
     only. 480px of height: no token; escalacao.md, "Celular deitado". */
  @media (max-height: 480px) {
    .detail {
      display: none;
    }
    .bar {
      padding-block: var(--space-1);
    }
    .action {
      padding: 0 var(--space-2);
    }
    .action-label {
      display: none;
    }
  }
  /* Desktop breakpoint (docs/02-architecture.md, 3). No token yet: componentes.md, proposal 1. */
  @media (min-width: 900px) {
    .bar-slot {
      inset-block-end: var(--space-4);
    }
  }
</style>
