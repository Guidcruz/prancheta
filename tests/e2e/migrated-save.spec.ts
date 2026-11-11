import { continueCareer, nextRound, saveSettled, startCareer } from './career.ts';
import { expect, playButton, test } from './fixtures.ts';
import { readHeadRecord, readSave, writeRawSnapshot, type SaveJson } from './save.ts';

/*
 * T-078 in the browser: a career saved by a v2 build opens in this build with the same round, the
 * same fixtures and results (hence the same table), the same squads and strengths, and the same
 * secondaries a new game of that seed draws (the frozen migration chance equals the parameter
 * today); after a reload nothing moves, and the migrated career keeps playing.
 */

const secondaries = (save: SaveJson) =>
  Object.fromEntries(
    Object.entries(save.game.players)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, p]) => [id, p.secondaryPosition]),
  );

/** What a v2 build would have written: no `secondaryPosition`, format 2. */
function asV2(save: SaveJson): string {
  const copy = structuredClone(save);
  copy.schemaVersion = 2;
  for (const player of Object.values(copy.game.players)) delete player.secondaryPosition;
  return JSON.stringify(copy);
}

/** Everything the player can see or that the engine reads, without the stamps a rewrite changes. */
const stable = (save: SaveJson) => {
  const { updatedAt: _u, appVersion: _a, ...rest } = save as Record<string, unknown>;
  return rest;
};

test('a v2 career opens migrated: same round and table, same secondaries, stable after reload', async ({
  page,
}) => {
  await startCareer(page);
  for (let i = 0; i < 2; i++) {
    const next = await nextRound(page);
    await playButton(page).click();
    await expect.poll(() => nextRound(page)).toBe(next + 1);
    await saveSettled(page);
  }
  const original = await readSave(page);
  expect(original.schemaVersion).toBe(3);
  expect(original.game.round).toBeGreaterThan(1);
  const played = original.game.fixtures.filter((f) => (f as { result?: unknown }).result != null);
  expect(played.length).toBeGreaterThan(0);
  const withSecondary = Object.values(original.game.players).filter(
    (p) => p.secondaryPosition !== null,
  );
  expect(withSecondary.length).toBeGreaterThan(100);

  // Puts the career back as a v2 build left it, then opens it from the home screen.
  await writeRawSnapshot(page, asV2(original), 2);
  expect((await readHeadRecord(page)).recordSchemaVersion).toBe(2);
  await continueCareer(page);
  expect(await nextRound(page)).toBe(original.game.round);

  const migrated = await expect
    .poll(async () => (await readSave(page)).schemaVersion, { timeout: 10_000 })
    .toBe(3)
    .then(() => readSave(page));
  expect(migrated.game.round).toBe(original.game.round);
  expect(migrated.game.fixtures).toEqual(original.game.fixtures);
  expect(migrated.game.squads).toEqual(original.game.squads);
  expect(secondaries(migrated)).toEqual(secondaries(original));
  expect(stable(migrated)).toEqual(stable(original));
  const record = await readHeadRecord(page);
  expect(record.recordSchemaVersion).toBe(3);
  if (record.careerSchemaVersion !== undefined) expect(record.careerSchemaVersion).toBe(3);

  // After a reload, the same career, the same data, no further migration step.
  await page.reload();
  await continueCareer(page);
  expect(await nextRound(page)).toBe(original.game.round);
  const reloaded = await readSave(page);
  expect(stable(reloaded)).toEqual(stable(original));
  expect((await readHeadRecord(page)).headSeq).toBe(record.headSeq);

  // And it keeps playing: one more round, still v3, secondaries untouched.
  await playButton(page).click();
  await expect.poll(() => nextRound(page)).toBe(original.game.round + 1);
  await saveSettled(page);
  const after = await readSave(page);
  expect(after.schemaVersion).toBe(3);
  expect(secondaries(after)).toEqual(secondaries(original));
});
