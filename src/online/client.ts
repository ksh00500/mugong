import type { Command, InputFrame } from '../domain/model';
import type { OnlineSave } from './protocol';
import type { CombatCue } from '../domain/combat';
export const isOnlineGame =
  typeof location !== 'undefined' && location.pathname.startsWith('/online');
export class PersonalClient {
  private socket?: WebSocket;
  private connecting?: Promise<void>;
  private seq = 0;
  private lastInput = 0;
  private paused?: boolean;
  private pendingAttack = false;
  private revision = 0;
  private stopped = false;
  private pending = new Map<
    string,
    { resolve: (v: boolean) => void; timer: ReturnType<typeof setTimeout> }
  >();
  constructor(
    private receive: (v: OnlineSave) => void,
    private fail: (message: string) => void,
    private cues?: (cues: CombatCue[]) => void,
  ) {}
  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.stopped = false;
    this.connecting = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/pvp/online-socket`,
      );
      this.socket = ws;
      this.seq = 0;
      this.paused = undefined;
      const timer = setTimeout(() => {
        ws.close();
        reject(Error('온라인 서버 연결 시간 초과'));
      }, 10000);
      ws.onmessage = (event) => {
        const m = JSON.parse(event.data);
        if (m.save) {
          if (m.cues) this.cues?.(m.cues);
          this.revision = m.save.revision;
          this.receive(m.save);
          clearTimeout(timer);
          resolve();
        }
        if (m.op) {
          const p = this.pending.get(m.op);
          if (p) {
            clearTimeout(p.timer);
            p.resolve(m.type === 'ack');
            this.pending.delete(m.op);
          }
        }
        if (m.type === 'error') this.fail(m.message);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(Error('온라인 서버에 연결하지 못했습니다'));
      };
      ws.onclose = (event) => {
        clearTimeout(timer);
        this.connecting = undefined;
        for (const p of this.pending.values()) {
          clearTimeout(p.timer);
          p.resolve(false);
        }
        this.pending.clear();
        if (!this.stopped)
          this.fail(
            event.code === 4001
              ? '다른 창에서 온라인 세가를 열었습니다'
              : '온라인 연결이 끊겼습니다. 다시 연결하세요',
          );
        reject(Error('온라인 연결이 끊겼습니다'));
      };
    }).finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }
  send(v: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(v));
  }
  command(command: Command) {
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.resolve(false);
    const op = crypto.randomUUID();
    this.pause(true);
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(op);
        this.fail('서버 응답을 확인하지 못했습니다. 다시 연결해 최신 결과를 확인하세요');
        resolve(false);
      }, 10000);
      this.pending.set(op, { resolve, timer });
      this.send({ type: 'command', command, revision: this.revision, op });
    });
  }
  input(input: InputFrame, paused: boolean) {
    this.pendingAttack ||= input.attack;
    const now = performance.now();
    if (now - this.lastInput < 33 && !input.defense && !input.ultimate) return;
    this.lastInput = now;
    this.pause(paused);
    if (!paused) {
      const len = Math.max(1, Math.hypot(input.dx, input.dy));
      this.send({
        type: 'input',
        seq: ++this.seq,
        input: { ...input, attack: this.pendingAttack, dx: input.dx / len, dy: input.dy / len },
      });
      this.pendingAttack = false;
    }
  }
  pause(value: boolean) {
    if (this.paused !== value) {
      this.paused = value;
      this.send({ type: 'pause', value });
    }
  }
  close() {
    this.stopped = true;
    this.socket?.close();
  }
}
