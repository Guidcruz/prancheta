/**
 * Fixed identity source of the engine tests and goldens (ADR-0012, decision 2). It knows no name
 * list, so changing app/src/content/names/ never moves a golden nor ENGINE_VERSION.
 *
 * Names are obviously synthetic ("Jogador Teste7", shown as "Teste7"), never a real person.
 * Deterministic: the seeds come from `req.seed`, and the numbering continues after `existing`,
 * skipping any display already in the squad, so a name or surname of the squad never repeats.
 * `req.ages` (T-027) is accepted and ignored: the fake face does not depend on the age.
 *
 * Test-only code: never imported by `index.ts`.
 */
import type { IdentitySource, PlayerIdentity, PlayerNameText } from '../players.ts';
import { Rng } from '../rng.ts';

export const TEST_RETIRED_REV = 0;

export function fixedIdentitySource(): IdentitySource {
  return {
    retiredRev: TEST_RETIRED_REV,
    squad({ seed, nationality, count, existing }): PlayerIdentity[] {
      const rng = new Rng(seed);
      const taken = new Set(existing.map((name: PlayerNameText) => name.display));
      const result: PlayerIdentity[] = [];
      let n = existing.length;
      for (let i = 0; i < count; i++) {
        do n++;
        while (taken.has(`Teste${n}`));
        taken.add(`Teste${n}`);
        const nameSeed = rng.int(0, 0xffffffff);
        const faceSeed = rng.int(0, 0xffffffff);
        result.push({
          display: `Teste${n}`,
          full: `Jogador Teste${n}`,
          family: `Teste${n}`,
          nameSeed,
          faceSeed,
          face: `t-${nationality.toLowerCase()}-${faceSeed.toString(36)}`,
        });
      }
      return result;
    },
  };
}
