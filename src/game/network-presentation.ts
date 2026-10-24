import type { Run, Projectile } from '../domain/model';
import { SnapshotMotion } from './snapshot-motion';
import { FIELD } from '../domain/content';
import { WAYSTATION_BOUNDS } from '../domain/waystation';

/** Server-owned Gangho snapshots arrive at 10Hz. Retain rendering-only identities across JSON. */
export class NetworkPresentation {
  private motion = new SnapshotMotion(0.1);
  private shots: { id: number; source: Projectile }[] = [];
  private nextId = 0;
  private run?: Run;
  private key = '';
  private result?: Run;
  private stamp = 0;
  private arrival = 0;
  reset() {
    this.motion.reset();
    this.shots = [];
    this.run = undefined;
    this.key = '';
    this.stamp = 0;
  }
  sample(run: Run | null, now: number, active: boolean): Run | null {
    if (!run || !active || !['combat', 'prep'].includes(run.phase)) {
      this.reset();
      return run;
    }
    const key = `${run.id}:${run.wave}:${run.phase}`;
    if (key !== this.key || (this.run && run.elapsed < this.run.elapsed)) this.reset();
    this.key = key;
    if (run !== this.run) {
      const dt = this.run
        ? run.elapsed > this.run.elapsed
          ? run.elapsed - this.run.elapsed
          : Math.max(0, (now - this.arrival) / 1000)
        : 0;
      const bucketKey = (p: Projectile) => `${p.owner}:${p.seq}:${p.art}:${p.friendly}:${p.visual}`;
      const buckets = new Map<string, typeof this.shots>();
      for (const old of this.shots) {
        const key = bucketKey(old.source),
          bucket = buckets.get(key) ?? [];
        bucket.push(old);
        buckets.set(key, bucket);
      }
      this.shots = run.projectiles.map((p) => {
        const candidates = buckets.get(bucketKey(p)) ?? [];
        const index =
          dt >= 0 && dt <= 0.25
            ? candidates.findIndex((old) => {
                const q = old.source;
                return (
                  q.friendly === p.friendly &&
                  q.owner === p.owner &&
                  q.art === p.art &&
                  q.seq === p.seq &&
                  q.visual === p.visual &&
                  q.returned === p.returned &&
                  p.life <= q.life + 0.001 &&
                  Math.abs(p.life - Math.max(0, q.life - ((q.delay ?? 0) > 0 ? 0 : dt))) < 0.04 &&
                  Math.hypot(p.x - q.x - q.vx * dt, p.y - q.y - q.vy * dt) <
                    Math.max(6, Math.hypot(q.vx, q.vy) * 0.04)
                );
              })
            : -1;
        const match = index < 0 ? undefined : candidates.splice(index, 1)[0];
        return { id: match?.id ?? ++this.nextId, source: p };
      });
      this.run = run;
      this.stamp += dt;
      this.arrival = now;
    }
    const m = this.motion;
    m.begin(key, this.stamp, now);
    const result = (this.result ??= { ...run });
    for (const k in result)
      if (!(k in run)) delete (result as unknown as Record<string, unknown>)[k];
    Object.assign(result, run);
    const f = run.fighter;
    result.fighter = m.body(
      `hero:${f.id}`,
      f,
      `${f.action}:${f.attackSeq}:${f.active}`,
      f.hp <= 0 || f.action === 'defense' || f.action === 'ultimate',
    );
    result.fighter.actionTime = m.remaining(f.actionTime);
    const bounds = run.phase === 'prep' ? WAYSTATION_BOUNDS : FIELD;
    result.fighter.x = Math.max(bounds.left, Math.min(bounds.right, result.fighter.x));
    result.fighter.y = Math.max(bounds.top, Math.min(bounds.bottom, result.fighter.y));
    result.enemies = run.enemies.map((e) => {
      const value = m.body(`enemy:${e.id}`, e, `${e.state}:${e.move}:${e.pattern}`, e.hp <= 0);
      value.timer = m.remaining(e.timer);
      return value;
    });
    result.projectiles = this.shots.map(({ id, source: p }) =>
      m.body(
        `shot:${id}`,
        p,
        `${p.returned}`,
        (p.delay ?? 0) > 0 || p.life <= 0,
        { x: p.vx, y: p.vy },
        p.life,
      ),
    );
    m.end();
    return result;
  }
}
