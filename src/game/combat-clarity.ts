import type Phaser from 'phaser';
import type { Effect, Run } from '../domain/model';
import { ARTS } from '../domain/content';
import { enemyAttack } from '../domain/combat';
import { combatOrigin } from '../domain/combat-body';
import { isBossEnemy } from '../domain/boss-resilience';
import { encounterZoneArt } from './zone-art';

export const COMBAT_LAYERS = {
  friendly: 5001,
  hostileShot: 5003,
  warning: 5004,
  edge: 5006,
  status: 5007,
} as const;
const friendlyColors = new Set([0xf4e0af, ...Object.values(ARTS).map((art) => art.color)]);
/** Unknown or regional boss colours keep their opacity, including non-red impacts. */
export function decorativeOpacity(effect: Pick<Effect, 'kind' | 'color'>, crowded: boolean) {
  return crowded && effect.kind !== 'hit' && friendlyColors.has(effect.color) ? 0.55 : 1;
}
export function combatCrowding(r: Run) {
  const threats = r.enemies.filter(
    (e) => e.hp > 0 && (e.state === 'windup' || e.state === 'strike'),
  ).length;
  return (
    threats >= 2 ||
    r.projectiles.filter((p) => !p.friendly && p.life > 0).length >= 5 ||
    r.effects.length >= 8
  );
}
type Bounds = { left: number; right: number; top: number; bottom: number };
/** Only active attacks outside the actual camera view receive a directional cue. */
export function offscreenThreats(r: Run, view: Bounds) {
  const points = r.enemies
    .filter(
      (e) =>
        e.hp > 0 &&
        e.state === 'windup' &&
        (e.x < view.left || e.x > view.right || e.y < view.top || e.y > view.bottom) &&
        (enemyAttack(e).ranged || enemyAttack(e).move === 'hazard'),
    )
    .map((e) => ({ id: e.id, x: e.x, y: e.y }));
  return points
    .sort(
      (a, b) =>
        Math.hypot(a.x - r.fighter.x, a.y - r.fighter.y) -
        Math.hypot(b.x - r.fighter.x, b.y - r.fighter.y),
    )
    .slice(0, 6)
    .map((p) => {
      const a = Math.atan2(p.y - r.fighter.y, p.x - r.fighter.x),
        dx = Math.cos(a),
        dy = Math.sin(a);
      const cx = (view.left + view.right) / 2,
        cy = (view.top + view.bottom) / 2;
      const t = Math.min(
        (view.right - view.left - 110) / 2 / Math.max(0.001, Math.abs(dx)),
        (view.bottom - view.top - 110) / 2 / Math.max(0.001, Math.abs(dy)),
      );
      return { id: p.id, x: cx + dx * t, y: cy + dy * t, angle: a };
    });
}

