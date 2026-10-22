import { expect, it } from 'vitest';
import { PvpDatabase } from '../src/pvp/server/database';
import { createPvpMatch, finishPvp } from '../src/pvp/engine';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
it('login uses salted credentials; ranked settlement is atomic, idempotent and survives reopen', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugong-pvp-')),
    path = join(dir, 'online.sqlite');
  let db = new PvpDatabase(path);
  try {
    const a = await db.register('testone', 'test-only-password-1', '서버 검증 일'),
      b = await db.register('testtwo', 'test-only-password-2', '서버 검증 이');
    expect(await db.login('testone', 'wrong-password')).toBeNull();
    expect((await db.login('testone', 'test-only-password-1'))?.id).toBe(a.id);
    const m = createPvpMatch('ranked-one', 'ranked', [
      { name: a.name, preset: 'sword' },
      { name: b.name, preset: 'monk' },
    ]);
    db.begin(m, a.id, b.id);
    expect(() => new PvpDatabase(path)).toThrow(/locked/);
    finishPvp(m, 0, 'surrender');
    const first = db.settle(m),
      second = db.settle(m);
    expect(second).toEqual(first);
    expect(first.deltas).toEqual([12, -12]);
    expect(db.account(a.id)?.rating).toBe(1012);
    expect(db.account(b.id)?.rating).toBe(988);
    expect(db.account(a.id)?.matches).toBe(1);
    expect(db.rankings()[0].id).toBe(a.id);
    db.close();
    db = new PvpDatabase(path);
    expect(db.account(a.id)?.rating).toBe(1012);
    expect(db.history(a.id)).toHaveLength(1);
    const cancelled = createPvpMatch('interrupted', 'ranked', [
      { name: a.name, preset: 'sword' },
      { name: b.name, preset: 'sword' },
    ]);
    db.begin(cancelled, a.id, b.id);
    db.close();
    db = new PvpDatabase(path);
    expect(db.history(a.id)[0].state).toBe('void');
    expect(db.account(a.id)?.rating).toBe(1012);
    expect(db.db.prepare('SELECT hash FROM accounts WHERE id=?').get(a.id)?.hash).not.toBe(
      'test-only-password-1',
    );
  } finally {
    db.close();
    for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
    rmdirSync(dir);
  }
});
it('friendly and abandoned matches never update rankings; same-account opponents are rejected', async () => {
  const db = new PvpDatabase(':memory:');
  try {
    const a = await db.register('trialone', 'test-only-password-1', '친선 검증 일'),
      b = await db.register('trialtwo', 'test-only-password-2', '친선 검증 이');
    for (const mode of ['friendly', 'ranked'] as const) {
      const m = createPvpMatch(mode, mode, [
        { name: a.name, preset: 'sword' },
        { name: b.name, preset: 'sword' },
      ]);
      db.begin(m, a.id, b.id);
      finishPvp(m, mode === 'friendly' ? 0 : null, mode === 'friendly' ? 'surrender' : 'abandoned');
      db.settle(m);
    }
    expect(db.account(a.id)?.matches).toBe(0);
    expect(db.rankings()).toEqual([]);
    const m = createPvpMatch('bad', 'ranked', [
      { name: a.name, preset: 'sword' },
      { name: a.name, preset: 'sword' },
    ]);
    expect(() => db.begin(m, a.id, a.id)).toThrow();
  } finally {
    db.close();
  }
});
