import { WebSocket } from 'ws';
import { tick } from '../domain/game';
import { pendingChoices } from '../domain/character';
import { nearestWaystationStop } from '../domain/waystation';
import type { InputFrame } from '../domain/model';
import type { CombatCue } from '../domain/combat';
import { onlineCommand, onlineInput, type OnlineSave } from './protocol';
import { OnlineRepository } from './repository';
const neutral = (): InputFrame => ({
  dx: 0,
  dy: 0,
  aim: 0,
  attack: false,
  defense: false,
  ultimate: false,
});
type Session = {
  ws: WebSocket;
  account: string;
  hash: string;
  input: InputFrame;
  seq: number;
  at: number;
  paused: boolean;
  count: number;
  window: number;
  pending?: OnlineSave;
  cues?: CombatCue[];
};
export class OnlineHub {
  private sessions = new Map<string, Session>();
  private timer: ReturnType<typeof setInterval>;
  constructor(
    readonly repo: OnlineRepository,
    private valid: (hash: string) => boolean,
    private busy: (account: string) => boolean,
  ) {
    // Six fixed simulation steps per durable publication. No client clock advances the world.
    this.timer = setInterval(() => this.step(), 100);
    this.timer.unref();
  }
  hasAccount(account: string) {
    return this.sessions.has(account);
  }
  hasPending(account: string) {
    return !!this.sessions.get(account)?.pending;
  }
  read(account: string) {
    if (this.hasPending(account)) throw Error('서버 저장 재시도 중입니다');
    return this.repo.refresh(account);
  }
  private send(s: Session, value: unknown) {
    if (s.ws.readyState === WebSocket.OPEN) {
      if (s.ws.bufferedAmount > 1024 * 1024) s.ws.close(1013);
      else s.ws.send(JSON.stringify(value));
    }
  }
  accept(ws: WebSocket, account: string, hash: string) {
    if (this.sessions.size >= 16 && !this.sessions.has(account)) {
      ws.close(1013);
      return;
    }
    const previous = this.sessions.get(account);
    previous?.ws.close(4001, 'Connected elsewhere');
    const s: Session = {
      ws,
      account,
      hash,
      input: neutral(),
      seq: -1,
      at: 0,
      paused: true,
      count: 0,
      window: Date.now(),
      pending: previous?.pending,
      cues: previous?.cues,
    };
    this.sessions.set(account, s);
    try {
      if (s.pending) this.send(s, { type: 'error', message: '서버 저장 재시도 중입니다' });
      else this.send(s, { type: 'state', save: this.repo.refresh(account) });
    } catch {
      this.sessions.delete(account);
      ws.close(1011, 'Online save unavailable');
      return;
    }
    ws.on('error', () => {});
    ws.on('close', () => {
      if (this.sessions.get(account) === s && !s.pending) this.sessions.delete(account);
      s.paused = true;
    });
    ws.on('message', (raw, binary) => {
      let op: unknown;
      try {
        if (this.sessions.get(account) !== s) return;
        if (!this.valid(hash)) {
          ws.close(4003);
          return;
        }
        if (Date.now() - s.window > 1000) {
          s.count = 0;
          s.window = Date.now();
        }
        if (binary || ++s.count > 70) {
          ws.close(1008);
          return;
        }
        const m = JSON.parse(raw.toString());
        op = m.op;
        if (s.pending) throw Error('서버 저장 재시도 중입니다');
        if (m.type === 'read') {
          this.send(s, { type: 'state', save: this.repo.refresh(account) });
          return;
        }
        if (m.type === 'pause' && typeof m.value === 'boolean' && Object.keys(m).length === 2) {
          s.paused = m.value;
          s.input = neutral();
          return;
        }
        if (m.type === 'input') {
          const input = onlineInput(m.input);
          if (
            !input ||
            Object.keys(m).length !== 3 ||
            !Number.isSafeInteger(m.seq) ||
            m.seq <= s.seq ||
            m.seq - s.seq > 10000
          )
            return;
          s.seq = m.seq;
          s.at = Date.now();
          s.input = {
            ...input,
            defense: s.input.defense || input.defense,
            ultimate: s.input.ultimate || input.ultimate,
          };
          return;
        }
        if (
          m.type !== 'command' ||
          Object.keys(m).length !== 4 ||
          typeof m.op !== 'string' ||
          !/^[a-f0-9-]{36}$/.test(m.op) ||
          !Number.isSafeInteger(m.revision)
        )
          throw Error('잘못된 온라인 요청입니다');
        const intent = onlineCommand(m.command);
        if (!intent) throw Error('허용되지 않은 요청입니다');
        const save = this.repo.read(account),
          run = save.state.run;
        const services: Record<string, string> = {
          heal: 'physician',
          refine: 'blacksmith',
          buySupply: 'merchant',
          sellMaterial: 'merchant',
          next: 'exit',
          restEvent: 'fortune',
        };
        if (
          run?.phase === 'prep' &&
          services[intent.type] &&
          nearestWaystationStop(run.fighter, run)?.id !== services[intent.type]
        )
          throw Error('가까이 다가가 상호작용하세요');
        if (this.busy(account)) throw Error('현재 온라인 출전을 마치고 변경하세요');
        const next = this.repo.apply(account, m.revision, m.op, intent);
        this.send(s, { type: 'ack', op: m.op, save: next });
      } catch (e) {
        this.send(s, {
          type: 'error',
          op,
          message: e instanceof Error ? e.message : '온라인 요청 실패',
        });
      }
    });
  }
  private step() {
    for (const s of this.sessions.values()) {
      try {
        if (s.pending) {
          const next = this.repo.write(s.account, s.pending.revision, s.pending.state);
          s.pending = undefined;
          this.send(s, { type: 'state', save: next, cues: s.cues });
          s.cues = undefined;
          if (s.ws.readyState !== WebSocket.OPEN) this.sessions.delete(s.account);
          continue;
        }
        if (!this.valid(s.hash)) {
          s.ws.close(4003);
          continue;
        }
        if (
          s.paused ||
          s.ws.readyState !== WebSocket.OPEN ||
          Date.now() - s.at > 250 ||
          this.busy(s.account)
        )
          continue;
        const save = this.repo.read(s.account),
          r = save.state.run;
        if (save.locked || !r || pendingChoices(r) || !['combat', 'prep'].includes(r.phase))
          continue;
        const input = { ...s.input };
        const cues: CombatCue[] = [];
        for (let n = 0; n < 6; n++) {
          tick(r, input, 1 / 60, (cue) => cues.push(cue));
          input.defense = input.ultimate = false;
          if (pendingChoices(r) || r.phase === 'dead' || r.phase === 'loot') break;
        }
        s.input.defense = s.input.ultimate = false;
        s.pending = save;
        s.cues = cues;
        const next = this.repo.write(s.account, save.revision, save.state);
        s.pending = undefined;
        this.send(s, { type: 'state', save: next, cues });
        s.cues = undefined;
      } catch {
        s.paused = true;
        this.send(s, {
          type: 'error',
          message: '서버 저장 재시도 중입니다. 진행을 보존하고 멈췄습니다',
        });
      }
    }
  }
  logout(hash: string) {
    for (const s of this.sessions.values()) if (s.hash === hash) s.ws.close(4003);
  }
  close() {
    clearInterval(this.timer);
    for (const s of this.sessions.values()) s.ws.terminate();
  }
}
