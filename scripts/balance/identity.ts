import { Rng } from '../../app/src/engine/index.ts';
import type { IdentitySource, PlayerIdentity } from '../../app/src/engine/index.ts';

/*
 * Identity source of the /balance (ADR-0012): the metrics never read a name, so the players get
 * obviously synthetic ones ("Jogador Balance7"), never a real person, and the report does not move
 * when the name lists of app/src/content/names/ change. Deterministic: the seeds come from
 * `req.seed`, and the numbering continues after `existing`, as the engine tests' source does.
 */
export function balanceIdentitySource(): IdentitySource {
  return {
    retiredRev: 0,
    squad({ seed, nationality, count, existing }): PlayerIdentity[] {
      const rng = new Rng(seed);
      const taken = new Set(existing.map((name) => name.display));
      const result: PlayerIdentity[] = [];
      let n = existing.length;
      for (let i = 0; i < count; i++) {
        do n++;
        while (taken.has(`Balance${n}`));
        taken.add(`Balance${n}`);
        const nameSeed = rng.int(0, 0xffffffff);
        const faceSeed = rng.int(0, 0xffffffff);
        result.push({
          display: `Balance${n}`,
          full: `Jogador Balance${n}`,
          family: `Balance${n}`,
          nameSeed,
          faceSeed,
          face: `b-${nationality.toLowerCase()}-${faceSeed.toString(36)}`,
        });
      }
      return result;
    },
  };
}
