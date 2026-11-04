import { FORMATIONS } from '../formations.ts';
import { POSTURE_EFFECTS, PRESSURE_EFFECTS } from '../strength.ts';
import type { EngineWarning, Side } from '../types.ts';
import { HALFTIME_TALKS, HALF_MINUTES, MAX_SUBS, TACTIC_PRESETS } from './rules.ts';
import type { HalftimeTalk, MatchCommand, MatchEvent } from './types.ts';

/*
 * The coach's commands of a match (docs/design/partida.md, "Comandos em jogo", "Substituições",
 * "Conversa no intervalo" and "Determinismo"; docs/02-architecture.md, 4.1 "Comandos"; T-012).
 *
 * A command of regulation minute M takes effect at the start of minute M + 1, before anything of
 * that minute is drawn, so re-running the match with one more command gives the same events up to
 * minute M (45 and 90 include their added time). A command of minute 45 takes effect at the start
 * of the second half; one of minute 90 has no next minute and is ignored. The exception is the
 * substitution whose `out` is injured in that same `minute`: it replaces him at once.
 *
 * An invalid command is ignored with a warning (`detail.command` is its index in the list):
 * - at kick-off, by its shape: `command-unknown-kind`, `command-unknown-side`,
 *   `command-invalid-minute` (not an integer 0..90; a half-time talk must be at minute 45),
 *   `command-unknown-formation`, `command-unknown-posture`, `command-unknown-pressure`,
 *   `command-unknown-preset`, `command-unknown-talk`, `command-duplicate-talk` (the first talk of
 *   a side counts);
 * - when it takes effect, by the match situation: `command-no-subs-left`,
 *   `command-player-not-on-pitch`, `command-player-not-on-bench` (not on the bench, already used,
 *   or the reserve who took an unavailable starter's slot at kick-off);
 * - at full time: `command-too-late` (minute 90, never applied).
 */

/** The latest regulation minute of a command (`HALF_MINUTES × 2`). */
const LAST_MINUTE = 2 * HALF_MINUTES;

/** A command that passed the kick-off checks, waiting for its minute. */
export interface PendingCommand {
  readonly command: Exclude<MatchCommand, { kind: 'halftimeTalk' }>;
  /** Index in the commands list (`detail.command` of the warnings). */
  readonly index: number;
  /** Applied, or ignored when its minute came: never looked at again. */
  done: boolean;
}

/** The commands of a match, ready for the loop. */
export interface CommandBook {
  /** By regulation minute, in list order. */
  readonly byMinute: ReadonlyMap<number, readonly PendingCommand[]>;
  /** The coach's half-time talk of each side, if any. */
  readonly talks: Partial<Record<Side, HalftimeTalk>>;
}

const has = (table: object, value: unknown): boolean =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(table, value);

/** Detail of a command warning: side, minute, kind and index, plus `extra`. */
export function commandDetail(
  command: { readonly side?: unknown; readonly minute?: unknown; readonly kind?: unknown },
  index: number,
  extra: Readonly<Record<string, string | number>> = {},
): Readonly<Record<string, string | number>> {
  return {
    command: index,
    side: String(command.side),
    minute: typeof command.minute === 'number' ? command.minute : String(command.minute),
    kind: String(command.kind),
    ...extra,
  };
}

/** The kick-off check of one command; the warning code, or undefined when it is fine. */
function shapeProblem(command: MatchCommand): { code: string; value?: string } | undefined {
  const c = command as unknown as Record<string, unknown>;
  const kind = c['kind'];
  if (
    kind !== 'substitution' &&
    kind !== 'tactic' &&
    kind !== 'preset' &&
    kind !== 'halftimeTalk'
  ) {
    return { code: 'command-unknown-kind' };
  }
  if (c['side'] !== 'home' && c['side'] !== 'away') return { code: 'command-unknown-side' };
  const minute = c['minute'];
  if (
    typeof minute !== 'number' ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > LAST_MINUTE ||
    (kind === 'halftimeTalk' && minute !== HALF_MINUTES)
  ) {
    return { code: 'command-invalid-minute' };
  }
  if (kind === 'tactic') {
    const formation = c['formation'];
    if (formation !== undefined && !(FORMATIONS as readonly unknown[]).includes(formation)) {
      return { code: 'command-unknown-formation', value: String(formation) };
    }
    if (c['posture'] !== undefined && !has(POSTURE_EFFECTS, c['posture'])) {
      return { code: 'command-unknown-posture', value: String(c['posture']) };
    }
    if (c['pressure'] !== undefined && !has(PRESSURE_EFFECTS, c['pressure'])) {
      return { code: 'command-unknown-pressure', value: String(c['pressure']) };
    }
  }
  if (kind === 'preset' && !has(TACTIC_PRESETS, c['preset'])) {
    return { code: 'command-unknown-preset', value: String(c['preset']) };
  }
  if (kind === 'halftimeTalk' && !(HALFTIME_TALKS as readonly unknown[]).includes(c['talk'])) {
    return { code: 'command-unknown-talk', value: String(c['talk']) };
  }
  return undefined;
}

/**
 * Checks the commands at kick-off and sorts them by minute, keeping the list order within a
 * minute. Never throws: a malformed command (a damaged save) is ignored with a warning.
 */
export function prepareCommands(
  commands: readonly MatchCommand[] | undefined,
  warnings: EngineWarning[],
): CommandBook {
  const byMinute = new Map<number, PendingCommand[]>();
  const talks: Partial<Record<Side, HalftimeTalk>> = {};
  if (commands === undefined) return { byMinute, talks };
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index]!;
    if (typeof command !== 'object' || command === null) {
      warnings.push({ code: 'command-unknown-kind', detail: { command: index } });
      continue;
    }
    const problem = shapeProblem(command);
    if (problem !== undefined) {
      const extra: Record<string, string> =
        problem.value === undefined ? {} : { value: problem.value };
      warnings.push({ code: problem.code, detail: commandDetail(command, index, extra) });
      continue;
    }
    if (command.kind === 'halftimeTalk') {
      if (talks[command.side] !== undefined) {
        warnings.push({ code: 'command-duplicate-talk', detail: commandDetail(command, index) });
        continue;
      }
      talks[command.side] = command.talk;
      continue;
    }
    const list = byMinute.get(command.minute) ?? [];
    list.push({ command, index, done: false });
    byMinute.set(command.minute, list);
  }
  return { byMinute, talks };
}

/**
 * Substitutions a side still has after `events` (US-021, "o contador de substituições"): the
 * screen passes the events up to the current minute; never below 0.
 */
export function substitutionsLeft(events: readonly MatchEvent[], side: Side): number {
  let used = 0;
  for (const e of events) if (e.type === 'substitution' && e.side === side) used += 1;
  return Math.max(0, MAX_SUBS - used);
}
