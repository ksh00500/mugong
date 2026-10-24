import type { ClientMessage } from './model';
export interface ControlClient {
  getSnapshot(): {
    connected: boolean;
    seat: number;
    room: {
      match: {
        id: string;
        epoch: number;
        phase: string;
        tick: number;
        players: readonly { fighter: BoundFighter }[];
      } | null;
    } | null;
  };
  send(message: Extract<ClientMessage, { type: 'input' }>): boolean;
}
import { neutralInput, type PvpInput } from './model';
import { PVP_RULES as R } from './rules';
import type { BoundFighter } from '../domain/model';
import { fighterMoveSpeed } from '../domain/fighter-combat-values';
import { supportStats } from '../domain/support';
export class PvpControls {
  readonly input = neutralInput();
  private keys = new Set<string>();
  private seq = 0;
  private epochKey = '';
  private timer?: ReturnType<typeof setInterval>;
  private disposeFns: (() => void)[] = [];
  private history: { seq: number; at: number; input: PvpInput }[] = [];
  private prediction = { key: '', tick: -1, x: 0, y: 0, at: 0 };
  private rendering = true;
  constructor(
    private client: ControlClient,
    private blocked: () => boolean,
  ) {}
  start() {
    if (this.timer) return;
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest('input,select,textarea,button,a,[role="dialog"]') ||
        this.blocked() ||
        !this.rendering
      )
        return;
      const k = e.key.toLowerCase();
      if (!['w', 'a', 's', 'd', 'q', 'e', ' '].includes(k)) return;
      e.preventDefault();
      this.keys.add(k);
      this.movement();
      if (!e.repeat) {
        if (k === ' ') this.input.defense = true;
        if (k === 'q' || k === 'e') this.input.switch = k === 'q' ? -1 : 1;
        this.flush();
      }
    };
    const up = (e: KeyboardEvent) => {
      this.keys.delete(e.key.toLowerCase());
      this.movement();
      this.flush();
    };
    const clear = () => this.clear();
    const hide = () => {
      if (document.hidden) this.clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', hide);
    this.disposeFns = [
      () => window.removeEventListener('keydown', down),
      () => window.removeEventListener('keyup', up),
      () => window.removeEventListener('blur', clear),
      () => document.removeEventListener('visibilitychange', hide),
    ];
    this.timer = setInterval(() => this.flush(), 1000 / 30);
  }
  private movement() {
    this.input.dx = Number(this.keys.has('d')) - Number(this.keys.has('a'));
    this.input.dy = Number(this.keys.has('s')) - Number(this.keys.has('w'));
  }
  flush() {
    const view = this.client.getSnapshot(),
      m = view.room?.match,
      key = m ? `${m.id}:${m.epoch}` : '';
    if (key !== this.epochKey || !view.connected) {
      this.epochKey = key;
      this.seq = 0;
      Object.assign(this.input, neutralInput(), { aim: m?.players[view.seat].fighter.facing ?? 0 });
      this.keys.clear();
      this.history = [];
    }
    if (!m || m.phase !== 'fighting' || !view.connected) return;
    const input = this.blocked() || !this.rendering ? neutralInput() : { ...this.input };
    if (this.client.send({ type: 'input', epoch: m.epoch, seq: this.seq, ...input })) {
      this.history.push({ seq: this.seq++, at: performance.now(), input });
      this.history = this.history.slice(-12);
      this.input.defense = this.input.ultimate = false;
      this.input.switch = 0;
    }
  }
  action(action: 'defense' | 'ultimate' | 'previous' | 'next') {
    if (this.blocked() || !this.rendering) return;
    // Synchronize the epoch before inserting a new one-shot action.
    this.flush();
    if (action === 'previous' || action === 'next')
      this.input.switch = action === 'previous' ? -1 : 1;
    else this.input[action] = true;
    this.flush();
  }
  clear() {
    this.keys.clear();
    Object.assign(this.input, neutralInput(), { aim: this.input.aim });
    this.flush();
  }
  setRendering(value: boolean) {
    this.rendering = value;
    if (!value) this.clear();
  }
  /** Predict only movement; HP, contacts, defenses and results stay authoritative. */
  position(f: BoundFighter, tick: number, ack: number, personal = false) {
    const now = performance.now(),
      key = this.epochKey,
      p = this.prediction;
    const integrate = (input: PvpInput, dt: number) => {
      if (!input.dx && !input.dy) return;
      const n = Math.hypot(input.dx, input.dy),
        speed =
          (personal ? fighterMoveSpeed(f) : R.speed) *
          (f.action === 'attack' ? (personal ? supportStats(f).attackMovementFactor : 0.6) : 1);
      if (f.actionTime > 0 && f.action !== 'attack') return;
      p.x += (input.dx / n) * speed * dt;
      p.y += (input.dy / n) * speed * dt;
    };
    if (p.key !== key || p.tick !== tick) {
      p.key = key;
      p.tick = tick;
      p.x = f.x;
      p.y = f.y;
      this.history = this.history.filter((h) => h.seq > ack);
      for (let i = 0; i < this.history.length; i++) {
        const h = this.history[i],
          end = this.history[i + 1]?.at ?? now;
        integrate(h.input, Math.min(0.05, Math.max(0, end - h.at) / 1000));
      }
    } else if (!this.blocked()) integrate(this.input, Math.min(0.05, (now - p.at) / 1000));
    p.at = now;
    p.x = Math.max(R.left, Math.min(R.right, p.x));
    p.y = Math.max(R.top, Math.min(R.bottom, p.y));
    return { x: p.x, y: p.y };
  }
  destroy() {
    clearInterval(this.timer);
    this.timer = undefined;
    this.clear();
    for (const fn of this.disposeFns) fn();
    this.disposeFns = [];
  }
}
