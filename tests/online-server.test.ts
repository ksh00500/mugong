import { it, expect } from 'vitest';
import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createPvpServer } from '../src/pvp/server/server';
const origin = 'http://127.0.0.1:5227',
  sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
it('authenticated online intent → durable state → server movement → pause → reconnect never accepts client HP or victory', async () => {
  const app = createPvpServer({ databasePath: ':memory:', origins: [origin] });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  try {
    expect((await fetch(base + '/api/pvp/online')).status).toBe(401);
    const reg = await fetch(base + '/api/pvp/register', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'onlinecase',
        password: 'isolated-online-password',
        name: '온라인 검증',
      }),
    });
    const cookie = reg.headers.get('set-cookie')!.split(';')[0];
    async function connect() {
      const ws = new WebSocket(base.replace('http', 'ws') + '/api/pvp/online-socket', {
          headers: { Origin: origin, Cookie: cookie },
        }),
        messages: any[] = [];
      ws.on('message', (b) => messages.push(JSON.parse(b.toString())));
      await new Promise<void>((r, j) => {
        ws.on('open', r);
        ws.on('error', j);
      });
      const wait = async (fn: (m: any) => boolean) => {
        for (let n = 0; n < 250; n++) {
          const m = [...messages].reverse().find(fn);
          if (m) return m;
          await sleep(10);
        }
        throw Error('Expected personal state');
      };
      return { ws, messages, wait, send: (m: unknown) => ws.send(JSON.stringify(m)) };
    }
    const a = await connect();
    let save = (await a.wait((m) => m.save)).save;
    const draft = randomUUID();
    a.send({ type: 'command', op: draft, revision: save.revision, command: { type: 'recruit' } });
    save = (await a.wait((m) => m.op === draft)).save;
    const start = randomUUID();
    a.send({
      type: 'command',
      op: start,
      revision: save.revision,
      command: {
        type: 'startRecruit',
        id: save.state.family.recruitment.candidates[0].id,
        name: '서버 무인',
      },
    });
    save = (await a.wait((m) => m.op === start)).save;
    const choice = randomUUID();
    a.send({
      type: 'command',
      op: choice,
      revision: save.revision,
      command: { type: 'choose', offer: save.state.run.offers[0] },
    });
    save = (await a.wait((m) => m.op === choice)).save;
    const id = save.state.run.id,
      x = save.state.run.fighter.x;
    a.send({ type: 'pause', value: false });
    a.send({
      type: 'input',
      seq: 0,
      input: { dx: 1, dy: 0, aim: 0, attack: false, defense: false, ultimate: false },
    });
    const moved = (await a.wait((m) => m.type === 'state' && m.save.state.run?.fighter.x > x)).save;
    expect(moved.state.run.fighter.x - x).toBeLessThan(60);
    a.send({ type: 'pause', value: true });
    await sleep(200);
    const paused = await (
      await fetch(base + '/api/pvp/online', { headers: { Cookie: cookie } })
    ).json();
    await sleep(250);
    expect(
      (await (await fetch(base + '/api/pvp/online', { headers: { Cookie: cookie } })).json()).state
        .run.elapsed,
    ).toBe(paused.state.run.elapsed);
    const hack = randomUUID();
    a.send({
      type: 'command',
      op: hack,
      revision: paused.revision,
      command: { type: 'claim', hp: 999, victory: true },
    });
    expect((await a.wait((m) => m.op === hack)).type).toBe('error');
    const b = await connect();
    const restored = (await b.wait((m) => m.save)).save;
    expect(restored.state.run.id).toBe(id);
    expect(restored.state.run.fighter.x).toBe(paused.state.run.fighter.x);
    await sleep(50);
    expect(a.ws.readyState).not.toBe(WebSocket.OPEN);
  } finally {
    await app.close();
  }
}, 15000);
