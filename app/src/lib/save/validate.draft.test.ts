import { describe, expect, it } from 'vitest';
import type { DraftSheet } from '../../engine/index.ts';
import type { CareerSave } from './schema.ts';
import { sampleCareerSave, sampleDraft } from './testing/sample.ts';
import { parseCareerSave, parseDraft, type SaveCheck, type SaveIssue } from './validate.ts';

/*
 * The coach's draft sheet in the save, format v2 (ADR-0021, item 7; T-075): the same schema and the
 * same coherence in the three levels (`full`, `open`, `write`) and in `parseDraft`, so what the
 * write accepts, the opening accepts.
 */

const played = sampleCareerSave({ rounds: 3 });
const draft = sampleDraft(played);
const good: CareerSave = { ...played, career: { ...played.career, draft } };
const clubId = good.career.clubId;
const squad = good.game.squads[clubId]!;
const otherClub = Object.keys(good.game.squads).find((id) => id !== clubId)!;
const stranger = good.game.squads[otherClub]![0]!;
const LEVELS: readonly SaveCheck[] = ['full', 'open', 'write'];

type Json = Record<string, unknown>;
/** A draft lineup as a hostile file could have it: any value anywhere. */
interface Lineup {
  [key: string]: unknown;
  formation: unknown;
  starters: unknown[];
  bench: unknown[];
  captains: unknown;
  penaltyTakers: unknown;
  freeKickTakers: unknown;
}

/** A copy of the good draft with its lineup or tactic changed. */
function changed(change: (d: { lineup: Lineup; tactic: Json }) => void): unknown {
  const copy = JSON.parse(JSON.stringify(draft)) as { lineup: Lineup; tactic: Json };
  change(copy);
  return copy;
}

function withDraft(raw: unknown): unknown {
  const save = JSON.parse(JSON.stringify(good)) as Json & { career: Json };
  save.career.draft = raw;
  return save;
}

function refusedIn(check: SaveCheck, raw: unknown): SaveIssue {
  const result = parseCareerSave(withDraft(raw), { check });
  if (result.ok) throw new Error(`${check}: accepted`);
  return result.detail as SaveIssue;
}

function refusedByParseDraft(raw: unknown): SaveIssue {
  const result = parseDraft(raw, squad);
  if (result.ok) throw new Error('parseDraft: accepted');
  expect(result.error).toBe('invalid-save');
  return result.detail as SaveIssue;
}

