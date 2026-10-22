import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { PvpDatabase } from './database';
import { createPvpMatch, finishPvp, stepPvp } from '../engine';
import { parsePvpMessage } from '../protocol';
import { PVP_RULES as R } from '../rules';
import {
  neutralInput,
  type ClientMessage,
  type OnlineAccount,
  type PvpInput,
  type PresetId,
  type RoomState,
  type Seat,
  type ServerMessage,
} from '../model';
type Connection = {
  socket: WebSocket;
  account: OnlineAccount;
  tokenHash: string;
  room?: Room;
  seat?: Seat;
  queued?: { since: number; preset: PresetId };
  window: number;
  count: number;
};
type Participant = {
  account: OnlineAccount;
  preset: PresetId;
  ready: boolean;
  connection?: Connection;
  disconnectedAt?: number;
  input: PvpInput;
  seq: number;
  lastInput: number;
};
type Room = {
  code: string;
  mode: 'friendly' | 'ranked';
  seats: [Participant | null, Participant | null];
  match: ReturnType<typeof createPvpMatch> | null;
  receipt: RoomState['receipt'];
  settling: boolean;
  updated: number;
  retryAt?: number;
};
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export function createPvpServer(options: {
  databasePath: string;
  origins: string[];
  reconnectMs?: number;
}) {
  const db = new PvpDatabase(options.databasePath),
    connections = new Set<Connection>(),
    rooms = new Map<string, Room>(),
    queued = new Set<Connection>();
  const origins = new Set(options.origins),
    cookieSecure = options.origins.every((o) => o.startsWith('https://'));
  const rate = new Map<string, { at: number; count: number }>();
  let cryptoJobs = 0,
    closed = false;
  const allow = (key: string, limit: number) => {
    const now = Date.now();
    let r = rate.get(key);
    if (!r || now - r.at > 60000) {
      r = { at: now, count: 0 };
      rate.set(key, r);
    }
    return ++r.count <= limit;
  };
  const session = (req: IncomingMessage) => {
    const token = /(?:^|;\s*)mugong-online=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie ?? '',
    )?.[1];
    if (!token) return null;
    const hash = digest(token),
      row = db.db
        .prepare('SELECT account FROM sessions WHERE token=? AND expires>?')
        .get(hash, Date.now());
    const account = row ? db.account(row.account as string) : null;
    return account ? { account, hash } : null;
  };
  const send = (c: Connection, message: ServerMessage) => {
    if (c.socket.readyState !== WebSocket.OPEN) return;
    if (c.socket.bufferedAmount > 65536) {
      c.socket.close(1013, 'Slow connection');
      return;
    }
    c.socket.send(JSON.stringify(message));
  };
  const error = (c: Connection, message: string) => send(c, { type: 'error', message });
  const publicRoom = (room: Room): RoomState => ({
    code: room.code,
    mode: room.mode,
    seats: room.seats.map((p) =>
      p
        ? {
            name: p.account.name,
            preset: p.preset,
            ready: p.ready,
            connected: !!p.connection,
            rating: db.account(p.account.id)?.rating ?? p.account.rating,
            ack: p.seq,
          }
        : null,
    ) as RoomState['seats'],
    match: room.match,
    receipt: room.receipt,
    settling: room.settling,
  });
  const publish = (room: Room) => {
    const state = publicRoom(room);
    for (const seat of [0, 1] as const) {
      const c = room.seats[seat]?.connection;
      if (c) send(c, { type: 'room', seat, room: state });
    }
  };
  function accountRoom(id: string) {
    for (const room of rooms.values()) {
      const seat = room.seats.findIndex((p) => p?.account.id === id);
      if (seat >= 0) return { room, seat: seat as Seat };
    }
    return null;
  }
  function attach(c: Connection, room: Room, seat: Seat) {
    const p = room.seats[seat]!;
    if (p.connection && p.connection !== c) {
      p.connection.room = undefined;
      p.connection.seat = undefined;
      p.connection.socket.close(4001, 'Connected elsewhere');
    }
    p.connection = c;
    p.disconnectedAt = undefined;
    p.input = neutralInput();
    p.lastInput = 0;
    p.seq = -1;
    c.room = room;
    c.seat = seat;
    room.updated = Date.now();
    publish(room);
  }
  function cancelQueue(c: Connection) {
    queued.delete(c);
    c.queued = undefined;
  }
  function trySettle(room: Room) {
    if (room.match?.phase !== 'finished' || room.receipt) return;
    if (room.retryAt && room.retryAt > Date.now()) return;
    try {
      room.receipt = db.settle(room.match);
      room.settling = false;
      for (const p of room.seats) if (p) p.ready = false;
    } catch {
      room.settling = true;
      room.retryAt = Date.now() + 1000;
    }
  }
  function depart(c: Connection, explicit = false) {
    cancelQueue(c);
    const room = c.room,
      seat = c.seat;
    if (!room || seat === undefined) return;
    const p = room.seats[seat];
    if (!p || p.connection !== c) return;
    p.connection = undefined;
    p.input = neutralInput();
    p.disconnectedAt = Date.now();
    if (explicit && room.match && room.match.phase !== 'finished') {
      finishPvp(room.match, (1 - seat) as Seat, 'surrender');
      trySettle(room);
    }
    if (explicit && (!room.match || room.receipt)) {
      room.seats[seat] = null;
      c.room = undefined;
      c.seat = undefined;
      if (room.match?.phase === 'finished') {
        const peer = room.seats[(1 - seat) as Seat];
        if (peer?.connection) {
          peer.connection.room = undefined;
          peer.connection.seat = undefined;
          send(peer.connection, { type: 'room', seat: (1 - seat) as Seat, room: publicRoom(room) });
        }
        rooms.delete(room.code);
      } else if (room.seats.every((p) => !p)) rooms.delete(room.code);
    }
    publish(room);
  }
  function begin(room: Room) {
    if (room.settling || !room.seats.every((p) => p?.connection && p.ready)) return;
    if (room.match && room.match.phase !== 'finished') return;
    const a = room.seats[0]!,
      b = room.seats[1]!;
    const match = createPvpMatch(randomUUID(), room.mode, [
      { name: a.account.name, preset: a.preset },
      { name: b.account.name, preset: b.preset },
    ]);
    db.begin(match, a.account.id, b.account.id);
    room.match = match;
    room.receipt = null;
    for (const p of room.seats)
      if (p) {
        p.input = neutralInput();
        p.seq = -1;
        p.lastInput = 0;
      }
    publish(room);
  }
  function newRoom(mode: Room['mode']) {
    if (rooms.size >= 64) throw Error('현재 대전 방이 가득 찼습니다');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = Array.from(randomBytes(6), (v) => alphabet[v % alphabet.length]).join('');
    } while (rooms.has(code));
    const room: Room = {
      code,
      mode,
      seats: [null, null],
      match: null,
      receipt: null,
      settling: false,
      updated: Date.now(),
    };
    rooms.set(code, room);
    return room;
  }
  function join(c: Connection, room: Room, preset: PresetId) {
    if (room.match && room.match.phase !== 'finished') throw Error('이미 시작한 경기입니다');
    const seat = room.seats.findIndex((p) => !p);
    if (seat < 0) throw Error('방이 가득 찼습니다');
    room.seats[seat as Seat] = {
      account: c.account,
      preset,
      ready: false,
      input: neutralInput(),
      seq: -1,
      lastInput: 0,
    };
    attach(c, room, seat as Seat);
  }
  function handle(c: Connection, message: ClientMessage) {
    if (message.type === 'ping') {
      send(c, { type: 'pong', sent: message.sent });
      return;
    }
    if (message.type === 'resume') {
      const existing = accountRoom(c.account.id);
      if (existing) attach(c, existing.room, existing.seat);
      else send(c, { type: 'idle' });
      return;
    }
    if (message.type === 'cancel') {
      if (c.room) {
        publish(c.room);
        return;
      }
      cancelQueue(c);
      send(c, { type: 'idle' });
      return;
    }
    if (message.type === 'leave') {
      depart(c, true);
      send(c, { type: 'idle' });
      return;
    }
    if (['create', 'join', 'queue'].includes(message.type)) {
      if (c.room || accountRoom(c.account.id))
        throw Error('현재 대전을 마치거나 나가기를 선택하세요');
      if (c.queued) throw Error('이미 상대를 찾고 있습니다');
      for (const other of connections)
        if (other !== c && other.account.id === c.account.id && (other.room || other.queued))
          throw Error('다른 창에서 대기 또는 대전 중입니다');
      if (message.type === 'create') {
        join(c, newRoom('friendly'), message.preset);
        return;
      }
      if (message.type === 'join') {
        const room = rooms.get(message.code);
        if (!room || room.mode !== 'friendly')
          throw Error('참가 가능한 친선 방을 찾을 수 없습니다');
        join(c, room, message.preset);
        return;
      }
      if (message.type === 'queue') {
        c.queued = { preset: message.preset, since: Date.now() };
        queued.add(c);
        send(c, { type: 'queue', since: c.queued.since });
        return;
      }
    }
    const room = c.room,
      seat = c.seat,
      p = seat !== undefined ? room?.seats[seat] : null;
    if (!room || seat === undefined || !p || p.connection !== c)
      throw Error('먼저 대전에 참가하세요');
    if (message.type === 'ready') {
      if (room.match?.phase === 'finished' && !room.receipt)
        throw Error('결과 저장을 기다려 주세요');
      if (room.mode === 'ranked' && room.match?.phase === 'finished')
        throw Error('순위전은 대기실에서 다시 매칭하세요');
      p.ready = true;
      begin(room);
      publish(room);
    }
    if (message.type === 'surrender' && room.match && room.match.phase !== 'finished') {
      finishPvp(room.match, (1 - seat) as Seat, 'surrender');
      trySettle(room);
      publish(room);
    }
    if (message.type === 'input') {
      const m = room.match;
      if (
        !m ||
        m.phase !== 'fighting' ||
        message.epoch !== m.epoch ||
        message.seq <= p.seq ||
        message.seq - p.seq > 10000
      )
        return;
      p.seq = message.seq;
      p.lastInput = Date.now();
      p.input = {
        dx: message.dx,
        dy: message.dy,
        aim: message.aim,
        attack: message.attack,
        defense: p.input.defense || message.defense,
        ultimate: p.input.ultimate || message.ultimate,
        switch: message.switch || p.input.switch,
      };
    }
  }
  const json = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(value));
  };
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? '/', 'http://local').pathname;
      if (req.method === 'GET' && path === '/api/pvp/health') {
        json(res, 200, { ok: true, rules: 1 });
        return;
      }
      if (req.method === 'GET' && path === '/api/pvp/me') {
        const s = session(req);
        json(res, 200, { account: s?.account ?? null, history: s ? db.history(s.account.id) : [] });
        return;
      }
      if (req.method === 'GET' && path === '/api/pvp/rankings') {
        json(res, 200, { rankings: db.rankings() });
        return;
      }
      if (
        req.method !== 'POST' ||
        !['/api/pvp/register', '/api/pvp/login', '/api/pvp/logout'].includes(path)
      ) {
        json(res, 404, { error: '찾을 수 없는 요청입니다' });
        return;
      }
      if (!origins.has(req.headers.origin ?? '')) {
        json(res, 403, { error: '허용되지 않은 접속 주소입니다' });
        return;
      }
      const ip = req.socket.remoteAddress ?? 'unknown';
      if (!allow(`http:${ip}`, 60)) {
        json(res, 429, { error: '잠시 후 다시 시도하세요' });
        return;
      }
      if (path.endsWith('/logout')) {
        const s = session(req);
        if (s) {
          db.db.prepare('DELETE FROM sessions WHERE token=?').run(s.hash);
          for (const c of connections)
            if (c.tokenHash === s.hash) c.socket.close(4003, 'Signed out');
        }
        res.setHeader(
          'Set-Cookie',
          `mugong-online=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${cookieSecure ? '; Secure' : ''}`,
        );
        json(res, 200, { ok: true });
        return;
      }
      if (!req.headers['content-type']?.startsWith('application/json')) {
        json(res, 415, { error: 'JSON 요청이 필요합니다' });
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 2048) {
          json(res, 413, { error: '요청이 너무 큽니다' });
          return;
        }
        chunks.push(chunk);
      }
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        json(res, 400, { error: '잘못된 요청입니다' });
        return;
      }
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        typeof body.login !== 'string' ||
        typeof body.password !== 'string' ||
        Object.keys(body).some((k) => !['login', 'password', 'name'].includes(k)) ||
        body.password.length > 128 ||
        body.login.length > 20
      ) {
        json(res, 400, { error: '입력 형식을 확인하세요' });
        return;
      }
      const login = body.login.trim().toLowerCase();
      if (!allow(`login:${login}`, 8) || cryptoJobs >= 4) {
        json(res, 429, { error: '잠시 후 다시 시도하세요' });
        return;
      }
      cryptoJobs++;
      let account: OnlineAccount | null;
      try {
        account = path.endsWith('/register')
          ? await db.register(login, body.password, typeof body.name === 'string' ? body.name : '')
          : await db.login(login, body.password);
      } finally {
        cryptoJobs--;
      }
      if (!account) {
        json(res, 401, { error: '아이디 또는 비밀번호를 확인하세요' });
        return;
      }
      const token = randomBytes(32).toString('hex');
      db.db
        .prepare('INSERT INTO sessions(token,account,expires) VALUES(?,?,?)')
        .run(digest(token), account.id, Date.now() + 8 * 60 * 60 * 1000);
      res.setHeader(
        'Set-Cookie',
        `mugong-online=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${cookieSecure ? '; Secure' : ''}`,
      );
      json(res, 200, { account });
    } catch (e) {
      json(res, 400, {
        error:
          e instanceof Error && /아이디|비밀번호|이름/.test(e.message)
            ? e.message
            : '요청을 처리하지 못했습니다',
      });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    const s = session(req);
    if (
      req.url !== '/api/pvp/socket' ||
      !origins.has(req.headers.origin ?? '') ||
      !s ||
      connections.size >= 128
    ) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const c: Connection = {
        socket: ws,
        account: s.account,
        tokenHash: s.hash,
        window: Date.now(),
        count: 0,
      };
      connections.add(c);
      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          ws.close(1008, 'Text required');
          return;
        }
        if (Date.now() - c.window > 1000) {
          c.window = Date.now();
          c.count = 0;
        }
        if (++c.count > 100) {
          ws.close(1008, 'Input rate');
          return;
        }
        if (
          !db.db
            .prepare('SELECT token FROM sessions WHERE token=? AND expires>?')
            .get(c.tokenHash, Date.now())
        ) {
          ws.close(4003, 'Session expired');
          return;
        }
        let message: ClientMessage | null = null;
        try {
          message = parsePvpMessage(JSON.parse(data.toString()));
        } catch {
          /* Reject without exposing internals. */
        }
        if (!message) {
          error(c, '잘못된 대전 입력입니다');
          return;
        }
        try {
          handle(c, message);
        } catch (e) {
          error(c, e instanceof Error ? e.message : '대전 요청 실패');
        }
      });
      ws.on('error', () => {
        /* close handles state; no credential-bearing request logs. */
      });
      ws.on('close', () => {
        depart(c);
        connections.delete(c);
      });
      send(c, { type: 'idle' });
    });
  });
  let previous = performance.now(),
    accumulator = 0,
    frames = 0;
  const timer = setInterval(() => {
    if (closed) return;
    const now = Date.now(),
      clock = performance.now();
    accumulator += Math.min(0.15, (clock - previous) / 1000);
    previous = clock;
    while (accumulator >= 1 / 60) {
      for (const room of rooms.values())
        if (room.match && room.match.phase !== 'finished') {
          const oldEpoch = room.match.epoch;
          const inputs = room.seats.map((p) =>
            p?.connection && now - p.lastInput <= R.inputTimeoutMs ? p.input : neutralInput(),
          ) as [PvpInput, PvpInput];
          stepPvp(room.match, inputs);
          for (const p of room.seats)
            if (p) {
              p.input.defense = p.input.ultimate = false;
              p.input.switch = 0;
              if (oldEpoch !== room.match.epoch) {
                p.input = neutralInput();
                p.seq = -1;
              }
            }
        }
      accumulator -= 1 / 60;
      frames++;
    }
    if (frames >= 3) {
      frames = 0;
      for (const room of rooms.values()) {
        if (room.match && room.match.phase !== 'finished') {
          const absent = room.seats.map(
            (p) =>
              !p?.connection &&
              !!p?.disconnectedAt &&
              now - p.disconnectedAt >= (options.reconnectMs ?? R.reconnectMs),
          );
          if (absent[0] || absent[1]) {
            const bothDisconnected = room.seats.every((p) => !p?.connection);
            finishPvp(
              room.match,
              bothDisconnected ? null : absent[0] ? 1 : 0,
              bothDisconnected ? 'abandoned' : 'disconnect',
            );
          }
        }
        if (room.match?.phase === 'finished' && !room.receipt) trySettle(room);
        if (!room.match && now - room.updated > (room.mode === 'ranked' ? 60000 : 600000)) {
          for (const p of room.seats)
            if (p?.connection) {
              const c = p.connection;
              c.room = undefined;
              c.seat = undefined;
              error(c, '준비 시간이 지나 대전을 취소했습니다');
              send(c, { type: 'idle' });
            }
          rooms.delete(room.code);
          continue;
        }
        publish(room);
        if (!room.match)
          for (const seat of [0, 1] as const) {
            const p = room.seats[seat];
            if (p && !p.connection && p.disconnectedAt && now - p.disconnectedAt > 30000)
              room.seats[seat] = null;
          }
        if (
          room.seats.every((p) => !p || !p.connection) &&
          now - Math.max(room.updated, ...room.seats.map((p) => p?.disconnectedAt ?? 0)) > 60000 &&
          (!room.match || room.receipt)
        )
          rooms.delete(room.code);
      }
    }
    for (const a of queued) {
      if (!a.queued || a.socket.readyState !== WebSocket.OPEN) {
        cancelQueue(a);
        continue;
      }
      const rating = db.account(a.account.id)!.rating,
        range = Math.min(300, 100 + Math.floor((now - a.queued.since) / 30000) * 25);
      const b = [...queued]
        .filter(
          (c) =>
            c !== a &&
            c.account.id !== a.account.id &&
            c.queued &&
            Math.abs(db.account(c.account.id)!.rating - rating) <= range,
        )
        .sort((x, y) => x.queued!.since - y.queued!.since)[0];
      if (b && rooms.size < 64) {
        const pa = a.queued.preset,
          pb = b.queued!.preset;
        cancelQueue(a);
        cancelQueue(b);
        const room = newRoom('ranked');
        join(a, room, pa);
        join(b, room, pb);
      }
    }
    if (rate.size > 1000) for (const [key, v] of rate) if (now - v.at > 60000) rate.delete(key);
  }, 1000 / 60);
  timer.unref();
  return {
    server,
    db,
    async close() {
      closed = true;
      clearInterval(timer);
      for (const c of connections) c.socket.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
    },
  };
}
