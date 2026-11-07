<script lang="ts">
  /**
   * Skeleton: a placeholder while something local is read. It shows only after a short wait, so
   * a fast read does not blink; with movement on it also has a soft pulse. Under
   * `prefers-reduced-motion` it shows at once, still (app.css stops every animation).
   * The caller announces the wait in text (`label`, read once by screen readers).
   */
  interface Props {
    /** "Carregando as carreiras..." (home.loading). */
    label: string;
    /** `card`: the size of a CareerCard row; `featured`: of the featured card. */
    shape?: 'card' | 'featured';
    count?: number;
  }
  const { label, shape = 'card', count = 1 }: Props = $props();
</script>

<div class="skeleton" role="status">
  <span class="sr">{label}</span>
  {#each { length: count }, i (i)}
    <div class="block {shape}" aria-hidden="true">
      <span class="crest"></span>
      <span class="lines"><span class="l1"></span><span class="l2"></span></span>
    </div>
  {/each}
</div>

<style>
  .skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .block {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    border: 1px solid var(--line);
  }
  .featured {
    padding: var(--space-4);
    min-height: calc(var(--touch) * 4);
    align-items: flex-start;
  }
  .crest {
    width: var(--space-8);
    height: var(--space-8);
    flex: none;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .featured .crest {
    width: calc(var(--space-8) * 2);
    height: calc(var(--space-8) * 2);
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    flex: 1;
  }
  .l1,
  .l2 {
    height: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .l1 {
    width: 50%;
  }
  .l2 {
    width: 75%;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* Only with movement on: appear after a short wait (no blink), then pulse. Under reduced
     motion this block does not apply and the skeleton is visible at once. Durations wait for the
     motion tokens (componentes.md, proposal 2). */
  @media (prefers-reduced-motion: no-preference) {
    .block {
      opacity: 0;
      animation:
        appear 0.01s linear 0.3s forwards,
        pulse 1.6s ease-in-out 0.3s infinite;
    }
  }
  @keyframes appear {
    to {
      opacity: 1;
    }
  }
  @keyframes pulse {
    50% {
      opacity: 0.6;
    }
  }
</style>
