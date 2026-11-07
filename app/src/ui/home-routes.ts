import { HOME_DESTINATION, NEW_GAME_HASH, hrefOf } from './router';

/*
 * The history moves of the screens outside a career (App.svelte): the home screen and the
 * new-game screen, which has its own entry (`#/new`) so the phone's back gesture returns home.
 * The browser objects come in as arguments, so the tests use fakes.
 */

export type HomeScreen = 'home' | 'new';

/** The part of `History` these moves use. */
export type HistoryLike = Pick<History, 'state' | 'pushState' | 'replaceState' | 'back'>;
/** The part of `Location` these moves use. */
export type LocationLike = Pick<Location, 'hash' | 'pathname' | 'search'>;

/** The screen of an address outside a career (a reload on `#/new` stays on the new game). */
export function screenOfHash(hash: string): HomeScreen {
  return hash === NEW_GAME_HASH ? 'new' : 'home';
}

/** "Nova carreira": the new-game screen gets its own entry. */
export function enterNewGame(history: HistoryLike): HomeScreen {
  history.pushState({ newGame: true }, '', NEW_GAME_HASH);
  return 'new';
}

/**
 * Back from the new-game screen by its button: its entry goes away, as with the back gesture;
 * landed straight on `#/new` (a reload), there is no entry of ours to go back to, so the address
 * is replaced instead (going back would leave the game).
 */
export function leaveNewGame(history: HistoryLike, location: LocationLike): HomeScreen {
  if (history.state?.newGame === true) history.back();
  else history.replaceState(null, '', location.pathname + location.search);
  return 'home';
}

/** The career is created: it opens on the Clube tab, in the entry of the new-game screen. */
export function landOnClub(history: HistoryLike): HomeScreen {
  history.replaceState(null, '', hrefOf(HOME_DESTINATION));
  return 'home';
}

/**
 * The screen after a back or forward (`popstate`), or `undefined` when nothing changes: a career
 * open or a full-screen error owns the screen, or the address is still that of this screen.
 */
export function screenAfterPop(
  current: HomeScreen,
  hash: string,
  status: 'closed' | 'opening' | 'open' | 'fatal',
): HomeScreen | undefined {
  if (status === 'open' || status === 'fatal') return undefined;
  const next = screenOfHash(hash);
  return next === current ? undefined : next;
}
