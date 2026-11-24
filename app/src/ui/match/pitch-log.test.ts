import { describe, expect, it } from 'vitest';
import type { ErrorReport } from '../../lib/errors';
import { createPitchLog } from './pitch-log';

describe('the pitch log', () => {
  it('records an unknown player and a later real failure, each once', () => {
    const rows: ErrorReport[] = [];
    const log = createPitchLog((r) => rows.push(r));
    log.issue('pitch-unknown-player');
    log.issue('pitch-unknown-player');
    log.failed('pitch-draw', new Error('x'));
    log.failed('pitch-context');
    expect(rows.map((r) => r.code)).toEqual(['pitch-unknown-player', 'pitch-draw']);
    expect(rows.every((r) => r.kind === 'programming' && r.screen === 'match')).toBe(true);
  });

  it('starts again with a new match', () => {
    const rows: ErrorReport[] = [];
    const log = createPitchLog((r) => rows.push(r));
    log.failed('pitch-chunk');
    log.reset();
    log.failed('pitch-chunk');
    expect(rows).toHaveLength(2);
  });
});
