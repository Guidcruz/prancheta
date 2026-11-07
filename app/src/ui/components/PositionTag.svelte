<script lang="ts">
  import type { Sector } from './sectors';

  /**
   * PositionTag: the position code in a small box ("ATA"), its background and border painted by
   * the sector (design-system.md, "Cor de setor"; approved by the CEO on 2026-11-07). The code is
   * always written, in `ink` on `sector-*-soft` (≥ 4.5:1, checked by `npm run tokens`), so the
   * sector never depends on the colour. The screen picks the sector from `SECTOR_OF`
   * (`sectors.ts`); the tag never knows positions. Without `sector`, the neutral box (border in
   * `line`, code in `ink-muted`).
   */
  interface Props {
    /** "ATA", already translated (position.ST.short); at most 3 letters in every language. */
    code: string;
    /** `SECTOR_OF[player.position]`. */
    sector?: Sector;
    /**
     * Hidden from screen readers when the full position is written or read next to it
     * ("Atacante" in the row's hidden text, in the card's header): the code would be read twice.
     */
    hidden?: boolean;
  }
  const { code, sector, hidden = false }: Props = $props();
</script>

<span
  class="rotulo tag"
  class:sector-gk={sector === 'gk'}
  class:sector-def={sector === 'def'}
  class:sector-mid={sector === 'mid'}
  class:sector-atk={sector === 'atk'}
  aria-hidden={hidden ? 'true' : undefined}>{code}</span
>

<style>
  .tag {
    display: inline-block;
    flex: none;
    /* Room for 3 letters in every language (elenco.md, "Textos"). */
    min-inline-size: calc(var(--space-8) + var(--space-1));
    padding: calc(var(--space-1) / 2) var(--space-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    color: var(--ink-muted);
    text-align: center;
    white-space: nowrap;
  }
  /* The sector paints only the background and the border; the code stays in ink. */
  .sector-gk {
    border-color: var(--sector-gk);
    background: var(--sector-gk-soft);
    color: var(--ink);
  }
  .sector-def {
    border-color: var(--sector-def);
    background: var(--sector-def-soft);
    color: var(--ink);
  }
  .sector-mid {
    border-color: var(--sector-mid);
    background: var(--sector-mid-soft);
    color: var(--ink);
  }
  .sector-atk {
    border-color: var(--sector-atk);
    background: var(--sector-atk-soft);
    color: var(--ink);
  }
</style>
