import {
  Rng,
  seedFromString,
  type IdentitySource,
  type PlayerIdentity,
} from '../../engine/index.ts';
import brExclusions from '../../content/names/br.exclusions.json';
import brLists from '../../content/names/br.json';
import {
  compileExclusions,
  namesForSquad,
  type NameExclusions,
  type NameExclusionsFile,
  type NameLists,
} from './names.ts';

/*
 * The identity source of the game (ADR-0012): names and faces of new players, resolved once at
 * creation and stored in `Player.name` and `Player.face`. The engine receives it as an argument
 * (`newGame`, later `startNextSeason`); it never imports this file nor the name lists.
 *
 * Names: `namesForSquad` with app/src/content/names/br.json and br.exclusions.json, with the
 * squad rules applied against `existing` too. Etapa 1 has only Brazilian lists, so players of the
 * other South American countries get names from the same lists for now (see NameLists).
 *
 * Faces: the encoding of `FaceSpec` is T-027. Until then `face` is a deterministic placeholder,
 * `p0-<faceSeed in base 36>` (at most 10 characters, under FACE_MAX_LENGTH), and `faceSeed`
 * is drawn here so that T-027 can derive the real spec from it.
 */

/**
 * Revision of content/names/retired.json already reflected in new names. The file and
 * `renameRetired` are T-044; until then nothing is retired, so the revision is 0.
 */
export const RETIRED_NAMES_REV = 0;

/** Prefix of the placeholder face (T-027 replaces it with the encoded FaceSpec). */
export const PLACEHOLDER_FACE_PREFIX = 'p0-';

export function placeholderFace(faceSeed: number): string {
  return `${PLACEHOLDER_FACE_PREFIX}${(faceSeed >>> 0).toString(36)}`;
}

/**
 * Builds an identity source over some name lists (the game uses {@link gameIdentitySource};
 * tests pass other lists, such as a reordered copy). Pure: the same request always gives the
 * same identities.
 */
export function createIdentitySource(
  lists: NameLists,
  exclusions?: NameExclusions,
  retiredRev = RETIRED_NAMES_REV,
): IdentitySource {
  return {
    retiredRev,
    squad({ seed, count, existing }): PlayerIdentity[] {
      const names = namesForSquad(seed, count, lists, exclusions, existing);
      // Faces come from a stream of their own, so changing the name lists never moves a face.
      const faces = new Rng(seedFromString(`${seed >>> 0}-faces`));
      return names.map((name) => {
        const faceSeed = faces.int(0, 0xffffffff);
        return {
          display: name.display,
          full: name.full,
          family: name.family,
          nameSeed: name.nameSeed,
          faceSeed,
          face: placeholderFace(faceSeed),
        };
      });
    },
  };
}

let cached: IdentitySource | undefined;

/** The identity source of this build: Brazilian lists and their exclusions. */
export function gameIdentitySource(): IdentitySource {
  cached ??= createIdentitySource(
    brLists as NameLists,
    compileExclusions(brExclusions as unknown as NameExclusionsFile),
  );
  return cached;
}