/** Bounded outline layers above decorative effects; never modifies collision or clocks. */
export class CombatClarity {
  private ink: Phaser.GameObjects.Graphics;
  private edges: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    this.ink = scene.add.graphics().setDepth(COMBAT_LAYERS.warning);
    this.edges = scene.add.graphics().setDepth(COMBAT_LAYERS.edge);
  }
  private circle(x: number, y: number, r: number, ready: boolean, safe = false) {
    if (r <= 0) return;
    const g = this.ink,
      color = safe ? 0x8ae0c3 : ready ? 0xffc27d : 0xf8e3ac;
    g.lineStyle(7, 0x192a25, 0.8).strokeCircle(x, y, r);
    g.lineStyle(3, color, 0.95).strokeCircle(x, y, r);
    // Inward notches mean danger; the warm centre uses outward corner marks.
    for (let n = 0; n < 8; n++) {
      const a = (n * Math.PI) / 4;
      g.lineBetween(
        x + Math.cos(a) * r,
        y + Math.sin(a) * r,
        x + Math.cos(a) * (r + (safe ? 8 : -8)),
        y + Math.sin(a) * (r + (safe ? 8 : -8)),
      );
    }
  }
  draw(r: Run | null) {
    this.ink.clear();
    this.edges.clear();
    if (!r || r.phase !== 'combat') return;
    for (const z of r.zones ?? [])
      if (z.life > 0)
        this.circle(z.x, z.y, z.radius, z.warning <= 0, z.kind === 'cold' && z.id === 0);
    for (const o of r.encounterObjects ?? []) {
      // Complex moving/corridor mechanics already draw their exact shape elsewhere.
      if (
        o.life <= 0 ||
        o.kind === 'safe' ||
        (o.mechanic && !['poison-powder', 'poison-mist'].includes(o.mechanic))
      )
        continue;
      if (encounterZoneArt(r, o) && o.kind !== 'tether')
        this.circle(o.x, o.y, o.radius, o.warning <= 0);
    }
    for (const p of r.projectiles)
      if (p.landing && p.life > 0 && !p.friendly)
        this.circle(p.landing.x, p.landing.y, p.landing.radius, false);
    for (const e of r.enemies) {
      if (e.hp <= 0 || e.state !== 'windup' || isBossEnemy(e)) continue;
      const p = enemyAttack(e),
        o = combatOrigin(e),
        g = this.ink,
        locked = e.timer <= Math.min(0.4, p.windup * 0.45),
        color = locked ? 0xffb77d : 0xf8e3ac;
      if (p.move === 'hazard') {
        this.circle(p.origin.x, p.origin.y, p.radius, false);
        continue;
      }
      if (p.move === 'pulse') {
        this.circle(e.x, e.y, p.range, false);
        continue;
      }
      if (p.ranged) {
        for (const shot of p.shots) {
          const length = Math.min(180, p.range),
            x = o.x + Math.cos(shot.angle) * length,
            y = o.y + Math.sin(shot.angle) * length;
          g.lineStyle(6, 0x192a25, 0.8).lineBetween(o.x, o.y, x, y);
          g.lineStyle(2, color, 0.9).lineBetween(o.x, o.y, x, y);
        }
        continue;
      }
      const end = p.dash > 0 ? combatOrigin(p.origin) : o;
      if (p.dash > 0) {
        const nx = -Math.sin(e.aim) * 30,
          ny = Math.cos(e.aim) * 30;
        for (const side of [-1, 1]) {
          g.lineStyle(6, 0x192a25, 0.8).lineBetween(
            o.x + side * nx,
            o.y + side * ny,
            end.x + side * nx,
            end.y + side * ny,
          );
          g.lineStyle(2.5, color, 0.95).lineBetween(
            o.x + side * nx,
            o.y + side * ny,
            end.x + side * nx,
            end.y + side * ny,
          );
        }
      }
      g.lineStyle(6, 0x192a25, 0.8)
        .beginPath()
        .moveTo(end.x, end.y)
        .arc(end.x, end.y, p.range, e.aim - p.arc, e.aim + p.arc)
        .closePath()
        .strokePath();
      g.lineStyle(2.5, color, 0.95)
        .beginPath()
        .moveTo(end.x, end.y)
        .arc(end.x, end.y, p.range, e.aim - p.arc, e.aim + p.arc)
        .closePath()
        .strokePath();
    }
    const v = this.scene.cameras.main.worldView;
    const edges = offscreenThreats(r, { left: v.x, right: v.right, top: v.y, bottom: v.bottom });
    for (const p of edges) {
      const g = this.edges,
        a = p.angle;
      g.lineStyle(8, 0x192a25, 0.9);
      for (const width of [8, 3]) {
        g.lineStyle(width, width === 8 ? 0x192a25 : 0xffbc79, 1)
          .beginPath()
          .moveTo(p.x + Math.cos(a + 2.5) * 18, p.y + Math.sin(a + 2.5) * 18)
          .lineTo(p.x, p.y)
          .lineTo(p.x + Math.cos(a - 2.5) * 18, p.y + Math.sin(a - 2.5) * 18)
          .strokePath();
      }
    }
    this.scene.game.canvas.parentElement?.setAttribute('data-threat-cues', String(edges.length));
  }
  destroy() {
    this.ink.destroy();
    this.edges.destroy();
  }
}
