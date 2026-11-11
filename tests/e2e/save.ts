import type { Page } from '@playwright/test';
import { validatePlayer } from '../../app/src/engine/index.ts';
import { continueCareer } from './career.ts';

/*
 * Leitura e ajuste do save da carreira mais recente no banco de teste (`prancheta-test`), para os
 * casos que uma partida sorteada não garante (um lesionado de 3 rodadas, um suspenso, uma
 * promessa). O ajuste regrava o snapshot da cabeça com o JSON novo, o tamanho e o SHA-256 (o
 * formato do ADR-0006: JSON em UTF-8 sem gzip desde a T-072) e reabre a carreira pela tela
 * inicial, como o jogador faria. Só para o E2E; o jogo nunca regrava um snapshot no lugar.
 *
 * Todo ajuste passa pelo mesmo `validatePlayer` que a abertura do save usa: um jogador fora dos
 * limites do esquema (por exemplo, potencial acima de 99) faria a carreira abrir como
 * `all-corrupt`, e com a semente sorteada a cada carreira o teste falharia ao acaso. Aqui ele
 * reprova na hora, dizendo o campo.
 */

/** O que os testes leem do save (o resto passa adiante sem ser tocado). */
export interface SaveJson {
  career: { clubId: string };
  game: {
    round: number;
    rules: { realism: 'full' | 'simplified' };
    clubs: Record<string, { fans: number; def: { shortName: string; rivals: string[] } }>;
    players: Record<string, Record<string, unknown>>;
    squads: Record<string, string[]>;
    fixtures: { round: number; homeId: string; awayId: string }[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** O save da carreira mais recente (o JSON do snapshot da cabeça). */
export async function readSave(page: Page): Promise<SaveJson> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('prancheta-test');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    const ask = <T>(request: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const careers = (await ask(db.transaction('careers').objectStore('careers').getAll())) as {
      id: string;
      headSeq: number;
      updatedAt: string;
    }[];
    const newest = careers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
    const record = (await ask(
      db.transaction('snapshots').objectStore('snapshots').get([newest.id, newest.headSeq]),
    )) as { blob: Uint8Array };
    db.close();
    return JSON.parse(new TextDecoder().decode(record.blob));
  });
}

/** A ficha do técnico gravada entre as rodadas (`careers.draft`, ADR-0021), se houver. */
export interface DraftJson {
  lineup: {
    formation: string;
    starters: (string | null)[];
    bench: (string | null)[];
    captains: string[];
    penaltyTakers: string[];
    freeKickTakers: string[];
  };
  tactic: { posture: string; pressure: string };
}

/** A ficha do registro da carreira mais recente (`undefined` antes da primeira gravação). */
export async function readDraft(page: Page): Promise<DraftJson | undefined> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('prancheta-test');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    const careers = await new Promise<{ updatedAt: string; draft?: { sheet: unknown } }[]>(
      (resolve, reject) => {
        const request = db.transaction('careers').objectStore('careers').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      },
    );
    db.close();
    const newest = careers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return newest?.draft?.sheet as DraftJson | undefined;
  });
}

/** Regrava o snapshot da cabeça da carreira mais recente com `save`. */
async function writeSave(page: Page, save: SaveJson): Promise<void> {
  await page.evaluate(async (json) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('prancheta-test');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    const ask = <T>(request: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const careers = (await ask(db.transaction('careers').objectStore('careers').getAll())) as {
      id: string;
      headSeq: number;
      updatedAt: string;
    }[];
    const newest = careers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
    const key = [newest.id, newest.headSeq];
    const record = (await ask(
      db.transaction('snapshots').objectStore('snapshots').get(key),
    )) as Record<string, unknown>;
    const blob = new TextEncoder().encode(json);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', blob));
    const sha256 = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
    const tx = db.transaction('snapshots', 'readwrite');
    await ask(tx.objectStore('snapshots').put({ ...record, blob, sha256, bytes: blob.byteLength }));
    db.close();
  }, JSON.stringify(save));
}

/** Muda campos de um jogador do save, só se ele continuar válido para o esquema do save. */
export function changePlayer(save: SaveJson, id: string, change: Record<string, unknown>): void {
  const next = { ...save.game.players[id]!, ...change };
  const checked = validatePlayer(next);
  if (!checked.ok) {
    throw new Error(`ajuste inválido do jogador ${id}: ${JSON.stringify(checked.detail)}`);
  }
  save.game.players[id] = next;
}

/** Ajusta o save da carreira mais recente e a reabre pela tela inicial. */
export async function patchSave(page: Page, change: (save: SaveJson) => void): Promise<SaveJson> {
  const save = await readSave(page);
  change(save);
  // Every player still valid, whatever the change touched (the opening checks them all).
  for (const [id, player] of Object.entries(save.game.players)) {
    const checked = validatePlayer(player);
    if (!checked.ok) {
      throw new Error(`save ajustado inválido, jogador ${id}: ${JSON.stringify(checked.detail)}`);
    }
  }
  await writeSave(page, save);
  await continueCareer(page);
  return save;
}

/**
 * Writes `json` as the head snapshot of the newest career, labelled as format `schemaVersion` in
 * the snapshot record and in the career row, like a build of that format would have left it. No
 * validation: it is how a career saved by an older build is put into the test database (T-078).
 */
export async function writeRawSnapshot(
  page: Page,
  json: string,
  schemaVersion: number,
): Promise<void> {
  await page.evaluate(
    async ({ text, version }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('prancheta-test');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => resolve(open.result);
      });
      const ask = <T>(request: IDBRequest<T>) =>
        new Promise<T>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const careers = (await ask(db.transaction('careers').objectStore('careers').getAll())) as {
        id: string;
        headSeq: number;
        updatedAt: string;
        schemaVersion?: number;
      }[];
      const newest = careers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
      const record = (await ask(
        db.transaction('snapshots').objectStore('snapshots').get([newest.id, newest.headSeq]),
      )) as Record<string, unknown>;
      const blob = new TextEncoder().encode(text);
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', blob));
      const sha256 = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
      const tx = db.transaction(['snapshots', 'careers'], 'readwrite');
      tx.objectStore('snapshots').put({
        ...record,
        blob,
        sha256,
        bytes: blob.byteLength,
        schemaVersion: version,
      });
      if ('schemaVersion' in newest) {
        tx.objectStore('careers').put({ ...newest, schemaVersion: version });
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    },
    { text: json, version: schemaVersion },
  );
}

/** The newest career's row and head snapshot record, as the store keeps them. */
export async function readHeadRecord(page: Page): Promise<{
  careerSchemaVersion: number | undefined;
  recordSchemaVersion: number;
  headSeq: number;
}> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('prancheta-test');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    const ask = <T>(request: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const careers = (await ask(db.transaction('careers').objectStore('careers').getAll())) as {
      id: string;
      headSeq: number;
      updatedAt: string;
      schemaVersion?: number;
    }[];
    const newest = careers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
    const record = (await ask(
      db.transaction('snapshots').objectStore('snapshots').get([newest.id, newest.headSeq]),
    )) as { schemaVersion: number };
    db.close();
    return {
      careerSchemaVersion: newest.schemaVersion,
      recordSchemaVersion: record.schemaVersion,
      headSeq: newest.headSeq,
    };
  });
}
