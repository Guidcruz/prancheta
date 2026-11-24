import { matchKits, shirtSvg, type Kit, type KitClub, type MatchKits } from '@lib/generators/kit';

/*
 * The colours of the discs of the 2D pitch (docs/design/telas/partida.md, "Bolinhas sem depender
 * da cor"; docs/art/uniformes.md, 3.1): the kits of the match from the generator of T-026, called
 * once when the match opens, without the `pitch` option. The disc is the `fill` of its kit, one
 * colour only; the visitor (and its keeper) carries the `mark` in the centre, the home side is
 * plain. The ring and the ball are the theme's `ink` (read by the MatchPitch): `FieldKit.ring`,
 * `numberColor` and `stripe` are never read here. The screen never picks a kit colour.
 */

/** One kit as the pitch draws it: the disc and, on the visitor only, the mark. */
export interface PitchKit {
  readonly fill: string;
  readonly mark?: string;
}

export interface PitchKits {
  readonly home: PitchKit;
  readonly away: PitchKit;
  readonly homeGk: PitchKit;
  readonly awayGk: PitchKit;
}

/** The pitch's colours from the four kits of the generator (only `fill` and `mark` are read). */
export function pitchKitsOf(
  kits: Pick<MatchKits, 'home' | 'away' | 'homeGk' | 'awayGk'>,
): PitchKits {
  return {
    home: { fill: kits.home.fill },
    away: { fill: kits.away.fill, mark: kits.away.mark },
    homeGk: { fill: kits.homeGk.fill },
    awayGk: { fill: kits.awayGk.fill, mark: kits.awayGk.mark },
  };
}

/** The colours of the match of `home` against `away` (a `ClubDef` fits). */
export function pitchKits(home: KitClub, away: KitClub): PitchKits {
  return pitchKitsOf(matchKits(home, away));
}

/** The four kits of a match, by name. */
export type KitName = 'home' | 'away' | 'homeGk' | 'awayGk';

/** The kit of disc `disc` (0 to 10 the home side's, the keeper first; 11 to 21 the visitor's). */
export function kitNameOf(disc: number): KitName {
  if (disc === 0) return 'homeGk';
  if (disc < 11) return 'home';
  if (disc === 11) return 'awayGk';
  return 'away';
}

/**
 * What a tag shows of a kit: the kit (for its shirt) and the colours of its number. The number
 * always sits on a plate (partida-campo-v2.md, 16, item 12): `numberPlate`, or the `fill` of the
 * kit when it has none, so the 4.5:1 of `numberColor` against `fill` holds with any pattern.
 */
export interface PitchTagKit {
  readonly kit: Kit;
  readonly number: { readonly color: string; readonly plate: string | null; readonly fill: string };
}

export type PitchTagKits = Readonly<Record<KitName, PitchTagKit>>;

/** The size of the SVG of a shirt of a tag in px: it is shown at 34 or 26px. */
const TAG_SHIRT_SIZE = 32;

/** The kits of the tags of the match of `home` against `away`, made once when it opens. */
export function pitchTagKits(home: KitClub, away: KitClub): PitchTagKits {
  const m = matchKits(home, away);
  const of = (name: KitName): PitchTagKit => ({
    kit: m.kits[name],
    number: { color: m[name].numberColor, plate: m[name].numberPlate, fill: m[name].fill },
  });
  return { home: of('home'), away: of('away'), homeGk: of('homeGk'), awayGk: of('awayGk') };
}

/** The tag kit of disc `disc`. */
export const tagKitOf = (kits: PitchTagKits, disc: number): PitchTagKit => kits[kitNameOf(disc)];

/**
 * The SVG of the shirt of a tag; `instance` (the key of the tag) keeps the clip ids of two tags
 * of the same kit apart on the page.
 */
export const tagShirt = (kit: PitchTagKit, instance: string): string =>
  shirtSvg(kit.kit, TAG_SHIRT_SIZE, { instance });
