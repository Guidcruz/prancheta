import { describe, expect, it } from 'vitest';
import { SAVE_FIELD_NAMES } from './fields.ts';
import { SAMPLE_CAREER_ID } from './testing/sample.ts';
import { base } from './testing/idb.ts';

describe('the field names of the save format', () => {
  it('has the fields of the envelope, the career and the state', () => {
    for (const name of [
      'careerId',
      'career',
      'coachName',
      'matchSheets',
      'game',
      'clubs',
      'def',
      'squads',
      'players',
      'fixtures',
      'vars',
    ]) {
      expect(SAVE_FIELD_NAMES.has(name), name).toBe(true);
    }
  });

  it('never has a record key: club, player or match ids', () => {
    const ids = [
      ...Object.keys(base.game.clubs),
      ...Object.keys(base.game.players).slice(0, 50),
      ...base.game.fixtures.slice(0, 20).map((f) => f.id),
      SAMPLE_CAREER_ID,
      base.career.coachName,
    ];
    for (const id of ids) expect(SAVE_FIELD_NAMES.has(id), id).toBe(false);
  });
});
