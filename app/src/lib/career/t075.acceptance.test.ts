import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { get } from 'svelte/store';
import {
  ENGINE_VERSION,
  draftFromSheet,
  suggestSheet,
  type DraftSheet,
} from '../../engine/index.ts';
import { ErrorLog } from '../errors/index.ts';
import { loadGameParams } from '../params.ts';
import { SAVE_FIELD_NAMES, SAVE_SCHEMA_VERSION } from '../save/index.ts';
import { store, useFreshDatabase } from '../save/testing/idb.ts';
import { SAMPLE_CAREER_ID } from '../save/testing/sample.ts';
import { CareerService } from './service.ts';

/*
 * QA gate of T-075 (coach sheet in the save, format v2; ADR-0021), cross-cutting criteria that no
 * single developer test pins down: the engine version is exactly 16, the schema is 2, the old
 * fixtures are untouched, and the edited sheet never leaks into the GameState (nor lastSheets).
 */

useFreshDatabase();

const params = loadGameParams();
const VERSIONS = { appVersion: '0.0.1', schemaVersion: 2, engineVersion: 16 };

function service(): CareerService {
  const s = store();
  return new CareerService({
    store: s,
    log: new ErrorLog(VERSIONS, s, { fields: SAVE_FIELD_NAMES }),
    appVersion: '0.0.1',
    now: () => new Date('2026-11-07T12:00:00.000Z'),
    newCareerId: () => SAMPLE_CAREER_ID,
    newSeed: () => 2026,
  });
}

describe('T-075 versions', () => {
  it('ENGINE_VERSION stays at 16 and the save schema is 2', () => {
    expect(ENGINE_VERSION).toBe(16);
    expect(SAVE_SCHEMA_VERSION).toBe(2);
  });

  it('the v1 fixtures are still v1, with no draft; the v2 one has a draft with free slots', () => {
    const dir = new URL('../save/__fixtures__/', import.meta.url);
    const v1 = JSON.parse(readFileSync(new URL('v1.json', dir), 'utf8'));
    const v2 = JSON.parse(readFileSync(new URL('v2.json', dir), 'utf8'));
    expect(v1.schemaVersion).toBe(1);
    expect(v1.career.draft).toBeUndefined();
    expect(v2.schemaVersion).toBe(2);
    expect(v2.career.draft.lineup.starters).toContain(null);
    expect(v2.career.draft.lineup.bench).toContain(null);
  });
});

describe('T-075 the sheet never enters the GameState', () => {
  it('setDraft and a reload leave game and lastSheets byte-equal; the draft lives in career only', async () => {
    const a = service();
    const created = await a.create({
      coachName: 'Zeca',
      clubId: 'flamingo',
      realism: 'full',
      matchMode: 'result',
    });
    expect(created.ok).toBe(true);
    const before = get(a.state).save!;
    const gameBefore = JSON.stringify(before.game);
    const sheet = suggestSheet(before.game, params, before.career.clubId, undefined, {
      controller: 'human',
    });
    const base = draftFromSheet(sheet);
    const listed = new Set([
      ...base.lineup.captains,
      ...base.lineup.penaltyTakers,
      ...base.lineup.freeKickTakers,
    ]);
    const free = base.lineup.starters.findIndex((id) => id !== null && !listed.has(id));
    const draft: DraftSheet = {
      lineup: {
        ...base.lineup,
        starters: base.lineup.starters.map((id, i) => (i === free ? null : id)),
      },
      tactic: { posture: 'defensive', pressure: 'low' },
    };
    expect((await a.setDraft(draft)).ok).toBe(true);
    const during = get(a.state).save!;
    expect(JSON.stringify(during.game)).toBe(gameBefore);
    expect(during.career.draft).toEqual(draft);

    const b = service();
    expect((await b.open(SAMPLE_CAREER_ID)).ok).toBe(true);
    const reopened = get(b.state).save!;
    expect(JSON.stringify(reopened.game)).toBe(gameBefore);
    expect(reopened.career.draft).toEqual(draft);
    // The engine's played sheet for the club is not the edited one.
    const played = reopened.game.lastSheets?.[reopened.career.clubId];
    expect(
      played === undefined || JSON.stringify(played).includes('"pressure":"low"') === false,
    ).toBe(true);
    expect(Object.keys(reopened.game)).not.toContain('draft');
  });
});
