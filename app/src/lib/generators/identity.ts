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
import { encodeFace, faceSpecFromSeed } from './face.ts';

/*
 * The identity source of the game (ADR-0012): names and faces of new players, resolved once at
 * creation and stored in `Player.name` and `Player.face`. The engine receives it as an argument
 * (`newGame`, later `startNextSeason`); it never imports this file nor the name lists.
 *
 * Names: `namesForSquad` with app/src/content/names/br.json and br.exclusions.json, with the
 * squad rules applied against `existing` too. Etapa 1 has only Brazilian lists, so players of the
 * other South American countries get names from the same lists for now (see NameLists).
 *
 * Faces (T-027, ADR-0012 note of 2026-11-06): `faceSeed` comes from a stream of its own
 * (`${seed}-faces`), so changing the name lists never moves a face, and the face is drawn once,
 * here, with the age the engine has just drawn (`ages`) and the nationality of the request:
 * `encodeFace(faceSpecFromSeed(faceSeed, { age, nationality }))`. This is the only caller of
 * `faceSpecFromSeed`; a face that exists is never drawn again (`renameRetired`, T-044, changes
 * only the name and keeps `face` and `faceSeed`).
 */

/**
 * Revision of content/names/retired.json already reflected in new names. The file and
 * `renameRetired` are T-044; until then nothing is retired, so the revision is 0.
 */
export const RETIRED_NAMES_REV = 0;

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
    squad({ seed, nationality, count, ages, existing }): PlayerIdentity[] {
      // One age per identity is the contract with the engine; a mismatch is a programming error.
      if (ages.length !== count) {
        throw new Error(`IdentitySource got ${ages.length} ages, expected ${count}`);
      }
      const names = namesForSquad(seed, count, lists, exclusions, existing);
      // Faces come from a stream of their own, so changing the name lists never moves a face.
      const faces = new Rng(seedFromString(`${seed >>> 0}-faces`));
      return names.map((name, k) => {
        const faceSeed = faces.int(0, 0xffffffff);
        const spec = faceSpecFromSeed(faceSeed, { age: ages[k]!, nationality });
        return {
          display: name.display,
          full: name.full,
          family: name.family,
          nameSeed: name.nameSeed,
          faceSeed,
          face: encodeFace(spec),
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
