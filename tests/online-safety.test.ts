import { it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { PvpDatabase } from '../src/pvp/server/database';
import { OnlineHub } from '../src/online/server';
import { command } from '../src/domain/game';
import { createRaid, expirePersonalRaid } from '../src/raid/engine';
import {
  reserveFighter,
  releaseWaitingFighter,
  savePersonalRaid,
  recoverHeir,
} from '../src/online/raid-persistence';
import type { BoundFighter } from '../src/domain/model';
function fixture(db: PvpDatabase, id: string) {
  const s = db.online.read(id);
  command(s.state, { type: 'recruit' });
  command(s.state, {
    type: 'startRecruit',
    id: s.state.family.recruitment!.candidates[0].id,
    name: '안전성 검증',
  });
  const r = s.state.run!;
  command(s.state, { type: 'choose', offer: r.offers[0] });
  r.fighter.trainingPoints = 0;
  r.fighter.deferredTrainingPoints = 0;
  r.offers = [];
  r.fighter.augmentOffers = [];
  for (let wave = 1; wave <= 20; wave++) {
    r.phase = 'loot';
    r.offers = [];
    if (!command(s.state, { type: 'next' })) throw Error('Fixture transition failed');
  }
  db.online.write(id, s.revision, s.state);
  return s.state.family.roster[0] as BoundFighter;
}
class Socket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  messages: any[] = [];
  send(v: string) {
    this.messages.push(JSON.parse(v));
  }
  close() {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }
  terminate() {
    this.close();
  }
  input(v: unknown) {
    this.emit('message', Buffer.from(JSON.stringify(v)), false);
  }
}
it('a pending fatal outcome survives socket takeover; stale reads and mode changes stay blocked until the same commit succeeds', async () => {
  const db = new PvpDatabase(':memory:');
  let hub: OnlineHub | undefined;
  try {
    const a = await db.register('pendingcase', 'isolated-safety-password', '저장 검증');
    let s = db.online.read(a.id);
    db.online.apply(a.id, s.revision, randomUUID(), { type: 'recruit' });
    s = db.online.read(a.id);
    db.online.apply(a.id, s.revision, randomUUID(), {
      type: 'startRecruit',
      id: s.state.family.recruitment!.candidates[0].id,
      name: '미확정 무인',
    });
    s = db.online.read(a.id);
    db.online.apply(a.id, s.revision, randomUUID(), {
      type: 'choose',
      offer: s.state.run!.offers[0],
    });
    hub = new OnlineHub(
      db.online,
      () => true,
      () => false,
    );
    const first = new Socket();
    hub.accept(first as unknown as WebSocket, a.id, 'session');
    const original = db.online.write.bind(db.online),
      fail = vi.spyOn(db.online, 'write').mockImplementation((id, rev, state) => {
        state.run!.phase = 'dead';
        state.run!.fighter.hp = 0;
        throw Error('disk full');
      });
    first.input({ type: 'pause', value: false });
    first.input({
      type: 'input',
      seq: 0,
      input: { dx: 1, dy: 0, aim: 0, attack: false, defense: false, ultimate: false },
    });
    (hub as any).step();
    expect(hub.hasPending(a.id)).toBe(true);
    expect(() => hub!.read(a.id)).toThrow();
    const second = new Socket();
    hub.accept(second as unknown as WebSocket, a.id, 'new-session');
    expect(second.messages.some((m) => m.save)).toBe(false);
    second.input({ type: 'read' });
    expect(second.messages.at(-1).type).toBe('error');
    fail.mockRestore();
    (hub as any).step();
    expect(second.messages.at(-1).save.state.run.phase).toBe('dead');
    expect(db.online.read(a.id).state.run!.fighter.hp).toBe(0);
    expect(hub.hasPending(a.id)).toBe(false);
    expect(first.messages.filter((m) => m.save).at(-1).save.state.run.phase).toBe('combat');
  } finally {
    hub?.close();
    db.close();
  }
});
it('fighter reservation and waiting room are one transaction, including cancellation and expiry', async () => {
  const db = new PvpDatabase(':memory:');
  try {
    const a = await db.register('reservationcase', 'isolated-safety-password', '잠금 검증'),
      f = fixture(db, a.id);
    db.db.exec(
      "CREATE TEMP TRIGGER fail_waiting BEFORE INSERT ON online_raids BEGIN SELECT RAISE(ABORT,'disk failure'); END",
    );
    expect(() =>
      reserveFighter(db.online, a.id, f.id, 'ATOMIC', () => JSON.stringify({ code: 'ATOMIC' })),
    ).toThrow();
    expect(db.online.read(a.id).locked).toBeNull();
    expect(db.db.prepare('SELECT * FROM online_raids').all()).toHaveLength(0);
    db.db.exec('DROP TRIGGER fail_waiting');
    reserveFighter(db.online, a.id, f.id, 'ATOMIC', () => JSON.stringify({ code: 'ATOMIC' }));
    expect(db.online.read(a.id).locked).toBe('ATOMIC');
    releaseWaitingFighter(db.online, a.id, 'ATOMIC', null, f.expiresAt! + 1);
    const expired = db.online.read(a.id);
    expect(expired.locked).toBeNull();
    expect(expired.state.family.retired).toBe(1);
    expect(expired.state.family.warehouse).toHaveLength(f.items.length);
    expect(db.db.prepare('SELECT * FROM online_raids').all()).toHaveLength(0);
  } finally {
    db.close();
  }
});
it('in-raid expiry returns own gear and carried heirlooms, gives no death or silver, and never rewrites a confirmed death', async () => {
  const db = new PvpDatabase(':memory:');
  try {
    const a = await db.register('expiredowner', 'isolated-safety-password', '원주인'),
      b = await db.register('expiredcarrier', 'isolated-safety-password', '운반자'),
      fa = fixture(db, a.id),
      fb = fixture(db, b.id);
    reserveFighter(db.online, a.id, fa.id, 'EXPIRY');
    reserveFighter(db.online, b.id, fb.id, 'EXPIRY');
    const members = [
      { account: a, fighterId: fa.id },
      { account: b, fighterId: fb.id },
      null,
      null,
    ];
    let m = createRaid('expiry', [
      { name: fa.name, preset: 'sword', fighter: fa },
      { name: fb.name, preset: 'sword', fighter: fb },
    ]);
    m.phase = 'rest';
    m.status[0] = 'dead';
    m.players[0].fighter.hp = 0;
    m = savePersonalRaid(db.online, 'EXPIRY', members, m, (x) => JSON.stringify(x))!;
    recoverHeir(m, 1, m.heirs![0].id);
    const now = fb.expiresAt! + 1;
    expect(expirePersonalRaid(m, now)).toBe(true);
    expect(m.status[0]).toBe('dead');
    expect(m.status[1]).toBe('expired');
    m = savePersonalRaid(db.online, 'EXPIRY', members, m, (x) => JSON.stringify(x), now)!;
    expect(db.online.read(b.id).state.family.retired).toBe(1);
    expect(db.online.read(b.id).state.family.deaths).toBe(0);
    expect(db.online.read(b.id).state.family.silver ?? 0).toBe(0);
    expect(db.online.read(b.id).state.family.warehouse).toHaveLength(fb.items.length);
    expect(db.online.read(a.id).state.family.warehouse).toHaveLength(1);
    expect(db.raidHistory(b.id)[0].receipt?.outcome).toBe('expired');
    savePersonalRaid(db.online, 'EXPIRY', members, m, (x) => JSON.stringify(x), now);
    expect(db.online.read(a.id).state.family.deaths).toBe(1);
    expect(db.online.read(b.id).state.family.warehouse).toHaveLength(fb.items.length);
  } finally {
    db.close();
  }
});
