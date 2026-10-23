import type { Run } from '../domain/model';

type Pose = { x: number; y: number; time?: number; mode?: string; sequence?: number };
type Body = { x: number; y: number };
const scope = (run: Run) => `${run.id}:${run.wave}:${run.phase}`;

/** Interpolates only the last fixed tick's drawing, never collision or saved state.
 * One tick of bounded presentation latency removes repeated poses at 120–240Hz.
 * Stable copies also preserve projectile identity for launch sounds between draws.
 */
export class CombatPresentation {
  private source?: Run;
  private key = '';
  private previous = new WeakMap<object, Pose>();
  private copies = new WeakMap<object, object>();
  reset() {
    this.source = undefined;
    this.key = '';
    this.previous = new WeakMap();
    this.copies = new WeakMap();
  }
  capture(run: Run | null) {
    if (!run) {
      this.reset();
      return;
    }
    if (run !== this.source || scope(run) !== this.key) this.reset();
    this.source = run;
    this.key = scope(run);
    this.previous = new WeakMap();
    this.previous.set(run.fighter, {
      x: run.fighter.x,
      y: run.fighter.y,
      time: run.fighter.actionTime,
      mode: run.fighter.action,
      sequence: run.fighter.attackSeq,
    });
    for (const enemy of run.enemies)
      this.previous.set(enemy, { x: enemy.x, y: enemy.y, time: enemy.timer, mode: enemy.state });
    for (const shot of run.projectiles) this.previous.set(shot, { x: shot.x, y: shot.y });
  }
  private copy<T extends object>(source: T): T {
    let value = this.copies.get(source) as T | undefined;
    if (!value) {
      value = { ...source };
      this.copies.set(source, value);
    }
    // Optional strike/field properties can be deleted by the simulation.
    for (const key in value) if (!(key in source)) delete value[key];
    return Object.assign(value, source);
  }
  private body<T extends Body>(source: T, alpha: number, snap = false): T {
    const value = this.copy(source),
      before = this.previous.get(source);
    // Teleports/evades and new entities own their actual new location immediately.
    if (!snap && before && Math.hypot(source.x - before.x, source.y - before.y) < 80) {
      value.x = before.x + (source.x - before.x) * alpha;
      value.y = before.y + (source.y - before.y) * alpha;
    }
    return value;
  }
  sample(run: Run | null, fraction: number): Run | null {
    if (!run || run !== this.source || scope(run) !== this.key) return run;
    const alpha = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 1;
    const result = this.copy(run),
      f = run.fighter,
      before = this.previous.get(f);
    result.fighter = this.body(f, alpha, f.hp <= 0 || f.action === 'defense');
    if (
      before?.mode === f.action &&
      before.sequence === f.attackSeq &&
      f.actionTime <= before.time!
    )
      result.fighter.actionTime = before.time! + (f.actionTime - before.time!) * alpha;
    result.enemies = run.enemies.map((enemy) => {
      const value = this.body(enemy, alpha, enemy.hp <= 0),
        old = this.previous.get(enemy);
      if (old?.mode === enemy.state && enemy.timer <= old.time!)
        value.timer = old.time! + (enemy.timer - old.time!) * alpha;
      return value;
    });
    result.projectiles = run.projectiles.map((shot) => this.body(shot, alpha));
    return result;
  }
}
