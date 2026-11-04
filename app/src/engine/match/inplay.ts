import type { AiParams } from '../params.ts';
import type { Player } from '../players.ts';
import { bestForSlot, correctedCondition } from '../selection.ts';
import type { Posture, Pressure } from '../types.ts';
import { IN_MATCH_AI, MAX_SUBS, TACTIC_PRESETS } from './rules.ts';
import { currentEff, slotEff, type TeamState } from './team.ts';
import type { TacticPreset } from './types.ts';

/*
 * The AI during the match (docs/design/ia-clubes.md, "Durante o jogo"; T-012). These functions
 * only read the team state and never draw: they return what the AI decided, and the match loop
 * (simulate.ts) applies it (and marks rule 3's substitution as made).
 *
 * | # | When                                         | What the AI does                              |
 * | 1 | injury                                       | the reserve with the highest selection value   |
 * |   |                                              | for the slot, at once                          |
 * | 2 | after minutes 60, 70 and 80                  | the starter with the lowest energy, below      |
 * |   |                                              | `ai.subEnergy`, off for the best reserve for   |
 * |   |                                              | the slot if his eff is at least                |
 * |   |                                              | `ai.rotationMinRatio` of the starter's now     |
 * | 3 | from 70 (chaotic: 60), losing                | attacking posture every minute (unless all     |
 * |   |                                              | out); once a match, the lowest-eff AM or ST    |
 * |   |                                              | slot off for the best AM or ST of the bench    |
 * | 4 | from 80, losing by 1                         | "todo mundo no ataque"                         |
 * | 5 | from 75 (ambitious: 80), winning by 1        | "segurar o resultado"                          |
 * | 6 | always                                       | keeps 1 substitution for an injury until 80    |
 *
 * The AI decides after every minute played, regulation or added time of the second half (rule
 * minute 90), at most one tactical substitution (rules 2 and 3) per minute, and never changes the
 * formation in 1a. Rule 1 runs for both controllers (the coach's club too: ia-clubes.md, "Clube do
 * técnico humano"); rules 2 to 6 only for `controller: 'ai'`.
 */

/** The reserve of rule 1 for the slot `index`: the highest selection value; none without a sub. */
export function injuryReserve(team: TeamState, index: number): Player | undefined {
  if (team.subs >= MAX_SUBS) return undefined;
  return bestForSlot(team.bench, team.slots[index]!.position);
}

/**
 * A substitution the AI decided: the player in slot `index` leaves, `reserve` comes on.
 * `fatigue` is rule 2, `tactical` is rule 3 (the caller marks it as made).
 */
export interface AiSubstitution {
  readonly index: number;
  readonly reserve: Player;
  readonly reason: 'fatigue' | 'tactical';
}

/** A tactic the AI decided (only the posture and the pressure: the AI never changes formation). */
export interface AiTactic {
  readonly posture: Posture;
  readonly pressure: Pressure;
  readonly preset?: TacticPreset;
}

/** What the AI decided after a minute: at most one tactical substitution and one tactic. */
export interface AiDecision {
  readonly substitution?: AiSubstitution;
  readonly tactic?: AiTactic;
}

const NOTHING: AiDecision = {};

/** Rule 6: before minute 80 a tactical substitution must leave one for an injury. */
function tacticalSubAllowed(team: TeamState, minute: number): boolean {
  const kept = minute < IN_MATCH_AI.keepSubUntil ? 1 : 0;
  return team.subs < MAX_SUBS - kept;
}

/**
 * Rule 2: the starters on the pitch below `ai.subEnergy`, from the lowest energy (ties: slot
 * order); the first whose best reserve for the slot (highest selection value) has an eff there of
 * at least `ai.rotationMinRatio` of the starter's eff now. A substitute never goes off this way.
 */
function fatigueSubstitution(
  team: TeamState,
  ai: Pick<AiParams, 'subEnergy' | 'rotationMinRatio'>,
): AiSubstitution | undefined {
  if (team.bench.length === 0) return undefined;
  const tired: number[] = [];
  for (let i = 0; i < team.slots.length; i++) {
    const app = team.slots[i]!.app;
    if (app !== undefined && app.starter && app.energy < ai.subEnergy) tired.push(i);
  }
  // Stable sort: equal energies keep the slot order.
  tired.sort((a, b) => team.slots[a]!.app!.energy - team.slots[b]!.app!.energy);
  for (const i of tired) {
    const position = team.slots[i]!.position;
    const reserve = bestForSlot(team.bench, position);
    if (reserve === undefined) return undefined;
    const fresh = slotEff(reserve, position, correctedCondition(reserve));
    if (fresh >= ai.rotationMinRatio * currentEff(team, i)) {
      return { index: i, reserve, reason: 'fatigue' };
    }
  }
  return undefined;
}

