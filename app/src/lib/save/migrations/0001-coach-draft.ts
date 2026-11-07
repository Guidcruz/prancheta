import type { Migration } from './index.ts';

/*
 * v1 → v2: the coach's sheet being edited, `career.draft` (ADR-0021, item 4; T-075).
 *
 * A v1 save has no sheet: the screen shows the engine's suggestion, which before T-029 is the
 * sheet the coach's club always played, so the step does not build one from `lastSheets`. No v1
 * build writes `career.draft`, so a v1 save with it is an edited file: the step drops it (the
 * import accepts only what the game could have made; ADR-0006, note of 2026-11-06). Nothing else
 * changes: the match sheets stay the same, so the migrated save, written without `base`, rewrites
 * their rows with the same content and the older snapshots keep them (docs/02-architecture.md,
 * 4.2, "Gravação sem `base` numa carreira que já existe"). `migrateSave` sets `schemaVersion: 2`.
 *
 * Built with spread and `Object.fromEntries` only (migrations/index.ts): the save is untrusted
 * until the strict schema after the chain.
 */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const coachDraft: Migration = {
  from: 1,
  migrate(save) {
    const career = save.career;
    if (!isObject(career) || !Object.hasOwn(career, 'draft')) return { ...save };
    return {
      ...save,
      career: Object.fromEntries(Object.entries(career).filter(([key]) => key !== 'draft')),
    };
  },
};
