import type { GameState } from '../domain/model';
import { decodeCurrentSave } from './save-migrations';
const DB = 'mugong-local-v1',
  STORE = 'saves';
let database: Promise<IDBDatabase> | undefined;
function guardTransaction(tx: IDBTransaction) {
  const timer = window.setTimeout(() => {
    try {
      tx.abort();
    } catch {
      /* Already completed. */
    }
  }, 15000);
  const clear = () => clearTimeout(timer);
  tx.addEventListener('complete', clear, { once: true });
  tx.addEventListener('abort', clear, { once: true });
  return tx;
}
function open() {
  if (database) return database;
  const connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    let settled = false;
    const timer = window.setTimeout(() => fail(), 15000);
    function fail() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      database = undefined;
      reject(new Error('저장 공간을 열 수 없습니다. 다른 게임 탭을 닫고 다시 시도해 주세요.'));
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = fail;
    request.onblocked = fail;
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        database = undefined;
      };
      db.onclose = () => {
        database = undefined;
      };
      resolve(db);
    };
  });
  database = connection;
  return connection;
}
export async function readRawSave(): Promise<unknown> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = guardTransaction(db.transaction(STORE, 'readonly'));
    const request = tx.objectStore(STORE).get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error ?? new Error('저장에 실패했습니다.'));
  });
}
export async function readSave(): Promise<GameState | null> {
  const state = await readRawSave();
  if (state === undefined) return null;
  const decoded = decodeCurrentSave(state);
  if (!decoded) throw new Error('저장 형식을 읽을 수 없습니다. 기존 저장은 보존됩니다.');
  return decoded;
}

type SaveMeta = { revision: number; updatedAt: number };
export async function writeSave(state: GameState): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = guardTransaction(db.transaction(STORE, 'readwrite'));
    const saves = tx.objectStore(STORE);
    const metadata = saves.get('save-meta');
    metadata.onsuccess = () => {
      const old = metadata.result as SaveMeta | undefined;
      const revision =
        old && Number.isSafeInteger(old.revision) && old.revision >= 0 ? old.revision + 1 : 1;
      // Mirror and current commit atomically. Only this latest copy is eligible to recover.
      saves.put(state, 'current');
      saves.put({ revision, state }, `verified-${revision % 3}`);
      saves.put({ revision, updatedAt: Date.now() } satisfies SaveMeta, 'save-meta');
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('저장에 실패했습니다.'));
    tx.onabort = () => reject(tx.error ?? new Error('저장이 중단됐습니다.'));
  });
}

export async function readRecoveryCopy(): Promise<GameState | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = guardTransaction(db.transaction(STORE, 'readonly'));
    const saves = tx.objectStore(STORE),
      meta = saves.get('save-meta');
    meta.onsuccess = () => {
      const revision = (meta.result as SaveMeta | undefined)?.revision;
      if (!Number.isSafeInteger(revision) || !revision || revision < 1) {
        resolve(null);
        return;
      }
      const copy = saves.get(`verified-${revision % 3}`);
      copy.onsuccess = () =>
        resolve(copy.result?.revision === revision ? decodeCurrentSave(copy.result.state) : null);
      copy.onerror = () => reject(copy.error);
    };
    meta.onerror = () => reject(meta.error);
    tx.onabort = () => reject(tx.error ?? new Error('저장에 실패했습니다.'));
  });
}

export async function recoverLatestCopy() {
  const copy = await readRecoveryCopy();
  if (!copy) throw new Error('복구할 최신 검증 사본이 없습니다. 원본을 내보내 보관하세요.');
  const db = await open();
  // Preserve the original. A historical checkpoint is never offered as gameplay rollback.
  await new Promise<void>((resolve, reject) => {
    const tx = guardTransaction(db.transaction(STORE, 'readwrite'));
    const saves = tx.objectStore(STORE),
      raw = saves.get('current');
    raw.onsuccess = () => {
      saves.put({ capturedAt: Date.now(), state: raw.result }, 'unreadable-original');
      saves.put(copy, 'current');
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('저장에 실패했습니다.'));
    tx.onabort = () => reject(tx.error ?? new Error('저장이 중단됐습니다.'));
  });
}

export async function exportOriginalSave() {
  const raw = await readRawSave();
  const body = JSON.stringify(
    { format: 'mugong-original-v1', exportedAt: Date.now(), save: raw },
    (_key, value) => (typeof value === 'bigint' ? { bigint: value.toString() } : value),
    2,
  );
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `mugong-save-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
