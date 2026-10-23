import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { emptyGame, command, expireFighters } from '../domain/game';
import { recruitmentView } from '../domain/recruitment';
import type { Command, GameState } from '../domain/model';
import type { OnlineSave } from './protocol';
import { isGameSave } from '../platform/save-validation';
export class OnlineRepository {
  private depth = 0;
  constructor(readonly db: DatabaseSync) {}
  transaction<T>(fn: () => T): T {
    if (this.depth) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    this.depth++;
    try {
      const value = fn();
      this.db.exec('COMMIT');
      return value;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    } finally {
      this.depth--;
    }
  }
  read(account: string): OnlineSave {
    let row = this.db.prepare('SELECT * FROM online_families WHERE account=?').get(account);
    if (!row) {
      const state = emptyGame();
      state.family.recruitment = recruitmentView(state.family, Date.now());
      this.db
        .prepare('INSERT INTO online_families(account,revision,commit_id,state) VALUES(?,0,?,?)')
        .run(account, randomUUID(), JSON.stringify(state));
      row = this.db.prepare('SELECT * FROM online_families WHERE account=?').get(account)!;
    }
    const state: unknown = JSON.parse(String(row.state));
    if (!isGameSave(state)) throw Error('온라인 저장 검증 실패: 이전 기록으로 되돌리지 않습니다');
    const locked = this.db
      .prepare('SELECT room FROM online_reservations WHERE account=?')
      .get(account);
    return {
      revision: Number(row.revision),
      commit: String(row.commit_id),
      state,
      locked: locked ? String(locked.room) : null,
    };
  }
  write(account: string, previous: number, state: GameState) {
    // Validate the same durable schema as the local domain, without importing browser storage.
    if (!isGameSave(state)) throw Error('온라인 저장 검증 실패');
    const commit = randomUUID();
    const result = this.db
      .prepare(
        'UPDATE online_families SET revision=revision+1,commit_id=?,state=? WHERE account=? AND revision=?',
      )
      .run(commit, JSON.stringify(state), account, previous);
    if (result.changes !== 1) throw Error('서버 저장이 변경되었습니다. 다시 확인하세요');
    return this.read(account);
  }
  refresh(account: string, now = Date.now()) {
    const save = this.read(account);
    if (!save.locked && expireFighters(save.state, now))
      return this.write(account, save.revision, save.state);
    return save;
  }
  apply(account: string, revision: number, op: string, intent: Command, now = Date.now()) {
    return this.transaction(() => {
      const repeated = this.db
        .prepare('SELECT intent FROM online_operations WHERE account=? AND op=?')
        .get(account, op);
      if (repeated) {
        if (repeated.intent !== JSON.stringify(intent))
          throw Error('다른 요청에 사용된 작업 번호입니다');
        return this.read(account);
      }
      const current = this.read(account);
      if (current.locked) throw Error('레이드 출전 중에는 세가 물품을 변경할 수 없습니다');
      if (current.revision !== revision) throw Error('서버 저장이 변경되었습니다. 다시 확인하세요');
      expireFighters(current.state, now);
      if (intent.type === 'bind' && current.state.run?.phase === 'combat')
        throw Error('전투 중에는 장비를 변경할 수 없습니다');
      if (!command(current.state, intent, now)) throw Error('지금은 할 수 없는 행동입니다');
      if (['startRecruit', 'startBasic'].includes(intent.type) && current.state.run) {
        const run = current.state.run,
          old = run.fighter.id,
          id = randomUUID();
        run.id = id;
        run.fighter.id = id;
        for (const item of run.fighter.items) item.id = item.id.replace(old, id);
        const f = run.fighter as import('../domain/model').BoundFighter;
        if (f.bindings)
          for (const art of Object.keys(f.bindings) as import('../domain/model').ArtId[])
            f.bindings[art] = f.bindings[art]?.replace(old, id);
      }
      const next = this.write(account, revision, current.state);
      this.db
        .prepare('INSERT INTO online_operations(account,op,intent,revision) VALUES(?,?,?,?)')
        .run(account, op, JSON.stringify(intent), next.revision);
      // Keep all operation identities: a delayed duplicate must never charge twice.
      return next;
    });
  }
}
