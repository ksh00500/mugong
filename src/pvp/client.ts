import type { ClientMessage, OnlineAccount, RoomState, Seat, ServerMessage } from './model';
export interface OnlineView {
  account: OnlineAccount | null;
  room: RoomState | null;
  seat: Seat;
  connected: boolean;
  connecting: boolean;
  queuedSince: number | null;
  error: string;
  rtt: number;
  receivedAt: number;
}
export class PvpClient {
  private view: OnlineView = {
    account: null,
    room: null,
    seat: 0,
    connected: false,
    connecting: false,
    queuedSince: null,
    error: '',
    rtt: 0,
    receivedAt: 0,
  };
  private listeners = new Set<() => void>();
  private socket?: WebSocket;
  private retry?: ReturnType<typeof setTimeout>;
  private ping?: ReturnType<typeof setInterval>;
  private stopped = false;
  private attempt = 0;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.view;
  private update(values: Partial<OnlineView>) {
    this.view = { ...this.view, ...values };
    for (const fn of this.listeners) fn();
  }
  async account() {
    const response = await fetch('/api/pvp/me', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw Error('비무 서버에 연결하지 못했습니다');
    const data = (await response.json()) as { account: OnlineAccount | null };
    this.update({ account: data.account });
    return data.account;
  }
  async authenticate(
    kind: 'login' | 'register',
    body: { login: string; password: string; name?: string },
  ) {
    const response = await fetch(`/api/pvp/${kind}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error ?? '접속에 실패했습니다');
    this.update({ account: data.account, error: '' });
    this.connect();
  }
  async logout() {
    const r = await fetch('/api/pvp/logout', { method: 'POST', credentials: 'same-origin' });
    if (!r.ok) throw Error('접속 종료에 실패했습니다');
    this.stop();
    this.update({ account: null, room: null, queuedSince: null, connected: false, error: '' });
  }
  connect = () => {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    )
      return;
    this.stopped = false;
    if (this.retry) clearTimeout(this.retry);
    this.update({ connecting: true, error: '' });
    const url = new URL('/api/pvp/socket', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url);
    this.socket = ws;
    ws.onopen = () => {
      if (this.socket !== ws) return;
      this.attempt = 0;
      this.update({ connected: true, connecting: false, error: '' });
      this.send({ type: 'resume' });
      this.ping = setInterval(() => this.send({ type: 'ping', sent: performance.now() }), 2000);
    };
    ws.onmessage = (event) => {
      if (this.socket !== ws) return;
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === 'room')
        this.update({
          room: message.room,
          seat: message.seat,
          queuedSince: null,
          receivedAt: performance.now(),
        });
      else if (message.type === 'queue')
        this.update({ room: null, queuedSince: message.since, error: '' });
      else if (message.type === 'idle') this.update({ room: null, queuedSince: null });
      else if (message.type === 'error') this.update({ error: message.message });
      else if (message.type === 'pong')
        this.update({ rtt: Math.round(performance.now() - message.sent) });
    };
    ws.onclose = (event) => {
      if (this.socket !== ws) return;
      if (this.ping) clearInterval(this.ping);
      this.socket = undefined;
      this.update({ connected: false, connecting: false, queuedSince: null });
      if (event.code === 4003) {
        this.stopped = true;
        this.update({ account: null, error: '로그인이 만료되었습니다. 다시 로그인하세요' });
        return;
      }
      if (event.code === 4001) {
        this.stopped = true;
        this.update({ error: '다른 창에서 대전에 접속했습니다' });
        return;
      }
      if (!this.stopped) {
        this.update({ connecting: true, error: '연결이 끊겼습니다. 다시 연결하고 있습니다' });
        this.retry = setTimeout(() => this.connect(), Math.min(5000, 500 * 2 ** this.attempt++));
      }
    };
    ws.onerror = () => {
      /* onclose owns reconnect; no simulated success state. */
    };
  };
  send = (message: ClientMessage) => {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    if (this.socket.bufferedAmount > 16384) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  };
  clearError = () => this.update({ error: '' });
  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.ping) clearInterval(this.ping);
    this.socket?.close();
    this.socket = undefined;
  }
}
