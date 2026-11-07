import { MATCH_MODES, type ClubDef, type MatchMode } from '../../engine/index.ts';

/*
 * What the new-game screen needs from the career layer besides `create` (US-014; T-025,
 * docs/design/telas/novo-jogo.md): the "última configuração" kept in the `kv` store of the save
 * and the clubs with the strength the engine will play them with.
 */

/** The key of the last new-game setup in the `kv` store (docs/02-architecture.md, 4.2). */
export const LAST_SETUP_KEY = 'newGame.last';

/**
 * The last new-game setup (CEO decision 2 of T-025): only the realism and the match mode. Never
 * the club (each career tends to be another one) nor the coach's nickname: a copy in `kv` would
 * outlive deleting every career (data minimisation, LGPD).
 */
export interface LastSetup {
  readonly realism: 'full' | 'simplified';
  readonly matchMode: MatchMode;
}

const REALISMS: readonly LastSetup['realism'][] = ['full', 'simplified'];

/** The stored value as a {@link LastSetup}, or `undefined` when it is absent or not one. */
export function parseLastSetup(value: unknown): LastSetup | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const { realism, matchMode } = value as Record<string, unknown>;
  if (!REALISMS.includes(realism as LastSetup['realism'])) return undefined;
  if (!MATCH_MODES.includes(matchMode as MatchMode)) return undefined;
  return { realism: realism as LastSetup['realism'], matchMode: matchMode as MatchMode };
}

/** A club of the new-game list with the strength shown beside it (temporada.md). */
export interface NewGameClub {
  readonly club: ClubDef;
  /** The data's `strength`, or the engine's default when the data has none. */
  readonly strength: number;
}
