import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { POSITIONS, attributeKeysFor, isProspect, type GameState, type Player } from '@engine';
import {
  formText,
  playerBadges,
  playerCard,
  shownCondition,
  sortOrDefault,
  sortPlayers,
  sortsFor,
  squadGroups,
  squadPlayers,
} from './squad';
import { TEST_CLUB, testCareer, withPlayer } from './testing/game';

/*
 * The reads of the Elenco and of the player card (elenco.md, jogador.md; US-016) on real
 * careers: the sorts and their ties, the badges, the form, the card's sections, the Realismo
 * simplificado without condition, and the rule that ui/ never reads the potential.
 */

const full = testCareer('full', 5);
const simplified = testCareer('simplified', 5);
const squad = squadPlayers(full, TEST_CLUB);
const order = (list: readonly Player[]) => list.map((p) => p.id);

describe('the sorts (elenco.md, "Ordenar por")', () => {
  it('offers Condição only in Realismo completo; an unknown sort falls back to Posição', () => {
    expect(sortsFor('full')).toEqual(['position', 'overall', 'condition']);
    expect(sortsFor('simplified')).toEqual(['position', 'overall']);
    expect(sortOrDefault('condition', 'simplified')).toBe('position');
    expect(sortOrDefault('overall', 'simplified')).toBe('overall');
    expect(sortOrDefault('condition', 'full')).toBe('condition');
  });

  it('lists the 25 of the squad in squad order', () => {
    expect(squad).toHaveLength(25);
    expect(order(squad)).toEqual(full.squads[TEST_CLUB]);
  });

  it('Posição: GOL to ATA, then the overall descending, then the squad order', () => {
    const sorted = sortPlayers(squad, 'position');
    const index = new Map(squad.map((p, i) => [p.id, i]));
    for (let i = 1; i < sorted.length; i++) {
      const [a, b] = [sorted[i - 1]!, sorted[i]!];
      const pa = POSITIONS.indexOf(a.position);
      const pb = POSITIONS.indexOf(b.position);
      expect(pa).toBeLessThanOrEqual(pb);
      if (pa === pb) {
        expect(a.overall).toBeGreaterThanOrEqual(b.overall);
        if (a.overall === b.overall) expect(index.get(a.id)!).toBeLessThan(index.get(b.id)!);
      }
    }
  });

  it('Nota: overall descending, ties by position', () => {
    const sorted = sortPlayers(squad, 'overall');
    for (let i = 1; i < sorted.length; i++) {
      const [a, b] = [sorted[i - 1]!, sorted[i]!];
      expect(a.overall).toBeGreaterThanOrEqual(b.overall);
      if (a.overall === b.overall) {
        expect(POSITIONS.indexOf(a.position)).toBeLessThanOrEqual(POSITIONS.indexOf(b.position));
      }
    }
  });

  it('Condição: the shown condition ascending (the most tired first), ties by overall descending', () => {
    let game: GameState = full;
    const [a, b, c] = squad;
    game = withPlayer(game, a!.id, { condition: 70.4, overall: 60 });
    game = withPlayer(game, b!.id, { condition: 69.6, overall: 70 });
    game = withPlayer(game, c!.id, { condition: 55 });
    const sorted = sortPlayers(squadPlayers(game, TEST_CLUB), 'condition');
    expect(sorted[0]!.id).toBe(c!.id);
    // 69.6 and 70.4 both show 70: the better overall first.
    expect(sorted.findIndex((p) => p.id === b!.id)).toBeLessThan(
      sorted.findIndex((p) => p.id === a!.id),
    );
    for (let i = 1; i < sorted.length; i++) {
      expect(shownCondition(sorted[i - 1]!)).toBeLessThanOrEqual(shownCondition(sorted[i]!));
    }
  });

  it('never changes its input', () => {
    const before = order(squad);
    sortPlayers(squad, 'overall');
    expect(order(squad)).toEqual(before);
  });

  it('groups by position only with Posição', () => {
    const groups = squadGroups(sortPlayers(squad, 'position'), 'position', 'pt-BR');
    expect(groups.map((g) => g.label)).toEqual([
      'Goleiros',
      'Zagueiros',
      'Laterais',
      'Volantes',
      'Meias',
      'Atacantes',
    ]);
    expect(groups.flatMap((g) => g.players)).toHaveLength(25);
    const flat = squadGroups(sortPlayers(squad, 'overall'), 'overall', 'pt-BR');
    expect(flat).toHaveLength(1);
    expect(flat[0]!.label).toBeUndefined();
  });
});

describe('the badges (US-016, "situação nunca só por cor")', () => {
  const [p] = squad;
  const plain = { ...p!, injuryRounds: 0, suspendedGames: 0 };

  it('injured with the rounds and suspended, as text from the content', () => {
    expect(playerBadges({ ...plain, injuryRounds: 3 }, 'full', 'pt-BR')).toContainEqual({
      kind: 'injured',
      label: 'Lesionado, 3 rodadas',
    });
    expect(playerBadges({ ...plain, injuryRounds: 1 }, 'full', 'pt-BR')).toContainEqual({
      kind: 'injured',
      label: 'Lesionado, 1 rodada',
    });
    const suspended = playerBadges({ ...plain, suspendedGames: 1 }, 'full', 'pt-BR');
    expect(suspended.map((b) => b.kind)).toContain('suspended');
    expect(suspended.find((b) => b.kind === 'suspended')!.label).toMatch(/^Suspenso/);
  });

  it('none of the two in Realismo simplificado', () => {
    const out = { ...plain, injuryRounds: 3, suspendedGames: 1 };
    expect(playerBadges(out, 'simplified', 'pt-BR').filter((b) => b.kind !== 'prospect')).toEqual(
      [],
    );
  });

  it('"Promessa" exactly for the players the engine marks, in both realisms', () => {
    const everyone = Object.values(full.players);
    const prospect = everyone.find((x) => isProspect(x))!;
    const other = everyone.find((x) => !isProspect(x))!;
    expect(prospect).toBeDefined();
    for (const realism of ['full', 'simplified'] as const) {
      expect(playerBadges(prospect, realism, 'pt-BR')).toContainEqual({
        kind: 'prospect',
        label: 'Promessa',
      });
      expect(playerBadges(other, realism, 'pt-BR').map((b) => b.kind)).not.toContain('prospect');
    }
  });
});

