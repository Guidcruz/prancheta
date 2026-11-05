import { FORMATIONS } from '../formations.ts';
import { POSTURES, PRESSURE_EFFECTS } from '../strength.ts';
import type { EngineWarning, Side } from '../types.ts';
import { HALFTIME_CHOICES, HALF_MINUTES, MAX_SUBS, STOPPAGE, TACTIC_PRESETS } from './rules.ts';
import type { HalftimeChoice, MatchCommand, MatchEvent, TeamInput } from './types.ts';

/*
 * The coach's commands of a match (docs/design/partida.md, "Quando um comando vale", "Comandos em
 * jogo", "Substituições", "Conversa no intervalo" and "Determinismo"; docs/02-architecture.md, 4.1
 * "Comandos"; T-012).
 *
 * A command carries the last minute played and takes effect at the start of the next one, before
 * anything of it is drawn, so re-running the match with one more command gives the same events up
 * to the minute of the command:
 * - minute M from 0 to 89 → minute M + 1; 45 also covers the first half's added time → minute 46;
 * - minute 90 with `added` k (0 to 6, absent = 0) → 90+(k+1), when the drawn added time has it.
 * The exception is the substitution whose `out` is injured in that same minute (any minute 45+k
 * for a command of 45; exactly 90+k for 90 with `added` k): it replaces him at once.
 *
 * An invalid command is ignored with a warning (`detail.command` is its index in the list):
 * - at kick-off, by its shape: `command-unknown-kind`, `command-unknown-side`,
 *   `command-invalid-minute` (minute not an integer 0..90; `added` other than an integer 0..6 or
 *   with a minute other than 90; a half-time talk away from minute 45), `command-unknown-formation`,
 *   `command-unknown-posture`, `command-unknown-pressure`, `command-unknown-preset`,
 *   `command-unknown-talk`, then `command-ai-side` (the side is played by the AI: only the coach's
 *   side takes commands) and `command-duplicate-talk` (the first talk of a side counts);
 * - when it takes effect, by the match situation: `command-no-subs-left`,
 *   `command-player-not-on-pitch`, `command-player-not-on-bench` (not on the bench, already used,
 *   or the reserve who took an unavailable starter's slot at kick-off);
 * - at full time, every command that never had a next minute to take effect in:
 *   `command-too-late`. That is a command of minute 90 with `added` greater than or equal to the
 *   drawn added time, and any command (the half-time talk too) whose moment the match never
 *   reached because it was abandoned.
 */

/** The latest regulation minute of a command (`HALF_MINUTES × 2`). */
export const LAST_MINUTE = 2 * HALF_MINUTES;
/** Added minutes of a command of minute 90: up to the most the second half can have. */
const MAX_ADDED = STOPPAGE[2].max;

/**
 * Key of the moment a command was given (and of the minute an injury happened, for the swap):
 * `minute × 10 + added`, where added counts only at minute 90 (the first half's added time is
 * minute 45). The keys sort in match order.
 */
export function commandKey(minute: number, added = 0): number {
  return minute * 10 + (minute === LAST_MINUTE ? added : 0);
}

/** A command that passed the kick-off checks, waiting for its minute. */
export interface PendingCommand {
  readonly command: Exclude<MatchCommand, { kind: 'halftimeTalk' }>;
  /** Index in the commands list (`detail.command` of the warnings). */
  readonly index: number;
  /** Applied, or ignored when its minute came: never looked at again. */
  done: boolean;
}

/** The coach's half-time talk of a side. */
export interface PendingTalk {
  readonly command: Extract<MatchCommand, { kind: 'halftimeTalk' }>;
  readonly index: number;
  readonly talk: HalftimeChoice;
}

/** The commands of a match, ready for the loop. */
export interface CommandBook {
  /** By {@link commandKey}, in list order. */
  readonly byMinute: ReadonlyMap<number, readonly PendingCommand[]>;
  /** The coach's half-time choice of each side, if any, with the command and its index. */
  readonly talks: Partial<Record<Side, PendingTalk>>;
}

const has = (table: object, value: unknown): boolean =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(table, value);

/** Detail of a command warning: side, minute, kind and index, plus `extra`. */
export function commandDetail(
  command: {
    readonly side?: unknown;
    readonly minute?: unknown;
    readonly added?: unknown;
    readonly kind?: unknown;
  },
  index: number,
  extra: Readonly<Record<string, string | number>> = {},
): Readonly<Record<string, string | number>> {
  const shown = (v: unknown) => (typeof v === 'number' ? v : String(v));
  return {
    command: index,
    side: String(command.side),
    minute: shown(command.minute),
    ...(command.added === undefined ? {} : { added: shown(command.added) }),
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
  const added = c['added'];
  if (
    added !== undefined &&
    (minute !== LAST_MINUTE ||
      typeof added !== 'number' ||
      !Number.isInteger(added) ||
      added < 0 ||
      added > MAX_ADDED)
  ) {
    return { code: 'command-invalid-minute' };
  }
  if (kind === 'tactic') {
    const formation = c['formation'];
    if (formation !== undefined && !(FORMATIONS as readonly unknown[]).includes(formation)) {
      return { code: 'command-unknown-formation', value: String(formation) };
    }
    if (c['posture'] !== undefined && !(POSTURES as readonly unknown[]).includes(c['posture'])) {
      return { code: 'command-unknown-posture', value: String(c['posture']) };
    }
    if (c['pressure'] !== undefined && !has(PRESSURE_EFFECTS, c['pressure'])) {
      return { code: 'command-unknown-pressure', value: String(c['pressure']) };
    }
  }
  if (kind === 'preset' && !has(TACTIC_PRESETS, c['preset'])) {
    return { code: 'command-unknown-preset', value: String(c['preset']) };
  }
  if (kind === 'halftimeTalk' && !(HALFTIME_CHOICES as readonly unknown[]).includes(c['talk'])) {
    return { code: 'command-unknown-talk', value: String(c['talk']) };
  }
  return undefined;
}

/**
 * Checks the commands at kick-off and sorts them by moment, keeping the list order within one.
 * `controllers` says who plays each side: a command for an AI side is ignored. Never throws: a
 * malformed command (a damaged save) is ignored with a warning.
 */
export function prepareCommands(
  commands: readonly MatchCommand[] | undefined,
  controllers: Readonly<Record<Side, TeamInput['controller']>>,
  warnings: EngineWarning[],
): CommandBook {
  const byMinute = new Map<number, PendingCommand[]>();
  const talks: Partial<Record<Side, PendingTalk>> = {};
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
    if (controllers[command.side] !== 'human') {
      warnings.push({ code: 'command-ai-side', detail: commandDetail(command, index) });
      continue;
    }
    if (command.kind === 'halftimeTalk') {
      if (talks[command.side] !== undefined) {
        warnings.push({ code: 'command-duplicate-talk', detail: commandDetail(command, index) });
        continue;
      }
      talks[command.side] = { command, index, talk: command.talk };
      continue;
    }
    const key = commandKey(command.minute, command.added);
    const list = byMinute.get(key) ?? [];
    list.push({ command, index, done: false });
    byMinute.set(key, list);
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
