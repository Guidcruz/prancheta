import clubsData from '../../../data/clubs.serie-a.json';
import {
  matchSheet,
  newGame,
  playRound,
  roundRecap,
  type ClubDef,
  type FixtureId,
  type GameState,
  type MatchSheet,
  type RoundRecap,
} from '../../../engine/index.ts';
import { gameIdentitySource } from '../../generators/identity.ts';
import { loadGameParams } from '../../params.ts';
import { SAVE_SCHEMA_VERSION, type CareerSave, type NewsRef } from '../schema.ts';

/*
 * A career save made the way the game will make it (T-023 owns the real `CareerService`): the 20
 * clubs of the Série A, the game's identity source (real generated names, ADR-0012), the bundled
 * parameters and `rounds` rounds played, with the lean report of the last one and the sheets of
 * every match played this season (ADR-0019). For the save tests and the write measurement of the
 * end-of-season snapshot (scripts/measure-save/); never imported by the game.
 *
 * News and social posts are synthetic references (the templates come with the content tasks):
 * 4 of each per round, as an estimate of what the career keeps.
 */

export const SAMPLE_CAREER_ID = '00000000-0000-4000-8000-000000000018';
const SAMPLE_CLOCK = '2026-11-06T12:00:00.000Z';

export interface SampleOptions {
  readonly seed?: number;
  /** Rounds played, 0..38. */
  readonly rounds?: number;
  readonly careerId?: string;
  /** Index of the coach's club in the data (0..19). */
  readonly club?: number;
}

function refs(kind: string, round: number): NewsRef[] {
  return [0, 1, 2, 3].map((i) => ({
    factId: `r${round}-${kind}-${i}`,
    templateId: `${kind}-template-${(round + i) % 17}`,
    variantId: `${kind}-variant-${(round * 7 + i) % 23}`,
    vars: { round, club: 'club', score: '2x1' },
  }));
}

export function sampleCareerSave(options: SampleOptions = {}): CareerSave {
  const { seed = 2026, rounds = 38, careerId = SAMPLE_CAREER_ID, club = 0 } = options;
  const clubs = clubsData as unknown as ClubDef[];
  const params = loadGameParams();
  const created = newGame(
    { seed, year: 2026, realism: 'full' },
    clubs,
    params,
    gameIdentitySource(),
  );
  if (!created.ok) throw new Error(`newGame: ${created.error}`);
  let state: GameState = created.value;
  const clubId = clubs[club]!.id;
  const matchSheets: Record<FixtureId, MatchSheet> = {};
  const news: NewsRef[] = [];
  const social: NewsRef[] = [];
  let lastRound: RoundRecap | undefined;
  for (let round = 1; round <= rounds; round++) {
    const played = playRound(state, params, {
      round,
      sheets: {},
      commands: {},
      fanDecisions: {},
      coaches: { [clubId]: 'result' },
    });
    if (!played.ok) throw new Error(`playRound ${round}: ${played.error}`);
    state = played.value.state;
    lastRound = roundRecap(played.value.report);
    for (const result of played.value.report.results) {
      matchSheets[result.fixtureId] = matchSheet(result);
    }
    news.push(...refs('news', round));
    social.push(...refs('social', round));
  }
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    careerId,
    createdAt: SAMPLE_CLOCK,
    updatedAt: SAMPLE_CLOCK,
    appVersion: '0.0.1',
    engineVersion: state.engineVersion,
    paramsHash: 'sample',
    career: {
      coachName: 'Treinador',
      clubId,
      matchMode: 'result',
      news,
      social,
      phraseMemory: Array.from({ length: 200 }, (_, i) => `variant-${i}`),
      pendingFanDecision: 0,
      exportReminder: true,
      baseSeason: 2026,
      ...(lastRound === undefined ? {} : { lastRound }),
      matchSheets,
    },
    game: state,
  };
}
