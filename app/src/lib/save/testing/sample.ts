import {
  endSeason,
  matchSheet,
  playRound,
  roundRecap,
  startNextSeason,
  type Fixture,
  type FixtureId,
  type GameState,
  type MatchSheet,
  type RoundRecap,
} from '../../../engine/index.ts';
import { gameIdentitySource } from '../../generators/identity.ts';
import { loadGameParams } from '../../params.ts';
import { newCareerGame } from '../new-career.ts';
import { SAVE_SCHEMA_VERSION, type CareerSave, type NewsRef } from '../schema.ts';

/*
 * A career save made the way the game will make it (T-023 owns the real `CareerService`): the 20
 * clubs of the latest set of club data (its base season is the year of season 1, US-066), the
 * game's identity source (real generated names, ADR-0012), the bundled parameters and `rounds`
 * rounds played, with the lean report of the last one and the sheets of every match played this
 * season (ADR-0019). With `season: 2` the whole first season is played and closed first
 * (`pastSeasons`, the season turn). For the save tests, the v1 fixture and the write measurement
 * of the end-of-season snapshot (scripts/measure-save/); never imported by the game.
 *
 * News and social posts are synthetic references (the templates come with the content tasks):
 * 4 of each per round, as an estimate of what the career keeps.
 */

export const SAMPLE_CAREER_ID = '00000000-0000-4000-8000-000000000018';

/**
 * A UUID v4 for a test label: the tests name their careers ("a", "healthy"), and the save's
 * `careerId` is a UUID (validate.ts). Two FNV-1a hashes of the label make the last 12 digits.
 */
export function careerIdOf(label: string): string {
  const fnv = (basis: number) => {
    let h = basis;
    for (const byte of new TextEncoder().encode(label)) h = Math.imul(h ^ byte, 0x01000193) >>> 0;
    return h;
  };
  const tail = (fnv(0x811c9dc5).toString(16).padStart(8, '0') + fnv(0x050c5d1f).toString(16))
    .padEnd(12, '0')
    .slice(0, 12);
  return `00000000-0000-4000-8000-${tail}`;
}
const SAMPLE_CLOCK = '2026-11-06T12:00:00.000Z';
/** A SHA-256 in the form of `paramsHash` (the real one is of the canonical params JSON). */
export const SAMPLE_PARAMS_HASH = 'f'.repeat(64);

export interface SampleOptions {
  readonly seed?: number;
  /** Rounds played in the current season, 0..38. */
  readonly rounds?: number;
  readonly careerId?: string;
  /** Index of the coach's club in the data (0..19). */
  readonly club?: number;
  /** 2: the first season played whole and turned, then `rounds` rounds of the second. */
  readonly season?: 1 | 2;
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
  const { seed = 2026, rounds = 38, careerId = SAMPLE_CAREER_ID, club = 0, season = 1 } = options;
  const params = loadGameParams();
  const identities = gameIdentitySource();
  const created = newCareerGame({ seed, realism: 'full' }, params, identities);
  if (!created.ok) throw new Error(`newCareerGame: ${created.error}`);
  const { baseSeason } = created.value;
  let state: GameState = created.value.game;
  const clubId = Object.keys(state.clubs)[club]!;
  let matchSheets: Record<FixtureId, MatchSheet> = {};
  const news: NewsRef[] = [];
  const social: NewsRef[] = [];
  let lastRound: RoundRecap | undefined;
  const play = (count: number) => {
    for (let round = 1; round <= count; round++) {
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
      const at = (state.season - 1) * 38 + round;
      news.push(...refs('news', at));
      social.push(...refs('social', at));
    }
  };
  if (season === 2) {
    play(38);
    const ended = endSeason(state, params, [clubId], identities);
    if (!ended.ok) throw new Error(`endSeason: ${ended.error}`);
    const next = startNextSeason(ended.value.state, params, identities);
    if (!next.ok) throw new Error(`startNextSeason: ${next.error}`);
    // The CareerService clears the sheets and the recap at the turn (ADR-0019).
    state = next.value;
    matchSheets = {};
    lastRound = undefined;
  }
  play(rounds);
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    careerId,
    createdAt: SAMPLE_CLOCK,
    updatedAt: SAMPLE_CLOCK,
    appVersion: '0.0.1',
    engineVersion: state.engineVersion,
    paramsHash: SAMPLE_PARAMS_HASH,
    career: {
      coachName: 'Treinador',
      clubId,
      matchMode: 'result',
      news,
      social,
      phraseMemory: Array.from({ length: 200 }, (_, i) => `variant-${i}`),
      pendingFanDecision: 0,
      exportReminder: true,
      baseSeason,
      ...(lastRound === undefined ? {} : { lastRound }),
      matchSheets,
    },
    game: state,
  };
}

