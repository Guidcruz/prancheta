<script lang="ts" module>
  /**
   * Crest sizes, in px of width (the generator draws 64x72, so the height is 1.125x). No token yet:
   * componentes.md, "Propostas ao design system" (`size-crest-*`). At 32px or less the generator
   * switches to its simple version.
   */
  export const CREST_SIZES = { sm: 32, md: 48, lg: 64, xl: 96 } as const;
  export type CrestSize = keyof typeof CREST_SIZES;
</script>

<script lang="ts">
  import { shieldSpecFor, shieldSvg, type ShieldClub } from '@lib/generators/shield';

  /**
   * Crest (Escudo): the SVG of the shield generator (ADR-0014), never an image. Decorative by
   * default, because the club name is always written next to it; with `label` it is an image with
   * that accessible name.
   */
  interface Props {
    /** A ClubDef fits: only the crest fields are read. */
    club: ShieldClub;
    size?: CrestSize;
    /** Accessible name (the club's name, already chosen by the caller). Absent: decorative. */
    label?: string;
    /** The same club twice on one page needs distinct gradient ids (e.g. a list and a bar). */
    instance?: string;
  }
  const { club, size = 'md', label, instance }: Props = $props();

  const svg = $derived(
    shieldSvg(shieldSpecFor(club), CREST_SIZES[size], instance ? { instance } : {}),
  );
</script>

<span
  class="crest {size}"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG from our shield generator over the club data, never user input -->
  {@html svg}
</span>

<style>
  .crest {
    display: inline-flex;
    flex: none;
    line-height: 0;
  }
  .crest :global(svg) {
    display: block;
  }
</style>