describe('the form', () => {
  const [p] = squad;
  it('one decimal in the language; none without games', () => {
    expect(formText({ ...p!, recentRatings: [6, 7, 8, 7, 6] }, 'pt-BR')).toBe('6,8');
    expect(formText({ ...p!, recentRatings: [7] }, 'pt-BR')).toBe('7,0');
    expect(formText({ ...p!, recentRatings: [6, 7, 8, 7, 6] }, 'en')).toBe('6.8');
    expect(formText({ ...p!, recentRatings: [] }, 'pt-BR')).toBeUndefined();
  });
});

describe('the player card (jogador.md)', () => {
  const striker = squad.find((p) => p.position === 'ST')!;
  const keeper = squad.find((p) => p.position === 'GK')!;

  it('has the full name, position, age and shirt, and the 6 attributes in the order of the engine', () => {
    for (const player of [striker, keeper]) {
      const card = playerCard(full, TEST_CLUB, player.id, 'pt-BR')!;
      expect(card.title).toBe(player.name.full);
      expect(card.attributes.map((a) => a.id)).toEqual(attributeKeysFor(player.position));
      for (const a of card.attributes) {
        expect(a.value).toBe(player.attributes[a.id as keyof typeof player.attributes]);
        expect(a.value).toBeGreaterThanOrEqual(1);
        expect(a.value).toBeLessThanOrEqual(99);
      }
      expect(card.facts.map((f) => f.value)).toEqual([
        `${player.age} anos`,
        `Camisa ${player.shirt}`,
      ]);
      expect(card.overall).toBe(player.overall);
    }
    expect(playerCard(full, TEST_CLUB, keeper.id, 'pt-BR')!.positionLabel).toBe('Goleiro');
  });

  it('has the trait and the season games and goals, zeros included', () => {
    const card = playerCard(full, TEST_CLUB, striker.id, 'pt-BR')!;
    const stats = full.seasonStats[striker.id];
    expect(card.trait.name).not.toMatch(/^trait\./);
    expect(card.trait.description).not.toMatch(/^trait\./);
    expect(card.season).toEqual([
      { label: 'Jogos', value: String(stats?.games ?? 0) },
      { label: 'Gols', value: String(stats?.goals ?? 0) },
    ]);
    const before = playerCard(testCareer('full', 1), TEST_CLUB, striker.id, 'pt-BR')!;
    expect(before.season.map((f) => f.value)).toEqual(['0', '0']);
    expect(before.states.find((s) => s.id === 'form')).toMatchObject({
      value: undefined,
      emptyText: 'Sem jogos ainda',
    });
  });

  it('condition only in Realismo completo; morale and form in both', () => {
    const id = squadPlayers(simplified, TEST_CLUB)[0]!.id;
    expect(playerCard(full, TEST_CLUB, squad[0]!.id, 'pt-BR')!.states.map((s) => s.id)).toEqual([
      'condition',
      'morale',
      'form',
    ]);
    expect(playerCard(simplified, TEST_CLUB, id, 'pt-BR')!.states.map((s) => s.id)).toEqual([
      'morale',
      'form',
    ]);
  });

  it('has no card for a player not in the squad (a stale id in the history)', () => {
    expect(playerCard(full, TEST_CLUB, 'nobody', 'pt-BR')).toBeUndefined();
    const elsewhere = Object.values(full.players).find((p) => p.clubId !== TEST_CLUB)!;
    expect(playerCard(full, TEST_CLUB, elsewhere.id, 'pt-BR')).toBeUndefined();
  });
});

describe('the potential never reaches the interface (US-016; 4.1, BLOCKER of review)', () => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  /** The production files of ui/ (the tests are not the screen). */
  function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) sources(path, out);
      else if (/\.(ts|svelte)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path);
    }
    return out;
  }
  /** The code without its comments, which may name the rule. */
  const code = (text: string) =>
    text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const reads = (text: string) => /\bpotential\b/.test(code(text));

  it('the search sees a read and ignores a comment', () => {
    expect(reads('const p = player.potential;')).toBe(true);
    expect(reads('const { potential } = player;')).toBe(true);
    expect(reads('// the potential is hidden\n/* potential */\n<!-- potential -->')).toBe(false);
  });

  it('no file of ui/ reads it; the "promessa" comes from isProspect', () => {
    const files = sources(root);
    expect(files.length).toBeGreaterThan(20);
    const found = files.filter((f) => reads(readFileSync(f, 'utf8')));
    expect(found).toEqual([]);
    expect(readFileSync(join(root, 'squad.ts'), 'utf8')).toContain('isProspect(player)');
  });
});
