<script lang="ts">
  import { FAN_MOODS, type FanMood } from '@engine';

  /**
   * FanThermometer (US-026): the fans' mood from 0 to 100 as a number and a mood word, both
   * plain text; the bar of five segments only reinforces them (`aria-hidden`), with the current
   * segment lit and a marker at the value. No animation: a new value just appears. The five
   * moods and their order are the engine's (`FAN_MOODS`, `fanMood`; 4.1, "Leituras para a
   * interface (T-028)"); the screen asks `fanMood` which band a value falls in.
   */
  interface Props {
    /** The thermometer, already rounded by the caller (0..100). */
    value: number;
    mood: FanMood;
    /** "Animada" (fans.mood.excited), already translated. */
    moodLabel: string;
    /** "de 100" (fans.scale), written after the number. */
    scaleLabel: string;
    /** One sentence on what the mood changes (club.fans.hint). */
    hint?: string;
  }
  const { value, mood, moodLabel, scaleLabel, hint }: Props = $props();
  const id = $props.id();
  const at = $derived(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)));
  const current = $derived(FAN_MOODS.indexOf(mood));
</script>

<div class="thermo mood-{mood}">
  <p class="reading" aria-describedby={hint ? `${id}-hint` : undefined}>
    <span class="titulo number">{at}</span>
    <span class="caption scale">{scaleLabel}</span>
    <span class="subtitulo label">{moodLabel}</span>
  </p>
  <div class="bar" aria-hidden="true">
    {#each FAN_MOODS as band, i (band)}
      <span class="segment {band}" class:lit={i === current}></span>
    {/each}
    <span class="marker" style:inset-inline-start="{at}%"></span>
  </div>
  {#if hint}<p class="caption hint" id="{id}-hint">{hint}</p>{/if}
</div>

<style>
  .thermo {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  p {
    margin: 0;
  }
  .reading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: var(--space-2);
  }
  .number {
    font-variant-numeric: tabular-nums;
  }
  .scale {
    color: var(--ink-muted);
  }
  /* The mood word wraps under the number when es or en is long. */
  .label {
    margin-inline-start: var(--space-2);
  }
  .bar {
    position: relative;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-1);
    block-size: var(--size-bar-lg);
    margin-block: var(--space-1);
  }
  .segment {
    border-radius: var(--radius-pill);
    background: var(--surface-2);
  }
  /* The lit segment takes the mood's tone; the word above says the same thing in text. */
  .segment.lit.revolt,
  .segment.lit.irritated {
    background: var(--danger);
  }
  .segment.lit.wary {
    background: var(--draw);
  }
  .segment.lit.excited {
    background: var(--grass);
  }
  .segment.lit.party {
    background: var(--floodlight);
  }
  /* The value: a post across the bar, in ink, so its place reads in both themes. */
  .marker {
    position: absolute;
    inset-block: calc(var(--space-1) * -1);
    inline-size: var(--space-1);
    margin-inline-start: calc(var(--space-1) / -2);
    border-radius: var(--radius-pill);
    background: var(--ink);
  }
  .hint {
    color: var(--ink-muted);
  }
</style>
