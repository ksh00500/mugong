import { it, expect } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { createPvpServer } from '../src/pvp/server/server';
import { createRaid } from '../src/raid/engine';
import { neutralInput } from '../src/pvp/model';
import type { RaidRoom } from '../src/raid/model';
const origin = 'http://127.0.0.1:5227',
  sleep = (n: number) => new Promise((r) => setTimeout(r, n));
async function harness() {
  const app = createPvpServer({
    databasePath: ':memory:',
    origins: [origin],
    raidReconnectMs: 250,
    raidFactory: (id, party) => {
      const m = createRaid(id, party);
      m.players[4].fighter.hp = m.players[4].maxHp = 1;
      return m;
    },
  });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  async function player(name: string, cookie?: string) {
    if (!cookie) {
      const r = await fetch(base + '/api/pvp/register', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: name, password: 'raid-test-only-password', name }),
      });
      expect(r.status).toBe(200);
      cookie = r.headers.get('set-cookie')!.split(';')[0];
    }
    const ws = new WebSocket(base.replace('http', 'ws') + '/api/pvp/raid-socket', {
      headers: { Origin: origin, Cookie: cookie },
    });
    let room: RaidRoom | undefined;
    const errors: string[] = [];
    ws.on('message', (b) => {
      const m = JSON.parse(b.toString());
      if (m.type === 'room') room = m.room;
      if (m.type === 'error') errors.push(m.message);
    });
    await new Promise<void>((r, j) => {
      ws.on('open', () => r());
      ws.on('error', j);
    });
    const send = (m: unknown) => ws.send(JSON.stringify(m));
    const wait = async (fn: (r: RaidRoom) => boolean, timeout = 8000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (room && fn(room)) return room;
        await sleep(20);
      }
      throw Error('Expected raid state did not arrive');
    };
    return { ws, cookie, send, wait, state: () => room!, errors };
  }
  return { ...app, base, player };
}
it('four real accounts ready/start; stale party revision is rejected and initial match scales for all four', async () => {
  const app = await harness();
  try {
    const p = await Promise.all(
      ['raidone', 'raidtwo', 'raidthree', 'raidfour'].map((n) => app.player(n)),
    );
    p[0].send({ type: 'create', preset: 'shadow' });
    const code = (await p[0].wait((r) => !!r.code)).code;
    for (let i = 1; i < 4; i++) {
      p[i].send({ type: 'join', preset: 'sword', code });
      await p[0].wait((r) => r.seats.filter(Boolean).length === i + 1);
    }
    const room = p[0].state();
    p[0].send({ type: 'ready', revision: room.revision - 1 });
    await sleep(100);
    expect(p[0].errors.some((e) => e.includes('파티'))).toBe(true);
    for (const q of p) q.send({ type: 'ready', revision: room.revision });
    await p[0].wait((r) => r.seats.every((s) => s?.ready));
    p[0].send({ type: 'start', revision: room.revision });
    const begun = await p[0].wait((r) => r.match?.phase === 'fighting');
    expect(begun.match!.scaledFor).toBe(4);
    expect(begun.match!.players).toHaveLength(5);
    const epoch = begun.match!.epoch;
    p[0].send({ type: 'input', epoch, seq: 0, ...neutralInput(), damage: 999 });
    await sleep(100);
    expect(p[0].errors.some((e) => e.includes('잘못된'))).toBe(true);
  } finally {
    await app.close();
  }
}, 15000);
it('a real ranged contact clears the floor; return resets peer readiness, medicine is rest-only and next floor scales for survivors', async () => {
  const app = await harness();
  try {
    const a = await app.player('clearone'),
      b = await app.player('cleartwo');
    a.send({ type: 'create', preset: 'shadow' });
    const code = (await a.wait((r) => !!r.code)).code;
    b.send({ type: 'join', preset: 'monk', code });
    const r = await a.wait((r) => !!r.seats[1]);
    for (const p of [a, b]) p.send({ type: 'ready', revision: r.revision });
    await a.wait((r) => r.seats[0]!.ready && r.seats[1]!.ready);
    a.send({ type: 'start', revision: r.revision });
    const started = await a.wait((r) => r.match?.phase === 'fighting');
    let seq = 0;
    const timer = setInterval(() => {
      const m = a.state().match;
      if (m?.phase === 'fighting') {
        const f = m.players[0].fighter,
          t = m.players[4].fighter;
        a.send({
          type: 'input',
          epoch: m.epoch,
          seq: seq++,
          ...neutralInput(),
          attack: true,
          aim: Math.atan2(t.y - f.y, t.x - f.x),
        });
      }
    }, 30);
    let rest: RaidRoom;
    try {
      rest = await a.wait((r) => r.match?.phase === 'rest', 12000);
    } finally {
      clearInterval(timer);
    }
    expect(rest.match!.cleared).toBe(1);
    a.send({ type: 'ready', revision: rest.revision });
    await a.wait((r) => r.seats[0]!.ready);
    b.send({ type: 'return', revision: rest.revision });
    const changed = await a.wait((r) => r.match?.status[1] === 'returned' && !r.seats[0]!.ready);
    expect(changed.revision).toBeGreaterThan(rest.revision);
    expect((await b.wait((r) => !!r.receipt)).receipt!.floor).toBe(1);
    const me = await (
      await fetch(app.base + '/api/pvp/me', { headers: { Cookie: a.cookie } })
    ).json();
    expect(me.account.rating).toBe(1000);
    expect(me.account.matches).toBe(0);
    a.send({ type: 'ready', revision: changed.revision });
    const next = await a.wait((r) => r.match?.floor === 2);
    expect(next.match!.scaledFor).toBe(1);
    b.send({ type: 'leave' });
    const history = await (
      await fetch(app.base + '/api/pvp/raids', { headers: { Cookie: b.cookie } })
    ).json();
    expect(history.history).toHaveLength(1);
    expect(history.history[0].receipt.outcome).toBe('returned');
  } finally {
    await app.close();
  }
}, 25000);
it('room resume preserves identity; active raid membership blocks PvP and logout terminates the raid socket', async () => {
  const app = await harness();
  try {
    const a = await app.player('resumeraid');
    a.send({ type: 'create', preset: 'sword' });
    const before = await a.wait((r) => !!r.code);
    a.ws.close();
    const again = await app.player('resumeraid', a.cookie);
    again.send({ type: 'resume' });
    expect((await again.wait((r) => r.code === before.code)).seats[0]?.connected).toBe(true);
    const duel = new WebSocket(app.base.replace('http', 'ws') + '/api/pvp/socket', {
      headers: { Origin: origin, Cookie: a.cookie },
    });
    const errors: string[] = [];
    duel.on('message', (b) => {
      const m = JSON.parse(b.toString());
      if (m.type === 'error') errors.push(m.message);
    });
    await new Promise<void>((r) => duel.on('open', () => r()));
    duel.send(JSON.stringify({ type: 'queue', preset: 'sword' }));
    await sleep(100);
    expect(errors.some((e) => e.includes('레이드'))).toBe(true);
    const closed = new Promise<number>((r) => again.ws.on('close', r));
    await fetch(app.base + '/api/pvp/logout', {
      method: 'POST',
      headers: { Origin: origin, Cookie: a.cookie },
    });
    expect(await closed).toBe(4003);
  } finally {
    await app.close();
  }
}, 15000);
