<script lang="ts" module>
  /**
   * Avatar sizes, in px: the `size-medallion-*` tokens (design-system.md, "Tamanhos"), the same
   * scale as CREST_SIZES. The generator takes the width as a number, so the values are repeated
   * here until the token script also exports them as TypeScript constants. At 32px or less the
   * generator draws the simple version.
   */
  export const AVATAR_SIZES = { sm: 32, md: 48, lg: 64, xl: 96 } as const;
  export type AvatarSize = keyof typeof AVATAR_SIZES;
</script>

<script lang="ts">
  import { renderFace } from '@lib/generators/avatar';

  /**
   * Avatar: the player's face from the avatar generator (T-027, docs/art/avatares.md), never a
   * photo. A medallion (the generator draws the circle). Decorative by default, because the name
   * is always written next to it; with `label` it is an image with that accessible name.
   */
  interface Props {
    /** `Player.face` (encoded FaceSpec); anything invalid is drawn as the neutral face. */
    face: string;
    size?: AvatarSize;
    /** Club colour for the shirt (`#rrggbb`, the club's first colour); else the neutral shirt. */
    shirt?: string;
    /** Accessible name (the player's name). Absent: decorative. */
    label?: string;
  }
  const { face, size = 'md', shirt, label }: Props = $props();

  const svg = $derived(
    renderFace(face, AVATAR_SIZES[size], {
      ...(shirt !== undefined ? { shirt } : {}),
      ...(label !== undefined ? { label } : {}),
    }),
  );
</script>

<span class="avatar {size}">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG from our avatar generator over the save data, escaped there, never raw input -->
  {@html svg}
</span>

<style>
  .avatar {
    display: inline-flex;
    flex: none;
    line-height: 0;
    border-radius: var(--radius-pill);
  }
  .avatar :global(svg) {
    display: block;
  }
</style>