describe('career.draft in the three levels (ADR-0021)', () => {
  it('a save with a draft, free slots included, passes full, open and write as it is', () => {
    expect(draft.lineup.starters).toContain(null);
    expect(draft.lineup.bench).toContain(null);
    for (const check of LEVELS) {
      const parsed = parseCareerSave(JSON.parse(JSON.stringify(good)), { check });
      expect(parsed.ok, check).toBe(true);
      if (parsed.ok) expect(parsed.value.career.draft, check).toEqual(draft);
    }
    expect(parseDraft(JSON.parse(JSON.stringify(draft)), squad)).toEqual({
      ok: true,
      value: draft,
    });
  });

  it('a save without a draft passes too (the coach has not changed the sheet)', () => {
    for (const check of LEVELS) expect(parseCareerSave(played, { check }).ok, check).toBe(true);
  });

  it('accepts an empty sheet, every slot free, and an injured player on it', () => {
    const empty: DraftSheet = {
      lineup: {
        formation: '5-3-2',
        starters: Array.from({ length: 11 }, () => null),
        bench: [],
        captains: [],
        penaltyTakers: [],
        freeKickTakers: [],
      },
      tactic: { posture: 'defensive', pressure: 'low' },
    };
    for (const check of LEVELS) {
      expect(parseCareerSave(withDraft(empty), { check }).ok, check).toBe(true);
    }
    // The format does not know who is injured: the screen warns (ADR-0021, item 5).
    const injured = squad[0]!;
    const hurt = {
      ...good,
      game: {
        ...good.game,
        players: {
          ...good.game.players,
          [injured]: { ...good.game.players[injured]!, injuryRounds: 3 },
        },
      },
    };
    expect(parseCareerSave(hurt).ok).toBe(true);
  });

  const cases: [string, () => unknown, string, string][] = [
    [
      'a starter out of the coach squad',
      () => changed((d) => (d.lineup.starters[2] = stranger)),
      'career.draft.lineup.starters.2',
      'unknown-player',
    ],
    [
      'a bench player who does not exist',
      () => changed((d) => (d.lineup.bench[1] = 'nobody#1')),
      'career.draft.lineup.bench.1',
      'unknown-player',
    ],
    [
      'a captain out of the squad',
      () => changed((d) => (d.lineup.captains = [squad[0], stranger])),
      'career.draft.lineup.captains.1',
      'unknown-player',
    ],
    [
      'a free-kick taker out of the squad',
      () => changed((d) => (d.lineup.freeKickTakers = [stranger])),
      'career.draft.lineup.freeKickTakers.0',
      'unknown-player',
    ],
    [
      'an id twice between the 11 and the bench',
      () => changed((d) => (d.lineup.bench[0] = d.lineup.starters[0])),
      'career.draft.lineup',
      'check',
    ],
    [
      'an id twice in the 11',
      () => changed((d) => (d.lineup.starters[1] = d.lineup.starters[0])),
      'career.draft.lineup',
      'check',
    ],
    [
      'an id twice in one list',
      () => changed((d) => (d.lineup.penaltyTakers = [squad[0], squad[0]])),
      'career.draft.lineup',
      'check',
    ],
    [
      '10 starters',
      () => changed((d) => d.lineup.starters.pop()),
      'career.draft.lineup.starters',
      'length',
    ],
    [
      '12 starters',
      () => changed((d) => d.lineup.starters.push(null)),
      'career.draft.lineup.starters',
      'length',
    ],
    [
      'a bench of 8',
      () => changed((d) => d.lineup.bench.push(null)),
      'career.draft.lineup.bench',
      'max_length',
    ],
    [
      'a list of 12',
      () => changed((d) => (d.lineup.captains = squad.slice(0, 12))),
      'career.draft.lineup.captains',
      'max_length',
    ],
    [
      'a null in a list',
      () => changed((d) => (d.lineup.captains = [null])),
      'career.draft.lineup.captains.0',
      'string',
    ],
    [
      'an unknown formation',
      () => changed((d) => (d.lineup.formation = '4-5-1')),
      'career.draft.lineup.formation',
      'picklist',
    ],
    [
      'the allOut posture',
      () => changed((d) => (d.tactic.posture = 'allOut')),
      'career.draft.tactic.posture',
      'picklist',
    ],
    [
      'an unknown pressure',
      () => changed((d) => (d.tactic.pressure = 'max')),
      'career.draft.tactic.pressure',
      'picklist',
    ],
    [
      'an unknown key in the lineup',
      () => changed((d) => (d.lineup.subs = [])),
      'career.draft.lineup.subs',
      'strict_object',
    ],
    [
      'an empty id',
      () => changed((d) => (d.lineup.starters[0] = '')),
      'career.draft.lineup.starters.0',
      'min_length',
    ],
    ['not a sheet', () => 'sheet', 'career.draft', 'strict_object'],
    ['null', () => null, 'career.draft', 'strict_object'],
  ];

  it.each(cases)(
    'refuses %s with the same issue in full, open, write and parseDraft',
    (_label, raw, path, problem) => {
      for (const check of LEVELS) {
        expect(refusedIn(check, raw()), check).toEqual({ path, problem });
      }
      const relative = path === 'career.draft' ? '' : path.slice('career.draft.'.length);
      expect(refusedByParseDraft(raw())).toEqual({ path: relative, problem });
    },
  );

  it('the coherence reads the squad of the coach club, not any squad', () => {
    const raw = changed((d) => (d.lineup.starters[0] = stranger));
    expect(parseDraft(raw, good.game.squads[otherClub]!).ok).toBe(false);
    expect(parseDraft(draft, [])).toMatchObject({ ok: false, error: 'invalid-save' });
    const theirs = [...good.game.squads[otherClub]!, ...squad];
    expect(parseDraft(raw, theirs).ok).toBe(true);
  });

  it('refuses a prototype key in the draft in full, write and parseDraft', () => {
    for (const key of ['__proto__', 'constructor', 'toString']) {
      const text = JSON.stringify(draft).replace('"tactic":', `"${key}":{"x":1},"tactic":`);
      const hostile = JSON.parse(text) as unknown;
      expect(refusedIn('full', hostile), key).toEqual({ path: '', problem: 'forbidden-key' });
      expect(refusedIn('write', hostile), key).toEqual({ path: '', problem: 'forbidden-key' });
      expect(refusedByParseDraft(hostile)).toEqual({ path: '', problem: 'forbidden-key' });
    }
  });

  it('parseDraft never throws, and never has the value in the issue', () => {
    const hostile = {
      get lineup(): never {
        throw new Error('boom');
      },
      tactic: draft.tactic,
    };
    expect(parseDraft(hostile, squad)).toEqual({
      ok: false,
      error: 'invalid-save',
      detail: { path: '', problem: 'unreadable' },
    });
    const issue = refusedByParseDraft(changed((d) => (d.lineup.bench[0] = 'Zeca Secreto')));
    expect(JSON.stringify(issue)).not.toContain('Zeca');
  });
});
