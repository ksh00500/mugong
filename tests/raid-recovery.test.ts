import { it, expect } from 'vitest';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { createPvpServer } from '../src/pvp/server/server';
import { command } from '../src/domain/game';
import type { RaidRoom } from '../src/raid/model';
const origin = 'http://127.0.0.1:5227',
  sleep = (n: number) => new Promise((r) => setTimeout(r, n));
it('the actual authenticated personal raid resumes the same persisted room and loadout after server restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugong-room-recovery-')),
    path = join(dir, 'isolated.sqlite');
  let app = createPvpServer({ databasePath: path, origins: [origin] });
  const listen = async () => {
    await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
    return `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  };
  let base = await listen();
  try {
    const reg = await fetch(base + '/api/pvp/register', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'restartcase',
        password: 'isolated-restart-password',
        name: '복구 검증',
      }),
    });
    const cookie = reg.headers.get('set-cookie')!.split(';')[0],
      { account } = await reg.json(),
      s = app.db.online.read(account.id);
    command(s.state, { type: 'recruit' });
    command(s.state, {
      type: 'startRecruit',
      id: s.state.family.recruitment!.candidates[0].id,
      name: '복구 무인',
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
      command(s.state, { type: 'next' });
    }
    app.db.online.write(account.id, s.revision, s.state);
    const f = s.state.family.roster[0];
    async function connect() {
      const ws = new WebSocket(base.replace('http', 'ws') + '/api/pvp/raid-socket', {
        headers: { Origin: origin, Cookie: cookie },
      });
      let room: RaidRoom | undefined;
      ws.on('message', (b) => {
        const m = JSON.parse(b.toString());
        if (m.type === 'room') room = m.room;
      });
      await new Promise<void>((r, j) => {
        ws.on('open', r);
        ws.on('error', j);
      });
      return {
        ws,
        send: (m: unknown) => ws.send(JSON.stringify(m)),
        wait: async (fn: (r: RaidRoom) => boolean) => {
          for (let n = 0; n < 200; n++) {
            if (room && fn(room)) return room;
            await sleep(10);
          }
          throw Error('Expected durable raid room');
        },
      };
    }
    const a = await connect();
    a.send({ type: 'create', preset: 'sword', fighterId: f.id });
    let room = await a.wait((r) => !!r.code);
    a.send({ type: 'ready', revision: room.revision });
    room = await a.wait((r) => !!r.seats[0]?.ready);
    a.send({ type: 'start', revision: room.revision });
    room = await a.wait((r) => !!r.match);
    const run = room.match!.id,
      hp = room.match!.players[0].fighter.hp,
      code = room.code;
    await app.close();
    app = createPvpServer({ databasePath: path, origins: [origin] });
    base = await listen();
    const b = await connect();
    b.send({ type: 'resume' });
    const restored = await b.wait((r) => r.match?.id === run);
    expect(restored.code).toBe(code);
    expect(restored.match!.players[0].fighter.id).toBe(f.id);
    expect(restored.match!.players[0].fighter.hp).toBe(hp);
    expect(restored.ownSave?.locked).toBe(code);
    expect(restored.settling).toBe(false);
  } finally {
    await app.close();
    for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
    rmdirSync(dir);
  }
}, 15000);
