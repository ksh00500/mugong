import type Phaser from 'phaser';
import type { Run } from '../domain/model';
import { bossCombatPhase, isBossEnemy } from '../domain/boss-resilience';
import { bossAttackTell, type BossTell } from './boss-tells';

const colors = {
  sweep: 0xefb76d,
  thrust: 0xf4c985,
  dash: 0xff9875,
  projectile: 0xd6c7ff,
  field: 0xd4a8ec,
  cast: 0x9fd5c1,
};
const phaseColors = { combat: 0xe1c78e, pursuit: 0xf6bd72, guard: 0x8ed9ce, enraged: 0xff907d };
const point = (x: number, y: number, a: number, r: number) => ({
  x: x + Math.cos(a) * r,
  y: y + Math.sin(a) * r,
});

/** One bounded graphics layer, no per-frame DOM or texture allocations. */
export class BossReadability {
  private ground: Phaser.GameObjects.Graphics;
  private marks: Phaser.GameObjects.Graphics;
  private phases = new Map<number, { phase: ReturnType<typeof bossCombatPhase>; at: number }>();
  private clocks = new WeakMap<object, number>();
  private scope = '';
  constructor(
    scene: Phaser.Scene,
    private bar: (id: number) => { y: number } | undefined,
  ) {
    this.ground = scene.add.graphics().setDepth(-1);
    this.marks = scene.add.graphics().setDepth(5001);
  }
  private sector(
    x: number,
    y: number,
    r: number,
    angle: number,
    arc: number,
    progress: number,
    color: number,
  ) {
    const g = this.ground;
    if (arc >= Math.PI - 0.01) {
      g.fillStyle(color, 0.055).fillCircle(x, y, r).lineStyle(2, color, 0.4).strokeCircle(x, y, r);
      g.lineStyle(4, color, 0.8)
        .beginPath()
        .arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false)
        .strokePath();
      // Four notches distinguish a radial slam from a projectile ring.
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const p = point(x, y, a, r - 7),
          q = point(x, y, a, r + 7);
        g.lineStyle(3, color, 0.7).lineBetween(p.x, p.y, q.x, q.y);
      }
      return;
    }
    g.fillStyle(color, 0.055)
      .beginPath()
      .moveTo(x, y)
      .arc(x, y, r, angle - arc, angle + arc, false)
      .closePath()
      .fillPath();
    g.lineStyle(2, color, 0.4)
      .beginPath()
      .moveTo(x, y)
      .arc(x, y, r, angle - arc, angle + arc, false)
      .closePath()
      .strokePath();
    g.lineStyle(4, color, 0.85)
      .beginPath()
      .arc(x, y, r, angle - arc, angle - arc + 2 * arc * progress, false)
      .strokePath();
  }
  private line(t: BossTell, color: number) {
    const g = this.ground,
      a = t.angle,
      p = point(t.x, t.y, a, t.range),
      n = { x: -Math.sin(a) * t.width, y: Math.cos(a) * t.width };
    g.fillStyle(color, 0.065)
      .beginPath()
      .moveTo(t.x + n.x, t.y + n.y)
      .lineTo(p.x + n.x, p.y + n.y)
      .lineTo(p.x - n.x, p.y - n.y)
      .lineTo(t.x - n.x, t.y - n.y)
      .closePath()
      .fillPath();
    for (const sign of [-1, 1]) {
      g.lineStyle(2, color, 0.45).lineBetween(
        t.x + sign * n.x,
        t.y + sign * n.y,
        p.x + sign * n.x,
        p.y + sign * n.y,
      );
      const end = point(t.x, t.y, a, t.range * t.progress);
      g.lineStyle(3, color, 0.85).lineBetween(
        t.x + sign * n.x,
        t.y + sign * n.y,
        end.x + sign * n.x,
        end.y + sign * n.y,
      );
    }
    // Chevron indicates travel; a transverse cap indicates a stationary thrust.
    if (t.kind === 'dash')
      for (const d of [-0.65, 0.65]) {
        const q = point(p.x, p.y, a + Math.PI + d, 18);
        g.lineBetween(p.x, p.y, q.x, q.y);
      }
    else g.lineBetween(p.x + n.x, p.y + n.y, p.x - n.x, p.y - n.y);
  }
  private drawTell(t: BossTell) {
    const g = this.ground,
      color = colors[t.kind];
    if (t.shape === 'circle' || t.shape === 'sector')
      this.sector(
        t.x,
        t.y,
        t.range,
        t.angle,
        t.shape === 'circle' ? Math.PI : t.arc,
        t.progress,
        color,
      );
    else if (t.shape === 'line') this.line(t, color);
    else if (t.shape === 'rays') {
      for (const angle of t.angles ?? []) {
        const end = point(t.x, t.y, angle, t.range),
          fill = point(t.x, t.y, angle, t.range * t.progress);
        g.lineStyle(1.5, color, 0.3)
          .lineBetween(t.x, t.y, end.x, end.y)
          .lineStyle(3, color, 0.75)
          .lineBetween(t.x, t.y, fill.x, fill.y);
        const p = point(end.x, end.y, angle + Math.PI - 0.6, 10),
          q = point(end.x, end.y, angle + Math.PI + 0.6, 10);
        g.lineBetween(p.x, p.y, end.x, end.y).lineBetween(end.x, end.y, q.x, q.y);
      }
    } else {
      const r = t.range;
      g.lineStyle(2, color, 0.65)
        .beginPath()
        .moveTo(t.x, t.y - r)
        .lineTo(t.x + r, t.y)
        .lineTo(t.x, t.y + r)
        .lineTo(t.x - r, t.y)
        .closePath()
        .strokePath();
      g.lineStyle(3, color, 0.85).lineBetween(
        t.x - r,
        t.y + r + 7,
        t.x - r + 2 * r * t.progress,
        t.y + r + 7,
      );
    }
    if (t.landing) {
      const p = t.landing;
      if (p.shape === 'line') this.line({ ...t, ...p, kind: 'thrust', landing: undefined }, color);
      else
        this.sector(
          p.x,
          p.y,
          p.range,
          t.angle,
          p.shape === 'circle' ? Math.PI : t.arc,
          t.progress,
          color,
        );
    }
  }
  private warning(o: { warning: number; radius: number; x: number; y: number }, key: object = o) {
    const max = Math.max(o.warning, this.clocks.get(key) ?? o.warning);
    this.clocks.set(key, max);
    const p = Math.max(0, Math.min(1, 1 - o.warning / Math.max(0.001, max)));
    this.sector(o.x, o.y, o.radius, 0, Math.PI, p, colors.field);
    // Persistent fields are crosshatched at their center, unlike impact rings.
    for (const dx of [-8, 8])
      this.ground
        .lineStyle(2, colors.field, 0.7)
        .lineBetween(o.x + dx - 6, o.y + 8, o.x + dx + 6, o.y - 8);
    return p;
  }
  draw(run: Run | null, time: number, reduced: boolean) {
    this.ground.clear();
    this.marks.clear();
    const scope = run ? `${run.id}/${run.wave}` : '';
    if (scope !== this.scope) {
      this.scope = scope;
      this.phases.clear();
      this.clocks = new WeakMap();
    }
    if (!run || run.phase !== 'combat') return;
    const alive = new Set<number>();
    for (const e of run.enemies) {
      if (!isBossEnemy(e) || e.hp <= 0) continue;
      alive.add(e.id);
      const phase = bossCombatPhase(e),
        old = this.phases.get(e.id);
      if (!old) this.phases.set(e.id, { phase, at: -100 });
      else if (old.phase !== phase)
        this.phases.set(e.id, { phase, at: phase === 'combat' ? -100 : time });
      const age = time - this.phases.get(e.id)!.at;
      if (age >= 0 && age < 0.55) {
        const p = age / 0.55,
          r = reduced ? 44 : 28 + 48 * (1 - (1 - p) ** 3);
        this.ground
          .lineStyle(3, phaseColors[phase], (1 - p) * 0.8)
          .strokeEllipse(e.x, e.y, r * 2, r * 0.75);
      }
      const tell = bossAttackTell(e);
      if (tell) {
        this.drawTell(tell);
        // A short segmented charge directly beneath the actor HP bar.
        const bar = this.bar(e.id),
          g = this.marks,
          c = colors[tell.kind];
        if (bar)
          for (let i = 0; i < 4; i++)
            g.fillStyle(c, tell.progress > i / 4 ? 0.9 : 0.22).fillRect(
              e.x - 22 + i * 12,
              bar.y + 8,
              9,
              3,
            );
      }
    }
    for (const id of this.phases.keys()) if (!alive.has(id)) this.phases.delete(id);
    // Only objects with real pending damage: safe areas/doors/buffs get no danger ring.
    for (const z of run.zones ?? [])
      if (
        z.warning > 0 &&
        z.life > 0 &&
        run.enemies.some((e) => e.id === z.owner && isBossEnemy(e))
      )
        this.warning(z);
    for (const o of run.encounterObjects ?? []) {
      if (
        o.warning <= 0 ||
        o.life <= 0 ||
        !run.enemies.some((e) => e.id === o.owner && isBossEnemy(e))
      )
        continue;
      if (o.kind === 'volley') {
        const max = Math.max(o.warning, this.clocks.get(o) ?? o.warning);
        this.clocks.set(o, max);
        this.drawTell({
          kind: 'projectile',
          shape: 'rays',
          x: o.x,
          y: o.y - 34,
          angle: o.aim,
          range: 320,
          width: 0,
          arc: 0,
          progress: 1 - o.warning / max,
          contact: 0,
          locked: true,
          angles: [o.aim - 0.25, o.aim, o.aim + 0.25],
        });
      } else if (
        ['mine', 'blood'].includes(o.kind) &&
        (!o.mechanic || ['poison-powder', 'poison-mist'].includes(o.mechanic))
      )
        this.warning(o);
    }
    // A flight marker announces the saved landing point. The damaging ring
    // belongs to the subsequent real zone warning, not to release/flight time.
    for (const p of run.projectiles)
      if (!p.friendly && !p.hostileToEnemies && p.landing && p.life > 0)
        this.drawTell({
          kind: 'field',
          shape: 'glyph',
          x: p.landing.x,
          y: p.landing.y,
          angle: 0,
          range: 26,
          width: 0,
          arc: 0,
          progress: 0,
          contact: 0,
          locked: true,
        });
  }
  destroy() {
    this.ground.destroy();
    this.marks.destroy();
    this.phases.clear();
  }
}
