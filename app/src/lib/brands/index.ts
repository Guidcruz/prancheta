import brandList from '../../data/brands.json';

/*
 * The one point that picks a fictional brand for a space of the scenery (ADR-0015, item 3 and the
 * "Contrato do ponto único"; the list is the lot approved by the CEO on 2026-11-24, in
 * docs/content/lotes/2026-11-24-marcas-ficticias.md). Not advertising: no label, no link, no
 * count. Pure and deterministic: no network, no clock, nothing of the player.
 */

export type SlotId = 'pitch-boards' | 'scoreboard' | 'round-summary' | 'loading' | 'shirt';

export interface SlotContext {
  round: number;
  clubId: string;
  stadiumId: string;
  /** Which board of the space (the nth of a row): the same space can show several brands. */
  index?: number;
}

export interface FictionalBrand {
  readonly id: string;
  readonly name: string;
  /** Background, then the mark (the stripe of a board). Data of the brand, equal in both themes. */
  readonly colors: readonly [string, string];
}

/** The lot of fictional brands (22). */
export const FICTIONAL_BRANDS: readonly FictionalBrand[] = brandList as unknown as FictionalBrand[];

/** FNV-1a over the text, to a 32-bit integer (stable on every device). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function brandForSlot(
  slot: SlotId,
  ctx: SlotContext,
  brands: readonly FictionalBrand[] = FICTIONAL_BRANDS,
): FictionalBrand {
  const key = `${slot}|${ctx.round}|${ctx.clubId}|${ctx.stadiumId}|${ctx.index ?? 0}`;
  return brands[hash(key) % brands.length]!;
}