/** One save of {@link playedCareer}: after a round, or at the end of the season. */
export interface CareerPoint {
  /** `s1-r10`, `s1-end`, `s2-r1`. */
  readonly label: string;
  readonly save: CareerSave;
}

/**
 * A career played round by round the way the game plays it (the same steps as
 * {@link sampleCareerSave}), with any realism: season 1 whole, its end, the season turn and
 * `secondSeasonRounds` rounds of season 2. Yields the save where `at` says, after the round
 * (with that round's recap and every sheet of the season so far) or at the end of the season.
 * For the property test of the engine's output in the strict schema.
 */
export function* playedCareer(
  options: {
    readonly seed: number;
    readonly realism: 'full' | 'simplified';
    readonly club?: number;
    readonly secondSeasonRounds?: number;
  },
  at: (season: number, round: number | 'end') => boolean,
): Generator<CareerPoint> {
  const { seed, realism, club = 0, secondSeasonRounds = 1 } = options;
  const params = loadGameParams();
  const identities = gameIdentitySource();
  const created = newCareerGame({ seed, realism }, params, identities);
  if (!created.ok) throw new Error(`newCareerGame: ${created.error}`);
  const { baseSeason } = created.value;
  let state: GameState = created.value.game;
  const clubId = Object.keys(state.clubs)[club]!;
  let matchSheets: Record<FixtureId, MatchSheet> = {};
  const news: NewsRef[] = [];
  const social: NewsRef[] = [];
  let lastRound: RoundRecap | undefined;
  const saveOf = (): CareerSave => ({
    schemaVersion: SAVE_SCHEMA_VERSION,
    careerId: careerIdOf(`played-${seed}-${realism}`),
    createdAt: SAMPLE_CLOCK,
    updatedAt: SAMPLE_CLOCK,
    appVersion: '0.0.1',
    engineVersion: state.engineVersion,
    paramsHash: SAMPLE_PARAMS_HASH,
    career: {
      coachName: 'Treinador',
      clubId,
      matchMode: 'result',
      news: [...news],
      social: [...social],
      phraseMemory: Array.from({ length: 200 }, (_, i) => `variant-${i}`),
      pendingFanDecision: 0,
      exportReminder: true,
      baseSeason,
      ...(lastRound === undefined ? {} : { lastRound }),
      matchSheets: { ...matchSheets },
    },
    game: state,
  });
  function* play(count: number): Generator<CareerPoint> {
    for (let round = 1; round <= count; round++) {
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
      const n = (state.season - 1) * 38 + round;
      news.push(...refs('news', n));
      social.push(...refs('social', n));
      if (at(state.season, round)) yield { label: `s${state.season}-r${round}`, save: saveOf() };
    }
  }
  yield* play(38);
  const ended = endSeason(state, params, [clubId], identities);
  if (!ended.ok) throw new Error(`endSeason: ${ended.error}`);
  state = ended.value.state;
  if (at(1, 'end')) yield { label: 's1-end', save: saveOf() };
  const next = startNextSeason(state, params, identities);
  if (!next.ok) throw new Error(`startNextSeason: ${next.error}`);
  // The CareerService clears the sheets and the recap at the turn (ADR-0019).
  state = next.value;
  matchSheets = {};
  lastRound = undefined;
  yield* play(secondSeasonRounds);
}

function withoutResult(fixture: Fixture): Fixture {
  return Object.fromEntries(Object.entries(fixture).filter(([key]) => key !== 'result')) as Fixture;
}

/**
 * A season save as it was after `played` rounds: results and sheets of the later rounds removed,
 * `game.round = played + 1`. The rest of the state stays the one of `save`, which the store does
 * not read. `inSeason` relabels it as another season (for the season turn), with its year.
 */
export function sampleAtRound(
  save: CareerSave,
  played: number,
  inSeason = save.game.season,
  careerId = save.careerId,
): CareerSave {
  const fixtures = save.game.fixtures.map((f) => (f.round <= played ? f : withoutResult(f)));
  const kept = new Set(fixtures.filter((f) => f.round <= played).map((f) => f.id));
  const matchSheets = Object.fromEntries(
    Object.entries(save.career.matchSheets).filter(([id]) => kept.has(id)),
  );
  const hour = String(10 + inSeason).padStart(2, '0');
  return {
    ...save,
    careerId,
    updatedAt: `2026-11-06T${hour}:${String(played).padStart(2, '0')}:00.000Z`,
    career: { ...save.career, matchSheets },
    game: {
      ...save.game,
      season: inSeason,
      year: save.game.year + inSeason - save.game.season,
      round: played + 1,
      fixtures,
    },
  };
}
