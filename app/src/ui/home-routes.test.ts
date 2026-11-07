import { describe, expect, it } from 'vitest';
import { FakeHistory } from './testing/fake-history';
import {
  enterNewGame,
  landOnClub,
  leaveNewGame,
  screenAfterPop,
  screenOfHash,
} from './home-routes';
import { NEW_GAME_HASH } from './router';

/* The moves of App.svelte between the home screen and the new game (novo-jogo.md). */

describe('home and new-game routes', () => {
  it('"Nova carreira" adds the #/new entry; its back button takes it away', () => {
    const history = new FakeHistory('/jogo/');
    expect(enterNewGame(history)).toBe('new');
    expect(history.url).toBe(`/jogo/${NEW_GAME_HASH}`);
    expect(history.length).toBe(2);
    expect(leaveNewGame(history, history.location)).toBe('home');
    expect(history.url).toBe('/jogo/');
    expect(history.length).toBe(1);
  });

  it('landed straight on #/new (a reload): back replaces the address instead of leaving', () => {
    const history = new FakeHistory(`/jogo/?x=1${NEW_GAME_HASH}`);
    expect(screenOfHash(history.location.hash)).toBe('new');
    expect(leaveNewGame(history, history.location)).toBe('home');
    expect(history.url).toBe('/jogo/?x=1');
    expect(history.length).toBe(1);
  });

  it('a career created opens on the Clube tab, in place of the #/new entry', () => {
    const history = new FakeHistory('/jogo/');
    enterNewGame(history);
    expect(landOnClub(history)).toBe('home');
    expect(history.url).toBe('/jogo/#/club');
    expect(history.length).toBe(2);
  });

  it('back and forward switch the screen, unless a career or a full-screen error owns it', () => {
    expect(screenAfterPop('new', '', 'closed')).toBe('home');
    expect(screenAfterPop('home', NEW_GAME_HASH, 'closed')).toBe('new');
    expect(screenAfterPop('new', NEW_GAME_HASH, 'closed')).toBeUndefined();
    expect(screenAfterPop('home', '#/club', 'opening')).toBeUndefined();
    expect(screenAfterPop('new', '', 'open')).toBeUndefined();
    expect(screenAfterPop('new', '', 'fatal')).toBeUndefined();
  });

  it('closing the options sheet by back stays on the new game', () => {
    const history = new FakeHistory('/jogo/');
    enterNewGame(history);
    history.pushState({ ...(history.state as object), sheet: 'new-game-options' }, '');
    history.back();
    expect(screenAfterPop('new', history.location.hash, 'closed')).toBeUndefined();
  });
});
