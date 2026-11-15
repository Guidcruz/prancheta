import { matchKits, type KitClub, type MatchKits } from '@lib/generators/kit';

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
