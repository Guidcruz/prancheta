import { describe, expect, it, vi } from 'vitest';
import * as engine from '../../engine/index.ts';
import { MATCH_MODES, type MatchMode } from '../../engine/index.ts';
import { ErrorLog } from '../errors/index.ts';
import { SAVE_FIELD_NAMES } from '../save/index.ts';
import { store, useFreshDatabase } from '../save/testing/idb.ts';
import { SAMPLE_CAREER_ID } from '../save/testing/sample.ts';
import { CareerService } from './service.ts';

/*
 * The CareerService always tells the engine how the coach follows the match (docs/02-architecture.md,
 * 4.1, "Decisão do `architect` sobre `coaches`"; T-030): `coaches[clubId]` with the save's
 * `matchMode`, in `prepareRound` and in `playRound`. Without it, the engine would play the human
 * club as `'full'` with no commands, only the injury substitution, and with no warning.
 */

vi.mock('../../engine/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../engine/index.ts')>();
  return {
    ...actual,
    playRound: vi.fn(actual.playRound),
    prepareRound: vi.fn(actual.prepareRound),
  };
});

useFreshDatabase();

const VERSIONS = { appVersion: '0.0.1', schemaVersion: 3, engineVersion: 1 };

function service(): CareerService {
  const s = store();
  return new CareerService({
    store: s,
    log: new ErrorLog(VERSIONS, s, { fields: SAVE_FIELD_NAMES }),
    appVersion: '0.0.1',
    now: () => new Date('2026-11-14T12:00:00.000Z'),
    newCareerId: () => SAMPLE_CAREER_ID,
    newSeed: () => 2026,
  });
}

describe('coaches: the save’s match mode reaches the engine (T-030)', () => {
  it.each(MATCH_MODES.map((mode) => [mode] as [MatchMode]))(
    'matchMode %s: prepareRound and playRound get coaches[clubId] = the mode',
    async (matchMode) => {
      const careers = service();
      const created = await careers.create({
        coachName: 'Zeca',
        clubId: 'flamingo',
        realism: 'full',
        matchMode,
      });
      expect(created.ok).toBe(true);
      const prepare = vi.mocked(engine.prepareRound);
      const play = vi.mocked(engine.playRound);
      prepare.mockClear();
      play.mockClear();

      expect(careers.prepareRound()?.ok).toBe(true);
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(prepare.mock.calls[0]![2]).toMatchObject({ coaches: { flamingo: matchMode } });

      const played = await careers.playRound();
      expect(played.ok).toBe(true);
      expect(play).toHaveBeenCalledTimes(1);
      const input = play.mock.calls[0]![2];
      expect(input.coaches).toEqual({ flamingo: matchMode });
      expect(input.round).toBe(1);
    },
  );
});
