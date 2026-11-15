import { describe, expect, it, vi } from 'vitest';
import * as engine from '../../engine/index.ts';
import { MATCH_MODES, type MatchMode } from '../../engine/index.ts';
import { ErrorLog } from '../errors/index.ts';
import { SAVE_FIELD_NAMES } from '../save/index.ts';
import { store, useFreshDatabase } from '../save/testing/idb.ts';
import { SAMPLE_CAREER_ID } from '../save/testing/sample.ts';
import { CareerService } from './service.ts';

/*
 * The CareerService always tells the engine how the coach's club is commanded
 * (docs/02-architecture.md, 4.1, "Decisão do `architect` sobre `coaches`", revised for T-032):
 * `coaches[clubId]` in `prepareRound`, `liveMatch` and `playRound`. Until T-033 the screen has no
 * commands, so the mode goes through `engineMatchMode`, which sends `'result'` for every mode (CEO
 * decision 2 of docs/design/telas/partida.md): the assistant plays rules 1 to 6 for the coach's
 * club also when he watches. Without it, with `'full'` or `'highlights'` the engine would play the
 * club with no commands, only the injury substitution, and with no warning.
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

const PAIRS = MATCH_MODES.flatMap((saved) =>
  [undefined, ...MATCH_MODES].map(
    (chosen) => [saved, chosen] as [MatchMode, MatchMode | undefined],
  ),
);

describe("coaches: the engine gets 'result' for the coach's club in every mode (T-032)", () => {
  it.each(PAIRS)(
    'save in %s, input %s: prepareRound, liveMatch and playRound send coaches[clubId] = result',
    async (matchMode, chosen) => {
      const careers = service();
      const created = await careers.create({
        coachName: 'Zeca',
        clubId: 'flamingo',
        realism: 'full',
        matchMode,
      });
      expect(created.ok).toBe(true);
      const input = chosen === undefined ? {} : { matchMode: chosen };
      const prepare = vi.mocked(engine.prepareRound);
      const play = vi.mocked(engine.playRound);
      prepare.mockClear();
      play.mockClear();

      expect(careers.prepareRound(input)?.ok).toBe(true);
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(prepare.mock.calls[0]![2]).toMatchObject({ coaches: { flamingo: 'result' } });

      prepare.mockClear();
      expect(careers.liveMatch(input).ok).toBe(true);
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(prepare.mock.calls[0]![2]).toMatchObject({ coaches: { flamingo: 'result' } });

      const played = await careers.playRound(input);
      expect(played.ok).toBe(true);
      expect(play).toHaveBeenCalledTimes(1);
      const sent = play.mock.calls[0]![2];
      expect(sent.coaches).toEqual({ flamingo: 'result' });
      expect(sent.round).toBe(1);
    },
  );
});
