/**
 * Synthetic clubs for tests (docs/02-architecture.md, 3 "Dados de jogo"): until the approved
 * list arrives, and wherever a test needs clubs it can break on purpose, tests use
 * `Clube Teste 01`... instead of app/src/data/ (which the engine cannot import).
 *
 * Test-only code: never imported by `index.ts`.
 */
import type { ClubDef } from '../clubs.ts';
import type { ClubSize } from '../types.ts';

/** A mutable copy of ClubDef, so tests can break one field at a time. */
export type MutableClubDef = {
  -readonly [K in keyof ClubDef]: K extends 'colors'
    ? [string, string]
    : K extends 'rivals'
      ? string[]
      : K extends 'stadium'
        ? { name: string; capacity: number }
        : K extends 'titles'
          ? { league: number; cup: number }
          : ClubDef[K];
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Same split as the Série A list: 6 big, 8 medium, the rest small. */
function sizeAt(index: number): ClubSize {
  if (index < 6) return 'big';
  if (index < 14) return 'medium';
  return 'small';
}

/** "TAA", "TAB"...: three capital letters, unique for up to 676 clubs. */
function abbreviationAt(index: number): string {
  const letter = (n: number) => String.fromCharCode(65 + n);
  return `T${letter(Math.floor(index / 26) % 26)}${letter(index % 26)}`;
}

const STRENGTH: Record<ClubSize, number> = { big: 75, medium: 70, small: 64 };

/**
 * `count` valid clubs `clube-teste-01`... Clubs 01-02, 03-04... are derbies; the last four have
 * no rivals (like the approved list, where `rivals` may be empty).
 */
export function syntheticClubs(count = 20): MutableClubDef[] {
  const clubs: MutableClubDef[] = [];
  for (let i = 0; i < count; i++) {
    const n = pad(i + 1);
    const size = sizeAt(i);
    clubs.push({
      id: `clube-teste-${n}`,
      name: `Clube Teste ${n}`,
      shortName: `Teste ${n}`,
      abbreviation: abbreviationAt(i),
      nickname: `Testeiros ${n}`,
      city: `Cidade Teste ${n}`,
      state: 'SP',
      colors: ['#123456', '#fedcba'],
      size,
      aiProfile: 'traditional',
      strength: STRENGTH[size],
      stadium: { name: `Estádio Teste ${n}`, capacity: 20_000 + i * 1_000 },
      rivals: [],
      titles: { league: i % 3, cup: 0 },
    });
  }
  const paired = Math.max(0, count - 4);
  for (let i = 0; i + 1 < paired; i += 2) {
    clubs[i]!.rivals.push(clubs[i + 1]!.id);
    clubs[i + 1]!.rivals.push(clubs[i]!.id);
  }
  return clubs;
}
