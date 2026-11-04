import type { GameRules } from '../game.ts';
import type { TeamSheet } from '../lineup.ts';
import type { Player } from '../players.ts';
import type {
  AiProfile,
  ClubId,
  EngineWarning,
  FixtureId,
  Formation,
  PlayerId,
  Posture,
  Pressure,
  Side,
} from '../types.ts';

/*
 * Match contracts (docs/02-architecture.md, 4.1 "Partida"; docs/design/partida.md, "Eventos" and
 * "Estatísticas e notas"). `MatchCommand` arrives with the coach's commands (T-012).
 */

/** One side of a match, as `prepareRound` builds it. */
export interface TeamInput {
  readonly clubId: ClubId;
  readonly sheet: TeamSheet;
  readonly controller: 'ai' | 'human';
  readonly profile: AiProfile;
  /** Fans thermometer of the club, 0..100. */
  readonly fans: number;
  /** The club's squad at kick-off. */
  readonly players: readonly Player[];
}

export interface MatchInput {
  readonly fixtureId: FixtureId;
  /** `seedFromString(`${state.seed}-s${season}-r${round}-${homeId}-${awayId}`)`, from the caller. */
  readonly seed: number;
  readonly home: TeamInput;
  readonly away: TeamInput;
  readonly derby: boolean;
  /** Neutral ground (only the /balance duels): no home advantage for anyone. */
  readonly neutral: boolean;
  readonly rules: GameRules;
  /**
   * Capacity of the home stadium, for the attendance (torcida.md, "Público"). Not in §4.1 yet:
   * the match input has no club definition. Without it, the attendance is 0.
   */
  readonly capacity?: number;
}

export type ChanceKind = 'open' | 'freeKick' | 'penalty';
export type MissOutcome = 'saved' | 'post' | 'wide';
export type HalftimeTalk = 'motivate' | 'demand' | 'calm';
export type InjurySeverity = 'light' | 'medium' | 'serious' | 'severe';

/**
 * What happened, minute by minute. `minute` is the regulation minute (45 or 90 in added time,
 * with `added` = 1, 2...: "45+2"); `half` the half it belongs to; `importance` drives the
 * "só lances principais" view (partida.md, "Eventos").
 */
export type MatchEvent = {
  readonly minute: number;
  readonly added?: number;
  readonly half: 1 | 2;
  readonly importance: 1 | 2 | 3;
} & (
  | { readonly type: 'kickoff' }
  | {
      readonly type: 'chance';
      readonly side: Side;
      readonly shooter: PlayerId;
      /** Never `penalty`: a penalty is `penaltyAwarded`, then `goal` or `penaltyMissed`. */
      readonly kind: Exclude<ChanceKind, 'penalty'>;
      readonly outcome: MissOutcome;
      readonly pGoal: number;
    }
  | {
      readonly type: 'goal';
      readonly side: Side;
      readonly scorer: PlayerId;
      readonly assist?: PlayerId;
      readonly kind: ChanceKind;
      readonly score: readonly [number, number];
    }
  | { readonly type: 'penaltyAwarded'; readonly side: Side; readonly taker: PlayerId }
  | {
      readonly type: 'penaltyMissed';
      readonly side: Side;
      readonly taker: PlayerId;
      readonly outcome: MissOutcome;
    }
  | {
      readonly type: 'yellow';
      readonly side: Side;
      readonly player: PlayerId;
      readonly triggersSuspension: boolean;
    }
  | {
      readonly type: 'red';
      readonly side: Side;
      readonly player: PlayerId;
      readonly reason: 'direct' | 'secondYellow';
    }
  | {
      readonly type: 'injury';
      readonly side: Side;
      readonly player: PlayerId;
      readonly severity: InjurySeverity;
    }
  | {
      readonly type: 'substitution';
      readonly side: Side;
      readonly out: PlayerId;
      readonly in: PlayerId;
      readonly reason: 'tactical' | 'fatigue' | 'injury';
    }
  | {
      readonly type: 'tacticChange';
      readonly side: Side;
      readonly formation: Formation;
      readonly posture: Posture;
      readonly pressure: Pressure;
      readonly preset?: string;
    }
  | { readonly type: 'stoppage'; readonly minutes: number }
  | { readonly type: 'halftime'; readonly score: readonly [number, number] }
  | { readonly type: 'halftimeTalk'; readonly side: Side; readonly talk: HalftimeTalk }
  | {
      readonly type: 'fulltime';
      readonly score: readonly [number, number];
      readonly abandoned: boolean;
    }
);

/** Match statistics of one side (partida.md, "Estatísticas e notas"). */
export interface MatchStats {
  /** Chances created. */
  readonly shots: number;
  /** Goals + goalkeeper saves. */
  readonly onTarget: number;
  /** Display only; the two sides add up to 100. */
  readonly possession: number;
  readonly yellows: number;
  readonly reds: number;
}

/**
 * Result markers, computed at full time for the content templates (partida.md, "Marcadores do
 * resultado"). The kinds keep the names of the design document, which the templates use.
 */
export type MatchMarker =
  | { readonly kind: 'goleada'; readonly side: Side }
  | { readonly kind: 'virada'; readonly side: Side }
  | { readonly kind: 'zebra'; readonly side: Side }
  | {
      readonly kind: 'golNoFim';
      readonly side: Side;
      readonly player: PlayerId;
      readonly minute: number;
      readonly added?: number;
    }
  | {
      readonly kind: 'hatTrick';
      readonly side: Side;
      readonly player: PlayerId;
      readonly goals: number;
    }
  | { readonly kind: 'semSofrerGols'; readonly side: Side }
  | { readonly kind: 'classico' }
  | { readonly kind: 'estreia'; readonly side: Side; readonly player: PlayerId };

export interface MatchResult {
  readonly fixtureId: FixtureId;
  readonly score: readonly [number, number];
  readonly events: readonly MatchEvent[];
  readonly stats: Readonly<Record<Side, MatchStats>>;
  /** Every player who took the pitch; `null` = "sem nota" (under 15 minutes). */
  readonly ratings: Readonly<Record<PlayerId, number | null>>;
  /** Best on the pitch; absent when nobody has a rating. */
  readonly motm?: PlayerId;
  /** Regulation minutes on the pitch (a full match is 90), for every player who took it. */
  readonly minutes: Readonly<Record<PlayerId, number>>;
  /** Energy at the final whistle, for every player who took the pitch. */
  readonly finalEnergy: Readonly<Record<PlayerId, number>>;
  /**
   * Players injured in the match, in order of the injuries, with the rounds out drawn for the
   * severity (partida.md, "Lesões"). Counting the rounds down is the round's job (T-013).
   */
  readonly newInjuries: readonly { readonly player: PlayerId; readonly rounds: number }[];
  /**
   * Players suspended for the club's next games (partida.md, "Cartões e suspensão"): 1 game for
   * a red, 1 for reaching 3 accumulated yellows; a player with both gets the sum. In order of
   * entry, home first. Serving the suspension is the round's job (T-013).
   */
  readonly newSuspensions: readonly { readonly player: PlayerId; readonly games: number }[];
  /**
   * The accumulated yellow counter (`Player.yellowCount`, 0..2) of every player who took the
   * pitch, after this match: +1 for a yellow that counts, back to 0 when it reaches 3 (which
   * suspends). The two yellows of a second-yellow red never count.
   */
  readonly yellowCounts: Readonly<Record<PlayerId, number>>;
  readonly markers: readonly MatchMarker[];
  readonly attendance: number;
  readonly warnings: readonly EngineWarning[];
}
