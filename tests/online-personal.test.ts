import { it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PvpDatabase } from '../src/pvp/server/database';
import { onlineCommand, onlineInput } from '../src/online/protocol';
import { command } from '../src/domain/game';
import { createRaid } from '../src/raid/engine';
import {
  reserveFighter,
  savePersonalRaid,
  recoverHeir,
  raidPersonalCommand,
  carriedItems,
} from '../src/online/raid-persistence';
import type { Command, BoundFighter } from '../src/domain/model';
import type { RaidState } from '../src/raid/model';
async function account(db: PvpDatabase, id = 'first') {
  return (await db.register(id, 'personal-test-password', id)).id;
}
function apply(db: PvpDatabase, id: string, c: Command, op = randomUUID()) {
  return db.online.apply(id, db.online.read(id).revision, op, c);
}
// Domain transition fixture, not a claim of playing twenty normal waves.
export function graduate(db: PvpDatabase, id: string) {
  apply(db, id, { type: 'recruit' });
  let save = db.online.read(id);
  apply(db, id, {
    type: 'startRecruit',
    id: save.state.family.recruitment!.candidates[0].id,
    name: '온라인 무인',
  });
  save = db.online.read(id);
  const state = save.state,
    r = state.run!;
  r.fighter.trainingPoints = 1;
  r.offers = [{ art: 'tang', type: 'learn' }];
  expect(command(state, { type: 'choose', offer: r.offers[0] })).toBe(true);
  r.fighter.trainingPoints = 0;
  r.fighter.deferredTrainingPoints = 0;
  r.fighter.augmentOffers = [];
  r.offers = [];
  for (let wave = 1; wave <= 20; wave++) {
    r.phase = 'loot';
    r.offers = [];
    expect(command(state, { type: 'next' })).toBe(true);
  }
  db.online.write(id, save.revision, state);
  return db.online.read(id).state.family.roster[0] as BoundFighter;
}
it('rejects uploaded stats, seeds, malformed input and foreign fields while retaining all valid intent types', () => {
  expect(onlineCommand({ type: 'start', name: '해킹', seed: 1 })).toBeNull();
  expect(onlineCommand({ type: 'recruit', hp: 999 })).toBeNull();
  expect(onlineCommand({ type: 'moveItem', id: 'x', place: 'general', x: 0.5 })).toBeNull();
  expect(
    onlineCommand({ type: 'choose', offer: { art: 'tang', type: 'learn', damage: 999 } }),
  ).toBeNull();
  expect(onlineCommand({ type: 'startRecruit', name: '새 무인' })).toBeNull();
  expect(
    onlineInput({ dx: 1, dy: 0, aim: 0, attack: true, defense: false, ultimate: false }),
  ).toBeTruthy();
  expect(
    onlineInput({ dx: 100, dy: 0, aim: 0, attack: true, defense: false, ultimate: false }),
  ).toBeNull();
});
it('server generates a saved draft once; op IDs, stale revisions, ownership and combat item rules are enforced', async () => {
  const db = new PvpDatabase(':memory:');
  try {
    const id = await account(db),
      other = await account(db, 'other'),
      op = randomUUID(),
      initial = db.online.read(id);
    const draft = db.online.apply(id, initial.revision, op, { type: 'recruit' });
    expect(db.online.apply(id, 0, op, { type: 'recruit' })).toEqual(draft);
    expect(() => db.online.apply(id, 0, op, { type: 'buyRecruitTicket' })).toThrow();
    expect(() => db.online.apply(id, 0, randomUUID(), { type: 'buyRecruitTicket' })).toThrow();
    expect(db.online.read(other).state.family.recruitment!.candidates).toHaveLength(0);
    const started = apply(db, id, {
      type: 'startRecruit',
      id: draft.state.family.recruitment!.candidates[0].id,
      name: '주인 무인',
    });
    expect(started.state.run!.fighter.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(() =>
      apply(db, id, {
        type: 'moveItem',
        id: started.state.run!.fighter.items[0].id,
        place: 'warehouse',
      }),
    ).toThrow();
    expect(() => apply(db, other, { type: 'select', id: started.state.run!.fighter.id })).toThrow();
    expect(() => apply(db, id, { type: 'next' })).toThrow();
  } finally {
    db.close();
  }
});
it('twenty server domain transitions register the owned fighter; selection, gear and seven-day expiry persist', async () => {
  const db = new PvpDatabase(':memory:');
  try {
    const id = await account(db),
      f = graduate(db, id),
      s = db.online.read(id);
    expect(s.state.run).toBeNull();
    expect(s.state.family.victories).toBe(1);
    expect(f.expiresAt! - f.bornAt!).toBe(7 * 24 * 3600000);
    const item = f.items.find((i) => i.kind === 'sword')!;
    const moved = apply(db, id, { type: 'moveItem', id: item.id, place: 'warehouse' });
    expect(moved.state.family.warehouse.some((i) => i.id === item.id)).toBe(true);
    const expired = db.online.refresh(id, f.expiresAt! + 1);
    expect(expired.state.family.roster).toHaveLength(0);
    expect(expired.state.family.retired).toBe(1);
    expect(expired.state.family.warehouse.length).toBeGreaterThanOrEqual(f.items.length);
  } finally {
    db.close();
  }
});
it('personal raids reserve exact ownership and actual HP/arts/items; reward and return commit once', async () => {
  const db = new PvpDatabase(':memory:');
  try {
    const id = await account(db),
      other = await account(db, 'other'),
      f = graduate(db, id);
    expect(() => reserveFighter(db.online, other, f.id, 'ROOMAA')).toThrow();
    const owned = reserveFighter(db.online, id, f.id, 'ROOMAA');
    expect(() =>
      apply(db, id, { type: 'moveItem', id: f.items[0].id, place: 'warehouse' }),
    ).toThrow();
    const members = [{ account: { id }, fighterId: f.id }, null, null, null];
    let m = createRaid('personal-one', [{ name: f.name, preset: 'shadow', fighter: owned }]);
    expect(m.personal).toBe(true);
    expect(m.players[0].fighter.hp).toBe(f.hp);
    expect(m.players[0].fighter.arts[0].level).toBe(1);
    m.phase = 'rest';
    m.cleared = 1;
    m = savePersonalRaid(db.online, 'ROOMAA', members, m, (x) => JSON.stringify(x))!;
    const xp = m.players[0].fighter.xp,
      items = m.players[0].fighter.items.length;
    m = savePersonalRaid(db.online, 'ROOMAA', members, m, (x) => JSON.stringify(x))!;
    expect(m.players[0].fighter.xp).toBe(xp);
    expect(m.players[0].fighter.items).toHaveLength(items);
    expect(db.online.read(id).state.family.training?.offers.length).toBeGreaterThan(0);
    m.status[0] = 'returned';
    m.phase = 'finished';
    m.result = 'retreat';
    m = savePersonalRaid(db.online, 'ROOMAA', members, m, (x) => JSON.stringify(x))!;
    expect(db.online.read(id).locked).toBeNull();
    expect(db.online.read(id).state.family.silver).toBe(20);
    savePersonalRaid(db.online, 'ROOMAA', members, m, (x) => JSON.stringify(x));
    expect(db.online.read(id).state.family.silver).toBe(20);
  } finally {
    db.close();
  }
});
it('death, heirlooms, real bag occupancy and original-owner warehouse delivery are atomic and permanent', async () => {
  const db = new PvpDatabase(':memory:');
  try {
    const a = await account(db, 'owner'),
      b = await account(db, 'carrier'),
      fa = graduate(db, a),
      fb = graduate(db, b);
    reserveFighter(db.online, a, fa.id, 'HEIRAA');
    reserveFighter(db.online, b, fb.id, 'HEIRAA');
    const members = [
      { account: { id: a }, fighterId: fa.id },
      { account: { id: b }, fighterId: fb.id },
      null,
      null,
    ];
    let m = createRaid('heirs', [
      { name: '원주인', preset: 'shadow', fighter: fa },
      { name: '운반자', preset: 'shadow', fighter: fb },
    ]);
    m.phase = 'rest';
    m.status[0] = 'dead';
    m.players[0].fighter.hp = 0;
    m = savePersonalRaid(db.online, 'HEIRAA', members, m, (x) => JSON.stringify(x))!;
    expect(db.online.read(a).state.family.roster).toHaveLength(0);
    expect(m.heirs).toHaveLength(fa.items.length);
    recoverHeir(m, 1, m.heirs![0].id);
    expect(carriedItems(m, 1)).toHaveLength(1);
    expect(() => recoverHeir(m, 1, m.heirs![0].id)).toThrow();
    m.status[1] = 'returned';
    m.phase = 'finished';
    m.result = 'retreat';
    m = savePersonalRaid(db.online, 'HEIRAA', members, m, (x) => JSON.stringify(x))!;
    expect(db.online.read(a).state.family.warehouse.some((i) => i.id === fa.items[0].id)).toBe(
      true,
    );
    expect(db.online.read(b).state.family.warehouse).toHaveLength(0);
    expect(m.heirs!.filter((h) => h.lost)).toHaveLength(fa.items.length - 1);
    savePersonalRaid(db.online, 'HEIRAA', members, m, (x) => JSON.stringify(x));
    expect(db.online.read(a).state.family.deaths).toBe(1);
  } finally {
    db.close();
  }
});
it('failed checkpoint rolls back death and room together, retries the same outcome without duplicating gear', async () => {
  const db = new PvpDatabase(':memory:');
  try {
    const id = await account(db),
      f = graduate(db, id);
    reserveFighter(db.online, id, f.id, 'FAILAA');
    const p = [{ account: { id }, fighterId: f.id }, null, null, null],
      m = createRaid('fail', [{ name: '검증', preset: 'shadow', fighter: f }]);
    m.status[0] = 'dead';
    m.players[0].fighter.hp = 0;
    const write = vi.spyOn(db.online, 'write').mockImplementationOnce(() => {
      throw Error('disk unavailable');
    });
    expect(() => savePersonalRaid(db.online, 'FAILAA', p, m, (x) => JSON.stringify(x))).toThrow();
    write.mockRestore();
    expect(db.online.read(id).state.family.roster).toHaveLength(1);
    expect(m.heirs).toHaveLength(0);
    const committed = savePersonalRaid(db.online, 'FAILAA', p, m, (x) => JSON.stringify(x))!;
    expect(committed.heirs).toHaveLength(f.items.length);
    expect(db.online.read(id).state.family.roster).toHaveLength(0);
  } finally {
    db.close();
  }
});
it('rest growth and item use are server-owned, exactly once, with no warehouse import or combat mutation', async () => {
  const db = new PvpDatabase(':memory:');
  try {
    const id = await account(db),
      f = graduate(db, id);
    reserveFighter(db.online, id, f.id, 'GROWAA');
    const members = [{ account: { id }, fighterId: f.id }, null, null, null];
    let m = createRaid('growth', [{ name: f.name, preset: 'shadow', fighter: f }]);
    m.phase = 'rest';
    m.cleared = 1;
    m = savePersonalRaid(db.online, 'GROWAA', members, m, (x) => JSON.stringify(x))!;
    const offer = db.online.read(id).state.family.training!.offers[0],
      op = randomUUID(),
      points = m.players[0].fighter.trainingPoints!;
    m = raidPersonalCommand(
      db.online,
      'GROWAA',
      members,
      m,
      0,
      { type: 'choose', offer },
      op,
      (x) => JSON.stringify(x),
    );
    const after = m.players[0].fighter.trainingPoints;
    expect(after).toBeLessThan(points);
    m = raidPersonalCommand(
      db.online,
      'GROWAA',
      members,
      m,
      0,
      { type: 'choose', offer },
      op,
      (x) => JSON.stringify(x),
    );
    expect(m.players[0].fighter.trainingPoints).toBe(after);
    expect(() =>
      raidPersonalCommand(
        db.online,
        'GROWAA',
        members,
        m,
        0,
        { type: 'moveItem', id: f.items[0].id, place: 'warehouse' },
        randomUUID(),
        (x) => JSON.stringify(x),
      ),
    ).toThrow();
    m.phase = 'fighting';
    expect(() =>
      raidPersonalCommand(
        db.online,
        'GROWAA',
        members,
        m,
        0,
        { type: 'openTraining' },
        randomUUID(),
        (x) => JSON.stringify(x),
      ),
    ).toThrow();
  } finally {
    db.close();
  }
});
it('personal room checkpoint survives schema-three restart while legacy standard rooms remain void', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugong-personal-')),
    path = join(dir, 'isolated.sqlite');
  let db = new PvpDatabase(path);
  try {
    const id = await account(db),
      f = graduate(db, id);
    reserveFighter(db.online, id, f.id, 'RESUME');
    db.beginRaid('durable', [id]);
    db.beginRaid('standard', [id]);
    const m = createRaid('durable', [{ name: '검증', preset: 'shadow', fighter: f }]);
    m.players[0].fighter.hp = 20;
    savePersonalRaid(
      db.online,
      'RESUME',
      [{ account: { id }, fighterId: f.id }, null, null, null],
      m,
      (x) => JSON.stringify(x),
    );
    db.close();
    db = new PvpDatabase(path);
    expect(db.db.prepare("SELECT state FROM raid_results WHERE run='durable'").get()!.state).toBe(
      'playing',
    );
    expect(db.db.prepare("SELECT state FROM raid_results WHERE run='standard'").get()!.state).toBe(
      'void',
    );
    expect(db.online.read(id).state.family.roster[0].hp).toBe(20);
    expect(db.online.read(id).locked).toBe('RESUME');
  } finally {
    db.close();
    for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
    rmdirSync(dir);
  }
});
