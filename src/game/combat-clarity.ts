import type Phaser from 'phaser';
import type { Effect, Run } from '../domain/model';
import { ARTS } from '../domain/content';
import { enemyAttack } from '../domain/combat';

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

/** Offscreen direction cues only; attack ranges are read from the authored motion. */
export class CombatClarity {
  private edges: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    this.edges = scene.add.graphics().setDepth(COMBAT_LAYERS.edge);
  }
  draw(r: Run | null) {
    this.edges.clear();
    if (!r || r.phase !== 'combat') return;
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
    this.edges.destroy();
  }
}
