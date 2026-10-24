type Point = { x: number; y: number };
type Track = {
  x: number;
  y: number;
  mode: string;
  vx: number;
  vy: number;
  ox: number;
  oy: number;
  seen: number;
  copy: object;
};

/** Bounded drawing between server publications. Never advances combat or writes source state.
 * Unlike delayed interpolation, health/actions stay at the latest confirmed snapshot.
 * A missing publication freezes after one interval (at most 100ms); no endless drift.
 */
export class SnapshotMotion {
  private key = '';
  private stamp = -1;
  private arrival = 0;
  private lastNow = 0;
  private interval: number;
  private fresh = false;
  private frame = 0;
  private previousAge = 0;
  private previousInterval = 0.1;
  private tracks = new Map<string, Track>();
  age = 0;
  constructor(private nominalInterval: number) {
    this.interval = nominalInterval;
  }
  reset() {
    this.key = '';
    this.stamp = -1;
    this.tracks.clear();
    this.age = 0;
    this.interval = this.nominalInterval;
  }
  begin(key: string, stamp: number, now: number) {
    const changed =
      key !== this.key ||
      stamp < this.stamp ||
      now < this.lastNow ||
      (stamp !== this.stamp && now - this.arrival > 250);
    if (changed) this.reset();
    this.previousInterval = this.interval;
    this.previousAge = Math.max(0, Math.min(0.1, this.interval, (now - this.arrival) / 1000));
    this.fresh = key !== this.key || stamp !== this.stamp;
    if (this.fresh) {
      this.interval = this.stamp >= 0 ? stamp - this.stamp : this.nominalInterval;
      this.key = key;
      this.stamp = stamp;
      this.arrival = now;
    }
    this.lastNow = now;
    this.frame++;
    this.age = Math.max(0, Math.min(0.1, this.interval, (now - this.arrival) / 1000));
  }
  body<T extends Point>(
    id: string,
    source: T,
    mode: string,
    snap = false,
    velocity?: Point,
    lifetime = Infinity,
  ): T {
    let track = this.tracks.get(id);
    if (!track) {
      track = {
        x: source.x,
        y: source.y,
        mode,
        vx: 0,
        vy: 0,
        ox: 0,
        oy: 0,
        seen: this.frame,
        copy: {},
      };
      this.tracks.set(id, track);
    } else if (this.fresh) {
      const dx = source.x - track.x,
        dy = source.y - track.y,
        distance = Math.hypot(dx, dy);
      const continuous =
        !snap &&
        mode === track.mode &&
        this.interval > 0 &&
        this.interval <= 0.25 &&
        distance < 80 &&
        distance / this.interval <= 1200;
      // Smooth only small publication-time corrections. A clock tick is not
      // necessarily an exact multiple of a 144/240Hz display's frame period.
      const residual = Math.max(0, 1 - this.previousAge / (this.previousInterval || 1));
      const ox = track.x + track.vx * this.previousAge + track.ox * residual - source.x;
      const oy = track.y + track.vy * this.previousAge + track.oy * residual - source.y;
      const correcting =
        continuous && Math.hypot(track.vx, track.vy) > 1 && Math.hypot(ox, oy) < 32;
      track.ox = correcting ? ox : 0;
      track.oy = correcting ? oy : 0;
      track.vx = continuous ? dx / this.interval : 0;
      track.vy = continuous ? dy / this.interval : 0;
      track.x = source.x;
      track.y = source.y;
      track.mode = mode;
    }
    track.seen = this.frame;
    const copy = track.copy as T;
    for (const k in copy) if (!(k in source)) delete copy[k];
    Object.assign(copy, source);
    if (!snap) {
      const age = Math.min(this.age, Math.max(0, lifetime));
      copy.x += (velocity?.x ?? track.vx) * age;
      copy.y += (velocity?.y ?? track.vy) * age;
      if (!velocity) {
        const correction = Math.max(0, 1 - age / (this.interval || 1));
        copy.x += track.ox * correction;
        copy.y += track.oy * correction;
      }
    }
    return copy;
  }
  remaining(value: number) {
    return Math.max(0, value - this.age);
  }
  end() {
    for (const [id, track] of this.tracks) if (track.seen !== this.frame) this.tracks.delete(id);
  }
}
