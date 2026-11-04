import type { AiParams } from '../params.ts';
import type { Player } from '../players.ts';
import { bestForSlot, correctedCondition } from '../selection.ts';
import type { Posture, Pressure } from '../types.ts';
import { IN_MATCH_AI, MAX_SUBS, TACTIC_PRESETS } from './rules.ts';
import { currentEff, slotEff, type TeamState } from './team.ts';
import type { TacticPreset } from './types.ts';

/*
 * The AI during the match (docs/design/ia-clubes.md, "Durante o jogo"; T-012). Pure decisions on
 * the team state, without any draw: the match loop (simulate.ts) applies them.
 *
 * | # | When                                              | What the AI does                         |
 * | 1 | injury                                            | the reserve with the highest selection   |
 * |   |                                                   | value for the slot, at once              |
 * | 2 | minutes 60 to 80, a player with energy < subEnergy | the best reserve for the slot, if his    |
 * |   |                                                   | eff beats the tired player's eff now     |
 * | 3 | from 70 (chaotic: 60), losing                     | lowest-eff DM or CB slot out for the best|
 * |   |                                                   | AM or ST of the bench; posture attacking |
 * | 4 | from 80, losing by 1                              | "todo mundo no ataque"                   |
 * | 5 | from 75 (ambitious: 80), winning by 1             | "segurar o resultado"                    |
 * | 6 | always                                            | keeps 1 substitution for an injury until |
 * |   |                                                   | minute 80                                |
 *
 * Rule 1 runs for both controllers (the coach's club too: ia-clubes.md, "Clube do técnico
 * humano", and docs/02-architecture.md, "Comandos"); rules 2 to 6 only for `controller: 'ai'`.
 */

/** The reserve of rule 1 for the slot `index`: the highest selection value; none without a sub. */
export function injuryReserve(team: TeamState, index: number): Player | undefined {
  if (team.subs >= MAX_SUBS) return undefined;
  return bestForSlot(team.bench, team.slots[index]!.position);
}

/** A substitution the AI decided: the player in slot `index` leaves, `reserve` comes on. */
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
 * Rule 2: in slot order, the first player on the pitch with energy below `ai.subEnergy` whose
 * best reserve for the slot (highest selection value) has a higher `eff` there than the tired
 * player has now.
 */
function fatigueSubstitution(
  team: TeamState,
  ai: Pick<AiParams, 'subEnergy'>,
): AiSubstitution | undefined {
  if (team.bench.length === 0) return undefined;
  for (let i = 0; i < team.slots.length; i++) {
    const slot = team.slots[i]!;
    if (slot.app === undefined || !(slot.app.energy < ai.subEnergy)) continue;
    const reserve = bestForSlot(team.bench, slot.position);
    if (reserve === undefined) return undefined;
    const fresh = slotEff(reserve, slot.position, correctedCondition(reserve));
    if (fresh > currentEff(team, i)) return { index: i, reserve, reason: 'fatigue' };
  }
  return undefined;
}

/**
 * Rule 3's substitution: the DM or CB slot (slot position) with the lowest `eff` now (ties: the
 * first in slot order) leaves for the AM or ST (natural position) of the bench with the highest
 * selection value for that slot, who takes the slot (partida.md, "Quem entra numa substituição
 * ocupa a vaga de quem saiu").
 */
function chaseSubstitution(team: TeamState): AiSubstitution | undefined {
  let out = -1;
  let outEff = 0;
  for (let i = 0; i < team.slots.length; i++) {
    const slot = team.slots[i]!;
    if (slot.app === undefined || (slot.position !== 'DM' && slot.position !== 'CB')) continue;
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
 * The AI's decisions for `team` after regulation minute `minute` was played (rules 2 to 6, in
 * order), with the score of the moment; they take effect in the next minute. Rules 3 to 5 that
 * hit in the same minute leave one tactic, the last one (rule 3 then 4 is "todo mundo no ataque").
 * Without a substitution left, the substitution part of a rule is skipped and its tactic stays.
 */
export function aiDecision(
  team: TeamState,
  minute: number,
  own: number,
  theirs: number,
  ai: Pick<AiParams, 'subEnergy'>,
): AiDecision {
  if (minute < IN_MATCH_AI.chaoticChaseFrom) return NOTHING;
  const { profile } = team;
  let substitution: AiSubstitution | undefined;

  // Rule 2: fatigue (at most one tactical substitution per minute).
  if (
    minute >= IN_MATCH_AI.fatigueFrom &&
    minute <= IN_MATCH_AI.fatigueTo &&
    tacticalSubAllowed(team, minute)
  ) {
    substitution = fatigueSubstitution(team, ai);
  }

  let posture = team.tactic.posture;
  let pressure = team.tactic.pressure;
  let preset: TacticPreset | undefined;
  const losing = own < theirs;

  // Rule 3: going for the result, once a match; it waits a minute if rule 2 used this one.
  const chaseFrom = profile === 'chaotic' ? IN_MATCH_AI.chaoticChaseFrom : IN_MATCH_AI.chaseFrom;
  if (losing && minute >= chaseFrom && !team.chased && substitution === undefined) {
    team.chased = true;
    if (tacticalSubAllowed(team, minute)) substitution = chaseSubstitution(team);
    if (posture !== 'allOut') posture = 'attacking';
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
