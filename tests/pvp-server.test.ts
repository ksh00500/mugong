import { it, expect } from 'vitest';
import WebSocket from 'ws';
import type { AddressInfo } from 'node:net';
import { createPvpServer } from '../src/pvp/server/server';
import type { ServerMessage, RoomState } from '../src/pvp/model';
import { neutralInput } from '../src/pvp/model';
const origin = 'http://127.0.0.1:5227';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function harness(reconnectMs = 30000) {
  const app = createPvpServer({ databasePath: ':memory:', origins: [origin], reconnectMs });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  async function register(login: string) {
    const r = await fetch(`${base}/api/pvp/register`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password: 'temporary-test-password', name: `검증 ${login}` }),
    });
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie')).toContain('HttpOnly');
    return r.headers.get('set-cookie')!.split(';')[0];
  }
  async function connect(cookie: string) {
    const ws = new WebSocket(base.replace('http', 'ws') + '/api/pvp/socket', {
        headers: { Origin: origin, Cookie: cookie },
      }),
      messages: ServerMessage[] = [];
    ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });
    const wait = async (predicate: (m: ServerMessage) => boolean, ms = 5000) => {
      const start = Date.now();
      while (Date.now() - start < ms) {
        const m = [...messages].reverse().find(predicate);
        if (m) return m;
        await sleep(10);
      }
      throw Error('Expected server message did not arrive');
    };
    return {
      ws,
      messages,
      send: (message: unknown) => ws.send(JSON.stringify(message)),
      wait,
      room: async (predicate: (r: RoomState) => boolean) => {
        const m = await wait((m) => m.type === 'room' && predicate(m.room));
        return (m as Extract<ServerMessage, { type: 'room' }>).room;
      },
    };
  }
  return { ...app, base, register, connect };
}
it('two authenticated players really join, move, reconnect and finish a friendly match without rating changes', async () => {
  const app = await harness();
  try {
    expect(
      (
        await fetch(app.base + '/api/pvp/login', {
          method: 'POST',
          headers: { Origin: 'https://wrong.example', 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
    ).toBe(403);
    const ca = await app.register('first'),
      cb = await app.register('second'),
      a = await app.connect(ca),
      b = await app.connect(cb);
    a.send({ type: 'create', preset: 'sword' });
    const room = await a.room((r) => !!r.seats[0] && !r.seats[1]);
    b.send({ type: 'join', preset: 'monk', code: room.code });
    await a.room((r) => !!r.seats[1]);
    a.send({ type: 'ready' });
    b.send({ type: 'ready' });
    const started = await a.room((r) => r.match?.phase === 'fighting');
    const m = started.match!,
      x = m.players[0].fighter.x;
    a.send({ type: 'input', epoch: m.epoch, seq: 0, ...neutralInput(), dx: 1 });
    await sleep(500);
    const moved = await a.room((r) => r.match!.players[0].fighter.x > x);
    expect(moved.match!.players[0].fighter.x - x).toBeLessThanOrEqual(60);
    const atRest = (await a.room((r) => (r.match?.tick ?? 0) > m.tick + 35)).match!.players[0]
      .fighter.x;
    a.send({ type: 'input', epoch: m.epoch, seq: 0, ...neutralInput(), dx: 1 });
    await sleep(250);
    const still = (await a.room((r) => (r.match?.tick ?? 0) > m.tick + 50)).match!.players[0]
      .fighter.x;
    expect(still).toBe(atRest);
    a.send({ type: 'input', epoch: m.epoch, seq: 1, ...neutralInput(), damage: 999 });
    await a.wait((m) => m.type === 'error');
    b.ws.close();
    const resumed = await app.connect(cb);
    resumed.send({ type: 'resume' });
    const restored = await resumed.room(
      (r) => r.match?.id === m.id && r.seats[1]?.connected === true,
    );
    expect(restored.match!.players[1].fighter.hp).toBe(240);
    resumed.send({ type: 'surrender' });
    const ended = await a.room((r) => !!r.receipt);
    expect(ended.receipt!.winner).toBe(0);
    expect(ended.receipt!.deltas).toEqual([0, 0]);
    expect(app.db.rankings()).toEqual([]);
  } finally {
    await app.close();
  }
}, 15000);
it('ranked queue matches two real accounts and commits one Elo result, rejecting a direct ranked rematch', async () => {
  const app = await harness();
  try {
    const ca = await app.register('rankone'),
      cb = await app.register('ranktwo'),
      a = await app.connect(ca),
      b = await app.connect(cb);
    a.send({ type: 'queue', preset: 'shadow' });
    await a.wait((m) => m.type === 'queue');
    await sleep(100);
    expect(a.messages.some((m) => m.type === 'room')).toBe(false);
    b.send({ type: 'queue', preset: 'mystic' });
    await a.room((r) => r.mode === 'ranked' && !!r.seats[1]);
    await b.room((r) => r.mode === 'ranked' && !!r.seats[1]);
    a.send({ type: 'ready' });
    b.send({ type: 'ready' });
    await a.room((r) => r.match?.phase === 'fighting');
    b.send({ type: 'surrender' });
    const ended = await a.room((r) => !!r.receipt);
    expect(ended.receipt!.deltas).toEqual([12, -12]);
    expect(app.db.rankings().map((a) => a.rating)).toEqual([1012, 988]);
    b.send({ type: 'ready' });
    await b.wait((m) => m.type === 'error');
    expect(app.db.rankings().every((a) => a.matches === 1)).toBe(true);
    const me = await (await fetch(app.base + '/api/pvp/me', { headers: { Cookie: ca } })).json();
    expect(me.account.rating).toBe(1012);
    expect(me.history).toHaveLength(1);
    expect(JSON.stringify(me)).not.toContain('hash');
    expect(JSON.stringify(me)).not.toContain('salt');
  } finally {
    await app.close();
  }
}, 15000);
it('disconnect expiry and a transient database failure settle once', async () => {
  const app = await harness(150);
  try {
    const ca = await app.register('lostone'),
      cb = await app.register('losttwo'),
      a = await app.connect(ca),
      b = await app.connect(cb);
    a.send({ type: 'queue', preset: 'sword' });
    b.send({ type: 'queue', preset: 'sword' });
    await a.room((r) => !!r.seats[1]);
    a.send({ type: 'ready' });
    b.send({ type: 'ready' });
    await a.room((r) => r.match?.phase === 'fighting');
    const settle = app.db.settle.bind(app.db);
    let calls = 0;
    app.db.settle = (m) => {
      if (++calls === 1) throw Error('Injected test-only storage failure');
      return settle(m);
    };
    b.ws.close();
    await a.room((r) => r.settling);
    const end = await a.room((r) => !!r.receipt);
    expect(end.receipt!.reason).toBe('disconnect');
    expect(end.receipt!.winner).toBe(0);
    expect(calls).toBe(2);
    expect(app.db.rankings()[0].matches).toBe(1);
  } finally {
    await app.close();
  }
}, 15000);
it('both disconnected accounts produce a void result even when only the first grace period has expired', async () => {
  const app = await harness(150);
  try {
    const ca = await app.register('voidone'),
      cb = await app.register('voidtwo'),
      a = await app.connect(ca),
      b = await app.connect(cb);
    a.send({ type: 'queue', preset: 'sword' });
    b.send({ type: 'queue', preset: 'sword' });
    await a.room((r) => !!r.seats[1]);
    a.send({ type: 'ready' });
    b.send({ type: 'ready' });
    await a.room((r) => r.match?.phase === 'fighting');
    a.ws.close();
    await sleep(80);
    b.ws.close();
    await sleep(400);
    const me = await (await fetch(app.base + '/api/pvp/me', { headers: { Cookie: ca } })).json();
    expect(me.history[0].receipt.reason).toBe('abandoned');
    expect(me.history[0].receipt.winner).toBeNull();
    expect(me.account.rating).toBe(1000);
    expect(me.account.matches).toBe(0);
    expect(app.db.rankings()).toEqual([]);
  } finally {
    await app.close();
  }
}, 15000);
