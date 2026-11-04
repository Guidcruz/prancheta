/**
 * Node-only (node:crypto): finds which name combinations match the hashed blocklist of real
 * athletes and returns them as indices into the lists, with no text. Used by
 * scripts/name-exclusions.mjs (which writes app/src/content/names/br.exclusions.json) and by the
 * tests that keep that file in sync. Keep it to erasable syntax and relative ".ts" imports (Node
 * runs it directly).
 */
import { createHash } from 'node:crypto';
import type { NameExclusionsFile, NameLists } from '../lib/generators/names.ts';
import { normalizeName } from './blocklist.ts';

export interface ComputeOptions {
  /** The "First Surname Surname2" forms: |first| x |surnames|^2, about 74M hashes (2 to 4 min). */
  withTriples?: boolean;
}

/**
 * Every combination the generator can show (display or full name) that is on the blocklist.
 * Each entry is normalized once; the normalization of a join equals the join of the normalized
 * parts because entries have no edge spaces and no hyphens (`checkNameLists`).
 */
export function computeExclusions(
  lists: NameLists,
  hashes: ReadonlySet<string>,
  { withTriples = true }: ComputeOptions = {},
): NameExclusionsFile {
  const norm = (items: readonly string[]) => items.map(normalizeName);
  const given = norm(lists.given);
  const compound = norm(lists.givenCompound);
  const first = [...given, ...compound, ...norm(lists.short)];
  const family = norm(lists.family);
  const nicknames = norm(lists.nicknames);
  const origins = norm(lists.origins);
  const blocked = (text: string) =>
    hashes.has(createHash('sha256').update(text, 'utf8').digest('hex'));

  const out: NameExclusionsFile = {
    firstFamily: [],
    firstNickname: [],
    firstOrigin: [],
    nickname: [],
    family: [],
    triples: [],
  };
  nicknames.forEach((n, i) => blocked(n) && out.nickname.push(i));
  family.forEach((f, i) => blocked(f) && out.family.push(i));
  for (let a = 0; a < first.length; a++) {
    for (let f = 0; f < family.length; f++) {
      if (blocked(`${first[a]} ${family[f]}`)) out.firstFamily.push([a, f]);
    }
    for (let n = 0; n < nicknames.length; n++) {
      if (blocked(`${first[a]} ${nicknames[n]}`)) out.firstNickname.push([a, n]);
    }
    for (let o = 0; o < origins.length; o++) {
      if (blocked(`${first[a]} de ${origins[o]}`)) out.firstOrigin.push([a, o]);
    }
  }
  if (withTriples) {
    const full = given.length + compound.length;
    for (let a = 0; a < full; a++) {
      for (let f = 0; f < family.length; f++) {
        const prefix = `${first[a]} ${family[f]} `;
        for (let g = 0; g < family.length; g++) {
          if (g !== f && blocked(prefix + family[g])) out.triples.push([a, f, g]);
        }
      }
    }
  }
  return out;
}
