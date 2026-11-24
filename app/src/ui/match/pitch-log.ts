import type { ErrorReport } from '../../lib/errors';

/*
 * What the match screen records about its pitch, once per match each (docs/02-architecture.md,
 * 3): the pitch falling back to the layout without it (`failed`), and a player of an event who is
 * not on the pitch (`issue`, a damaged save: the match goes on, only that disc is missing). The two
 * are kept apart so one never uses up the other's entry. No personal data: only codes.
 */
export function createPitchLog(record: (report: ErrorReport) => void) {
  let failedLogged = false;
  let issueLogged = false;
  return {
    /** The pitch fell back to the layout without it (the loop of frames is gone). */
    failed(code: string, error?: unknown): void {
      if (failedLogged) return;
      failedLogged = true;
      record({ kind: 'programming', code, screen: 'match', error });
    },
    /** The pitch goes on, but an event had no disc: a programming error, recorded once. */
    issue(code: string): void {
      if (issueLogged) return;
      issueLogged = true;
      record({ kind: 'programming', code, screen: 'match' });
    },
    /** A new match. */
    reset(): void {
      failedLogged = false;
      issueLogged = false;
    },
  };
}
