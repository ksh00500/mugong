import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type { PvpDatabase } from '../pvp/server/database';
import { neutralInput, type OnlineAccount, type PresetId, type PvpInput } from '../pvp/model';
import { parseRaidMessage } from './protocol';
import {
  createRaid,
  nextRaidFloor,
  stepRaid,
  finishRaid,
  returnRaidPlayer,
  raidMedicine,
  cancelRaidCountdown,
  expirePersonalRaid,
} from './engine';
import type { RaidMessage, RaidRoom, RaidState, RaidReceipt } from './model';
import type { BoundFighter } from '../domain/model';
import {
  reserveFighter,
  savePersonalRaid,
  raidPersonalCommand,
  recoverHeir,
  releaseWaitingFighter,
} from '../online/raid-persistence';
type Client = {
  ws: WebSocket;
  account: OnlineAccount;
  hash: string;
  room?: Room;
  seat?: number;
  count: number;
  window: number;
};
type Member = {
  operation?: string;
  fighterId?: string;
  fighter?: BoundFighter;
  account: OnlineAccount;
  preset: PresetId;
  client?: Client;
  ready: boolean;
  input: PvpInput;
  seq: number;
  lastInput: number;
  offlineAt?: number;
  receipt?: RaidReceipt;
  releaseAfterSettle?: boolean;
};
type Room = {
  checkpointPending?: boolean;
  personal?: boolean;
  code: string;
  revision: number;
  host: number;
  seats: (Member | null)[];
  match: RaidState | null;
  updated: number;
  checkpoint: number;
  settling: boolean;
  retryAt: number;
};
export class RaidHub {
  private clients = new Set<Client>();
  private rooms = new Map<string, Room>();
  private timer: ReturnType<typeof setInterval>;
  private before = performance.now();
  private accumulator = 0;
  private frames = 0;
  constructor(
    private db: PvpDatabase,
    private valid: (hash: string) => boolean,
    private busy: (id: string) => boolean,
    private grace = 90000,
    private factory = createRaid,
  ) {
    for (const row of db.db.prepare('SELECT state FROM online_raids').all()) {
      const r = JSON.parse(String(row.state)) as Room;
      for (const p of r.seats)
        if (p) {
          p.client = undefined;
          p.ready = false;
          p.input = neutralInput();
          p.offlineAt = Date.now();
        }
      r.retryAt = 0;
      r.settling = false;
      r.updated = Date.now();
      this.rooms.set(r.code, r);
    }
    this.timer = setInterval(() => this.tick(), 1000 / 60);
    this.timer.unref();
  }
  hasAccount(id: string) {
    return !!this.find(id);
  }
  private find(id: string) {
    for (const room of this.rooms.values()) {
      const seat = room.seats.findIndex(
        (p) => p?.account.id === id && !(p.releaseAfterSettle && p.receipt),
      );
      if (seat >= 0) return { room, seat };
    }
    return null;
  }
  private send(c: Client, m: unknown) {
    if (c.ws.readyState !== WebSocket.OPEN) return;
    if (c.ws.bufferedAmount > 131072) {
      c.ws.close(1013, 'Slow connection');
      return;
    }
    c.ws.send(JSON.stringify(m));
  }
  private state(r: Room, seat: number): RaidRoom {
    return {
      operation: r.seats[seat]?.operation,
      personal: r.personal,
      ownSave: r.personal ? this.db.online.read(r.seats[seat]!.account.id) : undefined,
      code: r.code,
      revision: r.revision,
      host: r.host,
      seats: r.seats.map((p, i) =>
        p
          ? {
              name: p.account.name,
              preset: p.preset,
              ready: p.ready,
              connected: !!p.client,
              ack: p.seq,
              status: r.match?.status[i] ?? 'active',
              fighter: p.fighter,
            }
          : null,
      ),
      match: r.match,
      receipt: r.seats[seat]?.receipt ?? null,
      settling: r.settling,
    };
  }
  private publish(r: Room) {
    if (r.personal) {
      if (r.checkpointPending && Date.now() < r.retryAt) return;
      try {
        r.match = savePersonalRaid(this.db.online, r.code, r.seats, r.match, (m) =>
          this.serialize(r, m),
        );
        if (r.checkpointPending) r.settling = false;
        r.checkpointPending = false;
      } catch {
        r.settling = true;
        r.checkpointPending = true;
        r.retryAt = Date.now() + 1000;
      }
    }
    for (let i = 0; i < 4; i++) {
      const c = r.seats[i]?.client;
      if (c) {
        try {
          this.send(c, { type: 'room', seat: i, room: this.state(r, i) });
        } catch {
          this.send(c, {
            type: 'error',
            message: '온라인 저장을 확인하지 못했습니다. 진행을 멈추고 다시 확인합니다',
          });
          r.settling = true;
        }
      }
    }
  }
  private serialize(r: Room, m: RaidState | null = r.match) {
    return JSON.stringify({
      ...r,
      match: m,
      seats: r.seats.map((p) => (p ? { ...p, client: undefined, input: neutralInput() } : null)),
    });
  }
  private revise(r: Room) {
    r.revision++;
    for (const p of r.seats) if (p) p.ready = false;
    r.updated = Date.now();
  }
  private attach(c: Client, r: Room, seat: number) {
    const p = r.seats[seat]!;
    if (p.client && p.client !== c) {
      p.client.room = undefined;
      p.client.ws.close(4001, 'Connected elsewhere');
    }
    p.client = c;
    p.offlineAt = undefined;
    p.input = neutralInput();
    p.seq = -1;
    p.lastInput = 0;
    c.room = r;
    c.seat = seat;
    this.publish(r);
  }
  accept(ws: WebSocket, account: OnlineAccount, hash: string) {
    const c: Client = { ws, account, hash, count: 0, window: Date.now() };
    this.clients.add(c);
    ws.on('message', (data, binary) => {
      if (binary) {
        ws.close(1008);
        return;
      }
      const now = Date.now();
      if (now - c.window > 1000) {
        c.window = now;
        c.count = 0;
      }
      if (++c.count > 100) {
        ws.close(1008);
        return;
      }
      if (!this.valid(hash)) {
        ws.close(4003, 'Session expired');
        return;
      }
      try {
        const msg = parseRaidMessage(JSON.parse(data.toString()));
        if (!msg) throw Error('잘못된 레이드 입력입니다');
        this.handle(c, msg);
      } catch (e) {
        this.send(c, {
          type: 'error',
          message: e instanceof Error ? e.message : '레이드 요청 실패',
        });
      }
    });
    ws.on('error', () => {});
    ws.on('close', () => {
      this.depart(c, false);
      this.clients.delete(c);
    });
    this.send(c, { type: 'idle' });
  }
  logout(hash: string) {
    for (const c of this.clients) if (c.hash === hash) c.ws.close(4003, 'Signed out');
  }
  private handle(c: Client, m: RaidMessage) {
    if (m.type === 'ping') {
      this.send(c, { type: 'pong', sent: m.sent });
      return;
    }
    if (m.type === 'resume') {
      const found = this.find(c.account.id);
      if (found) this.attach(c, found.room, found.seat);
      else this.send(c, { type: 'idle' });
      return;
    }
    if (m.type === 'leave') {
      this.depart(c, true);
      this.send(c, { type: 'idle' });
      return;
    }
    if (m.type === 'create' || m.type === 'join') {
      if (c.room || this.find(c.account.id) || this.busy(c.account.id))
        throw Error('현재 온라인 출전을 마치고 참가하세요');
      let r: Room;
      if (m.type === 'create') {
        if (this.rooms.size >= 32) throw Error('레이드 방이 가득 찼습니다');
        let code: string;
        do {
          code = randomBytes(4)
            .toString('hex')
            .slice(0, 6)
            .toUpperCase()
            .replace(/0/g, 'A')
            .replace(/1/g, 'B');
        } while (this.rooms.has(code));
        r = {
          personal: !!m.fighterId,
          code,
          revision: 0,
          host: 0,
          seats: [null, null, null, null],
          match: null,
          updated: Date.now(),
          checkpoint: 0,
          settling: false,
          retryAt: 0,
        };
        this.rooms.set(code, r);
      } else {
        const found = this.rooms.get(m.code);
        if (!found || found.match) throw Error('참가 가능한 레이드 방을 찾을 수 없습니다');
        r = found;
        if (!!r.personal !== !!m.fighterId)
          throw Error('표준 파티와 개인 무인 파티는 출전 방식을 맞춰 주세요');
      }
      const seat = r.seats.findIndex((p) => !p);
      if (seat < 0) throw Error('방이 가득 찼습니다');
      let fighter: BoundFighter | undefined;
      const member: Member = {
        account: c.account,
        preset: m.preset,
        ready: false,
        input: neutralInput(),
        seq: -1,
        lastInput: 0,
        fighterId: m.fighterId,
      };
      try {
        if (m.fighterId)
          fighter = reserveFighter(this.db.online, c.account.id, m.fighterId, r.code, (f) =>
            this.serialize({
              ...r,
              seats: r.seats.map((p, i) => (i === seat ? { ...member, fighter: f } : p)),
            }),
          );
      } catch (e) {
        if (!r.seats.some(Boolean)) this.rooms.delete(r.code);
        throw e;
      }
      r.seats[seat] = {
        fighterId: m.fighterId,
        fighter,
        account: c.account,
        preset: m.preset,
        ready: false,
        input: neutralInput(),
        seq: -1,
        lastInput: 0,
      };
      this.revise(r);
      this.attach(c, r, seat);
      return;
    }
    const r = c.room,
      seat = c.seat,
      p = seat !== undefined ? r?.seats[seat] : null;
    if (!r || seat === undefined || !p || p.client !== c) throw Error('먼저 레이드에 참가하세요');
    if (m.type === 'input') {
      if (
        r.settling ||
        !r.match ||
        r.match.phase !== 'fighting' ||
        r.match.status[seat] !== 'active' ||
        m.epoch !== r.match.epoch ||
        m.seq <= p.seq ||
        m.seq - p.seq > 10000
      )
        return;
      p.seq = m.seq;
      p.lastInput = Date.now();
      p.input = {
        dx: m.dx,
        dy: m.dy,
        aim: m.aim,
        attack: m.attack,
        defense: p.input.defense || m.defense,
        ultimate: p.input.ultimate || m.ultimate,
        switch: m.switch || p.input.switch,
      };
      return;
    }
    if (!('revision' in m)) return;
    if (m.revision !== r.revision) throw Error('파티 구성이 바뀌었습니다. 다시 확인하세요');
    if (r.settling) throw Error('진행 기록 저장을 기다려 주세요');
    if (m.type === 'personal') {
      if (!r.match) throw Error('층 정비 중에 변경하세요');
      r.match = raidPersonalCommand(
        this.db.online,
        r.code,
        r.seats,
        r.match,
        seat,
        m.command,
        m.op,
        (next) => this.serialize(r, next),
      );
      p.operation = m.op;
      this.revise(r);
      this.publish(r);
      return;
    }
    if (m.type === 'recoverHeir') {
      if (!r.match) throw Error('정비 중에 수습하세요');
      recoverHeir(r.match, seat, m.id);
      this.revise(r);
      this.publish(r);
      return;
    }
    if (
      (m.type === 'return' || m.type === 'unready') &&
      r.match?.status[seat] === 'active' &&
      cancelRaidCountdown(r.match)
    )
      this.revise(r);
    if (r.match && r.match.phase !== 'rest') throw Error('전투 중에는 변경할 수 없습니다');
    if (r.match && r.match.status[seat] !== 'active') throw Error('출전을 마친 무인입니다');
    if (m.type === 'unready') p.ready = false;
    if (m.type === 'ready') {
      if (r.personal) {
        this.checkLifetime(r);
        const save = this.db.online.read(c.account.id);
        if (
          save.state.family.training ||
          save.state.family.roster
            .find((f) => f.id === p.fighterId)
            ?.items.some((i) => i.place === 'ground')
        )
          throw Error('성장과 전리품 수납을 마치세요');
      }
      p.ready = true;
    }
    if (m.type === 'medicine') {
      if (!r.match || !raidMedicine(r.match, seat))
        throw Error('정비 중 체력이 부족할 때 사용합니다');
      this.revise(r);
    }
    if (m.type === 'return') {
      if (!r.match || !returnRaidPlayer(r.match, seat))
        throw Error('층을 마친 뒤 귀환할 수 있습니다');
      this.revise(r);
      this.settle(r);
    }
    if (m.type === 'start') {
      if (seat !== r.host) throw Error('방장만 첫 출발을 선택할 수 있습니다');
      if (r.match) throw Error('다음 층은 남은 전원 준비 후 출발합니다');
      if (!r.seats.filter(Boolean).every((p) => p!.client && p!.ready))
        throw Error('전원이 그림 준비와 대전 준비를 마쳐야 합니다');
      if (r.personal) this.checkLifetime(r);
      const state = this.factory(
        randomUUID(),
        r.seats.map((p) =>
          p
            ? { name: p.fighter?.name ?? p.account.name, preset: p.preset, fighter: p.fighter }
            : null,
        ),
      );
      if (r.personal) {
        r.match = savePersonalRaid(this.db.online, r.code, r.seats, state, (next) =>
          this.serialize(r, next),
        );
      } else {
        this.db.beginRaid(
          state.id,
          r.seats.filter(Boolean).map((p) => p!.account.id),
        );
        r.match = state;
      }
      this.revise(r);
    } else if (
      m.type === 'ready' &&
      r.match &&
      this.activeMembers(r).every((x) => x.p.client && x.p.ready)
    ) {
      nextRaidFloor(r.match);
      this.revise(r);
    }
    this.publish(r);
  }
  private activeMembers(r: Room) {
    return r.seats.flatMap((p, i) =>
      p && (!r.match || r.match.status[i] === 'active') ? [{ p, i }] : [],
    );
  }
  private checkLifetime(r: Room) {
    const duration = ((r.match ? 5 - r.match.cleared : 5) * 5 + 5) * 60000;
    for (const { p, i } of this.activeMembers(r)) {
      const f = r.match?.players[i].fighter ?? p.fighter;
      if (!f?.expiresAt || f.expiresAt - Date.now() < duration)
        throw Error('다음 전투를 마치기에 수명이 부족합니다. 귀환 후 무인을 확인하세요');
    }
  }
  private settle(r: Room) {
    let m = r.match;
    if (!m || Date.now() < r.retryAt) return;
    try {
      if (r.personal) {
        if (m.phase === 'finished' && (m.result === 'time' || m.result === 'abandoned'))
          for (let i = 0; i < 4; i++)
            if (m.status[i] === 'active') {
              m.status[i] = 'dead';
              m.players[i].fighter.hp = 0;
            }
        m = r.match = savePersonalRaid(this.db.online, r.code, r.seats, m, (next) =>
          this.serialize(r, next),
        )!;
      }
      if (m.cleared > r.checkpoint) {
        this.db.checkpointRaid(m.id, m.cleared);
        r.checkpoint = m.cleared;
      }
      for (let i = 0; i < 4; i++) {
        const p = r.seats[i];
        if (!p || p.receipt || (m.status[i] === 'active' && m.phase !== 'finished')) continue;
        p.receipt = this.db.settleRaid(p.account.id, {
          id: `${m.id}:${i}`,
          runId: m.id,
          name: p.account.name,
          outcome:
            m.status[i] === 'expired'
              ? 'expired'
              : m.status[i] === 'dead'
                ? 'dead'
                : m.status[i] === 'returned'
                  ? 'returned'
                  : (m.result ?? 'abandoned'),
          floor: m.cleared,
          damage: Math.round(m.damage[i]),
          taken: Math.round(m.taken[i]),
          finishedAt: Date.now(),
        });
        if (
          r.personal &&
          (m.status[i] === 'returned' || m.status[i] === 'expired' || m.phase === 'finished')
        )
          p.releaseAfterSettle = true;
      }
      r.settling = false;
    } catch {
      r.settling = true;
      r.retryAt = Date.now() + 1000;
    }
  }
  private depart(c: Client, explicit: boolean) {
    const r = c.room,
      i = c.seat;
    if (!r || i === undefined || r.seats[i]?.client !== c) return;
    const p = r.seats[i]!;
    if (explicit && !r.match && p.fighterId) {
      const next = { ...r, seats: r.seats.map((p, j) => (j === i ? null : p)) };
      releaseWaitingFighter(
        this.db.online,
        p.account.id,
        r.code,
        next.seats.some(Boolean) ? this.serialize(next) : null,
      );
    }
    p.client = undefined;
    p.input = neutralInput();
    p.offlineAt = Date.now();
    if (explicit) {
      if (r.match) {
        if (r.match.phase !== 'finished' && r.match.status[i] === 'active') {
          if (r.match.phase === 'rest') returnRaidPlayer(r.match, i);
          else {
            r.match.players[i].fighter.hp = 0;
            r.match.status[i] = 'dead';
          }
          this.settle(r);
        }
        // Retain the member/receipt until the room closes; membership no longer reserves the account.
        p.releaseAfterSettle = true;
      } else {
        r.seats[i] = null;
      }
      c.room = undefined;
      c.seat = undefined;
    }
    if (!r.match || r.match.phase === 'rest') this.revise(r);
    if (r.seats.every((p) => !p)) {
      if (r.personal) this.db.db.prepare('DELETE FROM online_raids WHERE code=?').run(r.code);
      this.rooms.delete(r.code);
      return;
    }
    if (!r.seats[r.host]?.client) {
      const host = r.seats.findIndex((p) => !!p?.client);
      if (host >= 0) r.host = host;
    }
    this.publish(r);
  }
  private tick() {
    const now = Date.now(),
      clock = performance.now();
    this.accumulator += Math.min(0.15, (clock - this.before) / 1000);
    this.before = clock;
    while (this.accumulator >= 1 / 60) {
      for (const r of this.rooms.values())
        if (r.match && !r.settling) {
          if (expirePersonalRaid(r.match, now)) {
            this.revise(r);
            this.settle(r);
            if (r.settling) continue;
          }
          const epoch = r.match.epoch;
          stepRaid(
            r.match,
            r.seats.map((p) => (p?.client && now - p.lastInput <= 200 ? p.input : undefined)),
          );
          for (const p of r.seats)
            if (p) {
              p.input.defense = p.input.ultimate = false;
              p.input.switch = 0;
              if (epoch !== r.match.epoch) {
                p.input = neutralInput();
                p.seq = -1;
              }
            }
        }
      this.accumulator -= 1 / 60;
      this.frames++;
    }
    if (this.frames < 3) return;
    this.frames = 0;
    for (const r of this.rooms.values()) {
      if (!r.match && r.personal)
        for (let i = 0; i < 4; i++) {
          const p = r.seats[i];
          if (p?.fighter?.expiresAt !== undefined && p.fighter.expiresAt <= now) {
            const next = { ...r, seats: r.seats.map((q, j) => (j === i ? null : q)) };
            try {
              releaseWaitingFighter(
                this.db.online,
                p.account.id,
                r.code,
                next.seats.some(Boolean) ? this.serialize(next) : null,
                now,
              );
              r.seats[i] = null;
              if (p.client) {
                p.client.room = undefined;
                p.client.seat = undefined;
                this.send(p.client, { type: 'idle' });
              }
              this.revise(r);
            } catch {
              r.settling = true;
            }
          }
        }
      if (r.personal && !r.seats.some(Boolean)) {
        this.rooms.delete(r.code);
        continue;
      }
      const m = r.match;
      if (m) {
        for (const { p, i } of this.activeMembers(r))
          if (!p.client && p.offlineAt && now - p.offlineAt > this.grace && m.phase === 'rest') {
            returnRaidPlayer(m, i);
            this.revise(r);
          }
        if (
          m.phase !== 'finished' &&
          r.seats.every((p) => !p?.client) &&
          now - Math.max(r.updated, ...r.seats.map((p) => p?.offlineAt ?? 0)) > this.grace
        )
          finishRaid(m, 'abandoned');
        if (m.phase === 'rest' || m.phase === 'finished' || m.status.some((s) => s === 'dead'))
          this.settle(r);
      }
      this.publish(r);
      if (
        r.seats.every((p) => !p?.client) &&
        now - Math.max(r.updated, ...r.seats.map((p) => p?.offlineAt ?? 0)) >
          (m ? this.grace + 30000 : 600000) &&
        !r.settling
      ) {
        this.rooms.delete(r.code);
        if (r.personal) {
          this.db.online.transaction(() => {
            this.db.db.prepare('DELETE FROM online_reservations WHERE room=?').run(r.code);
            this.db.db.prepare('DELETE FROM online_raids WHERE code=?').run(r.code);
          });
        }
      }
    }
  }
  close() {
    clearInterval(this.timer);
    for (const c of this.clients) c.ws.terminate();
  }
}
