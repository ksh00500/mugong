import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { OnlineAccount, PvpMatch, MatchReceipt } from '../model';
import type { RaidReceipt } from '../../raid/model';
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, key) =>
      e ? reject(e) : resolve(key),
    ),
  );
type AccountRow = OnlineAccount & { login: string; salt: string; hash: string };
export class PvpDatabase {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    try {
      // Rooms are in memory: a second process must not invalidate the active owner's matches.
      this.db.exec(
        'PRAGMA busy_timeout=1000; PRAGMA locking_mode=EXCLUSIVE; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;',
      );
      const version = this.db.prepare('PRAGMA user_version').get()!.user_version as number;
      if (version > 2) throw Error('Unsupported online database version');
      this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, rating INTEGER NOT NULL DEFAULT 1000, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0, matches INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id), expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY, a TEXT NOT NULL REFERENCES accounts(id), b TEXT NOT NULL REFERENCES accounts(id), state TEXT NOT NULL, mode TEXT NOT NULL, receipt TEXT, created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS result_a ON results(a,created); CREATE INDEX IF NOT EXISTS result_b ON results(b,created);
      CREATE TABLE IF NOT EXISTS raid_results(run TEXT NOT NULL, account TEXT NOT NULL REFERENCES accounts(id), state TEXT NOT NULL, floor INTEGER NOT NULL DEFAULT 0, receipt TEXT, created INTEGER NOT NULL, PRIMARY KEY(run,account));
      CREATE INDEX IF NOT EXISTS raid_account ON raid_results(account,created);`);
      // In-memory rooms cannot survive a process restart. Never invent a winner.
      this.db.prepare("UPDATE results SET state='void' WHERE state='playing'").run();
      this.db.prepare("UPDATE raid_results SET state='void' WHERE state='playing'").run();
      this.db.exec('PRAGMA user_version=2');
    } catch (e) {
      this.db.close();
      throw e;
    }
  }
  account(id: string): OnlineAccount | null {
    return (
      (this.db
        .prepare('SELECT id,name,rating,wins,losses,draws,matches FROM accounts WHERE id=?')
        .get(id) as unknown as OnlineAccount) ?? null
    );
  }
  async register(login: string, password: string, name: string) {
    if (
      !/^[a-z0-9_-]{3,20}$/.test(login) ||
      password.length < 10 ||
      password.length > 128 ||
      [...name.trim()].length < 2 ||
      [...name.trim()].length > 16 ||
      /[\p{C}]/u.test(name)
    )
      throw Error('아이디·비밀번호·이름의 형식을 확인하세요');
    if (this.db.prepare('SELECT id FROM accounts WHERE login=?').get(login))
      throw Error('이미 사용 중인 아이디입니다');
    const salt = randomBytes(16).toString('hex'),
      hash = (await derive(password, salt)).toString('hex'),
      id = randomUUID();
    try {
      this.db
        .prepare('INSERT INTO accounts(id,login,name,salt,hash) VALUES(?,?,?,?,?)')
        .run(id, login, name.trim(), salt, hash);
    } catch {
      throw Error('이미 사용 중인 아이디입니다');
    }
    return this.account(id)!;
  }
  async login(login: string, password: string) {
    if (typeof password !== 'string' || password.length > 128 || !/^[a-z0-9_-]{3,20}$/.test(login))
      return null;
    const row = this.db.prepare('SELECT * FROM accounts WHERE login=?').get(login) as unknown as
      AccountRow | undefined;
    const salt = row?.salt ?? '00000000000000000000000000000000',
      key = await derive(password, salt);
    if (!row || !timingSafeEqual(key, Buffer.from(row.hash, 'hex'))) return null;
    return this.account(row.id);
  }
  begin(m: PvpMatch, a: string, b: string) {
    if (a === b) throw Error('동일 계정끼리는 대전할 수 없습니다');
    this.db
      .prepare('INSERT INTO results(id,a,b,state,mode,created) VALUES(?,?,?,?,?,?)')
      .run(m.id, a, b, 'playing', m.mode, Date.now());
  }
  settle(m: PvpMatch): MatchReceipt {
    if (m.phase !== 'finished' || !m.reason) throw Error('아직 종료되지 않은 경기입니다');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT * FROM results WHERE id=?').get(m.id) as
        { a: string; b: string; state: string; receipt: string } | undefined;
      if (!row) throw Error('경기 원장이 없습니다');
      if (row.state === 'complete') {
        this.db.exec('COMMIT');
        return JSON.parse(row.receipt) as MatchReceipt;
      }
      if (row.state !== 'playing') throw Error('무효 처리된 경기입니다');
      const accounts = [this.account(row.a)!, this.account(row.b)!] as const;
      const deltas: [number, number] = [0, 0];
      if (m.mode === 'ranked' && m.reason !== 'abandoned' && m.reason !== 'server-restart') {
        const expected = 1 / (1 + 10 ** ((accounts[1].rating - accounts[0].rating) / 400));
        deltas[0] = Math.round(
          24 * ((m.winner === null ? 0.5 : m.winner === 0 ? 1 : 0) - expected),
        );
        deltas[1] = -deltas[0];
        for (const seat of [0, 1] as const)
          this.db
            .prepare(
              'UPDATE accounts SET rating=rating+?, wins=wins+?, losses=losses+?, draws=draws+?, matches=matches+1 WHERE id=?',
            )
            .run(
              deltas[seat],
              Number(m.winner === seat),
              Number(m.winner !== null && m.winner !== seat),
              Number(m.winner === null),
              accounts[seat].id,
            );
      }
      const receipt: MatchReceipt = {
        id: m.id,
        mode: m.mode,
        winner: m.winner,
        reason: m.reason,
        names: [accounts[0].name, accounts[1].name],
        scores: [...m.wins],
        ratings: [accounts[0].rating + deltas[0], accounts[1].rating + deltas[1]],
        deltas,
        finishedAt: Date.now(),
      };
      this.db
        .prepare("UPDATE results SET state='complete',receipt=? WHERE id=? AND state='playing'")
        .run(JSON.stringify(receipt), m.id);
      this.db.exec('COMMIT');
      return receipt;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  history(id: string) {
    return this.db
      .prepare(
        'SELECT id,mode,state,receipt,created FROM results WHERE a=? OR b=? ORDER BY created DESC LIMIT 20',
      )
      .all(id, id)
      .map((row) => ({
        id: row.id,
        mode: row.mode,
        state: row.state,
        created: row.created,
        receipt: row.receipt ? JSON.parse(row.receipt as string) : null,
      }));
  }
  rankings() {
    return this.db
      .prepare(
        'SELECT id,name,rating,wins,losses,draws,matches FROM accounts WHERE matches>0 ORDER BY rating DESC,wins DESC,id ASC LIMIT 100',
      )
      .all() as unknown as OnlineAccount[];
  }
  beginRaid(run: string, accounts: readonly string[]) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const account of accounts)
        this.db
          .prepare("INSERT INTO raid_results(run,account,state,created) VALUES(?,?,'playing',?)")
          .run(run, account, Date.now());
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  checkpointRaid(run: string, floor: number) {
    this.db
      .prepare("UPDATE raid_results SET floor=MAX(floor,?) WHERE run=? AND state='playing'")
      .run(floor, run);
  }
  settleRaid(account: string, receipt: RaidReceipt): RaidReceipt {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db
        .prepare('SELECT state,receipt FROM raid_results WHERE run=? AND account=?')
        .get(receipt.runId, account);
      if (!row || row.state === 'void') throw Error('Raid ledger unavailable');
      if (row.state === 'complete') {
        this.db.exec('COMMIT');
        return JSON.parse(row.receipt as string);
      }
      this.db
        .prepare(
          "UPDATE raid_results SET state='complete',floor=?,receipt=? WHERE run=? AND account=?",
        )
        .run(receipt.floor, JSON.stringify(receipt), receipt.runId, account);
      this.db.exec('COMMIT');
      return receipt;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  raidHistory(account: string) {
    return this.db
      .prepare(
        'SELECT run,state,floor,receipt,created FROM raid_results WHERE account=? ORDER BY created DESC LIMIT 20',
      )
      .all(account)
      .map((r) => ({
        run: String(r.run),
        state: String(r.state),
        floor: Number(r.floor),
        created: Number(r.created),
        receipt: r.receipt ? (JSON.parse(r.receipt as string) as RaidReceipt) : null,
      }));
  }
  close() {
    this.db.close();
  }
}