/**
 * Rule 3's substitution: the AM or ST slot (slot position) with the lowest `eff` now (ties: the
 * first in slot order) leaves for the AM or ST (natural position) of the bench with the highest
 * selection value for that slot, who takes the slot.
 */
function chaseSubstitution(team: TeamState): AiSubstitution | undefined {
  let out = -1;
  let outEff = 0;
  for (let i = 0; i < team.slots.length; i++) {
    const slot = team.slots[i]!;
    if (slot.app === undefined || (slot.position !== 'AM' && slot.position !== 'ST')) continue;
    const eff = currentEff(team, i);
    if (out < 0 || eff < outEff) {
      out = i;
      outEff = eff;
    }
  }
  if (out < 0) return undefined;
  const reserve = bestForSlot(
    team.bench,
    team.slots[out]!.position,
    (p) => p.position !== 'AM' && p.position !== 'ST',
  );
  return reserve === undefined ? undefined : { index: out, reserve, reason: 'tactical' };
}

/**
 * The AI's decisions for `team` after a minute played (rules 2 to 6, in order), with the score of
 * the moment; `minute` is the rule minute (90 in the second half's added time, which is never one
 * of rule 2's moments). They take effect in the next minute. Rules 3 to 5 that hit in the same minute
 * leave one tactic, the last one (rule 3 then 4 is "todo mundo no ataque"). Without a substitution
 * left, the substitution part of a rule is skipped and its tactic stays.
 */
export function aiDecision(
  team: TeamState,
  minute: number,
  own: number,
  theirs: number,
  ai: Pick<AiParams, 'subEnergy' | 'rotationMinRatio'>,
): AiDecision {
  if (minute < IN_MATCH_AI.chaoticChaseFrom) return NOTHING;
  const { profile } = team;
  let substitution: AiSubstitution | undefined;

  // Rule 2: fatigue, only after minutes 60, 70 and 80.
  if (
    (IN_MATCH_AI.fatigueMinutes as readonly number[]).includes(minute) &&
    tacticalSubAllowed(team, minute)
  ) {
    substitution = fatigueSubstitution(team, ai);
  }

  let posture = team.tactic.posture;
  let pressure = team.tactic.pressure;
  let preset: TacticPreset | undefined;

  // Rule 3: the attacking posture every minute losing; the substitution once, at the first
  // minute it is possible (rule 6 allows it, no other tactical substitution, an AM or ST to come).
  const chaseFrom = profile === 'chaotic' ? IN_MATCH_AI.chaoticChaseFrom : IN_MATCH_AI.chaseFrom;
  if (own < theirs && minute >= chaseFrom) {
    if (posture !== 'allOut') posture = 'attacking';
    if (!team.chased && substitution === undefined && tacticalSubAllowed(team, minute)) {
      substitution = chaseSubstitution(team);
    }
  }

  // Rule 4: "todo mundo no ataque" when losing by one.
  if (minute >= IN_MATCH_AI.allOutFrom && theirs - own === IN_MATCH_AI.oneGoal) {
    const set = TACTIC_PRESETS.allOut;
    posture = set.posture ?? posture;
    pressure = set.pressure;
    preset = 'allOut';
  }

  // Rule 5: "segurar o resultado" when winning by one.
  const holdFrom = profile === 'ambitious' ? IN_MATCH_AI.ambitiousHoldFrom : IN_MATCH_AI.holdFrom;
  if (minute >= holdFrom && own - theirs === IN_MATCH_AI.oneGoal) {
    const set = TACTIC_PRESETS.holdResult;
    posture = set.posture ?? posture;
    pressure = set.pressure;
    preset = 'holdResult';
  }

  const changed = posture !== team.tactic.posture || pressure !== team.tactic.pressure;
  if (substitution === undefined && !changed) return NOTHING;
  return {
    ...(substitution === undefined ? {} : { substitution }),
    ...(changed
      ? { tactic: { posture, pressure, ...(preset === undefined ? {} : { preset }) } }
      : {}),
  };
}
