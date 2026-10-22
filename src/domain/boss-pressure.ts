import { FIELD } from './content';
import { isBossEnemy } from './boss-resilience';
import { meleeKit } from './boss-melee';
import type { Enemy, Run } from './model';

export const BOSS_PRESSURE = { warning: 0.32, duration: 1.8, cooldown: 4, delay: 0.7 } as const;
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

/** Read actual world movement, never input or a future attack. Saved clocks do
 * not refresh on resume. A committed attack keeps its warning and recovery. */
export function stepBossPressure(r: Run, e: Enemy, dt: number, velocity: { x: number; y: number }) {
  if (!isBossEnemy(e)) return false;
  const distance = Math.hypot(r.fighter.x - e.x, r.fighter.y - e.y);
  const p = (e.pressure ??= {
    farTime: 0,
    warning: 0,
    burst: 0,
    cooldown: 0,
    lastDistance: distance,
  });
  const closing = (p.lastDistance - distance) / Math.max(dt, 0.001);
  p.lastDistance = distance;
  p.cooldown = Math.max(0, p.cooldown - dt);
  if (e.state === 'approach' || e.state === 'recover') p.advance = 0;
  const kit = meleeKit(e);
  const spec = kit?.moves[e.move ?? kit.sequence[e.pattern % kit.sequence.length]];
  const threshold =
    spec?.shot || spec?.zone
      ? Math.min(360, spec.range * 0.6)
      : Math.min(200, (spec?.range ?? 190) * 0.55 + (spec?.dash ?? 0) * 0.2);
  const circling = Math.hypot(velocity.x, velocity.y) > 90 && closing < 65;
  p.farTime =
    distance > threshold && circling && p.cooldown <= 0
      ? Math.min(BOSS_PRESSURE.delay, p.farTime + dt)
      : 0;
  if (e.state !== 'approach') {
    p.warning = 0;
    const windup = meleeKit(e)?.moves[e.move!]?.windup ?? 0.9;
    p.burst =
      e.state === 'windup' && e.timer > Math.min(0.4, windup * 0.45)
        ? Math.max(0, p.burst - dt)
        : 0;
    return false;
  }
  if (p.warning > 0) {
    p.warning = Math.max(0, p.warning - dt);
    return false;
  }
  p.burst = Math.max(0, p.burst - dt);
  if (p.farTime < BOSS_PRESSURE.delay) return false;
  p.farTime = 0;
  p.warning = BOSS_PRESSURE.warning;
  p.burst = BOSS_PRESSURE.duration;
  p.cooldown = BOSS_PRESSURE.cooldown;
  return true;
}

export function pressureMovement(
  e: Enemy,
  target: { x: number; y: number },
  velocity: { x: number; y: number },
) {
  const p = e.pressure;
  if (!isBossEnemy(e) || !p) return undefined;
  const windup = meleeKit(e)?.moves[e.move!]?.windup ?? 0.9;
  if (e.state !== 'approach' && !(e.state === 'windup' && e.timer > Math.min(0.4, windup * 0.45)))
    return undefined;
  if (p.warning > 0) return { target, speed: 55 };
  if (p.burst <= 0) return undefined;
  const kit = meleeKit(e);
  const caster = kit && Object.values(kit.moves).some((m) => m?.shot || m?.zone);
  const speed = caster ? 390 : kit?.weapon === 'gauntlet' || kit?.weapon === 'dao' ? 440 : 465;
  const lead = caster ? 0.35 : 0.55;
  const length = Math.hypot(velocity.x, velocity.y) * lead;
  const factor = length > 180 ? 180 / length : 1;
  return {
    speed,
    target: {
      x: clamp(target.x + velocity.x * lead * factor, FIELD.left, FIELD.right),
      y: clamp(target.y + velocity.y * lead * factor, FIELD.top, FIELD.bottom),
    },
  };
}

/** Close the extra gap a retreating target can cover after aim locks. Physical
 * hitboxes, contact times and the final warning are deliberately unchanged. */
export function bossCommitRange(
  e: Enemy,
  profile: {
    range: number;
    dash: number;
    windup: number;
    ranged: boolean;
    melee?: { contacts: number[]; shape: string; minimum?: number };
  },
  velocity: { x: number; y: number },
  target: { x: number; y: number },
) {
  const reach = profile.range + profile.dash - (e.pressure?.advance ?? 0) + 20;
  if (!isBossEnemy(e) || profile.ranged || profile.melee?.shape === 'none') return reach;
  const dx = target.x - e.x,
    dy = target.y - e.y,
    d = Math.hypot(dx, dy) || 1;
  const retreat = Math.max(0, (velocity.x * dx + velocity.y * dy) / d);
  const locked = Math.min(0.4, profile.windup * 0.45);
  const margin = Math.min(135, retreat * (locked + (profile.melee?.contacts[0] ?? 0.09)));
  return Math.max((profile.melee?.minimum ?? 0) + 25, reach - margin);
}

/** The short forward step belongs to this saved attack only. It never extends
 * the weapon hitbox or the distance at which the boss starts preparing it. */
export function commitBossPressure(
  e: Enemy,
  profile: { dash: number; ranged: boolean; melee?: { shape: string; range: number } },
) {
  if (!e.pressure) return;
  e.pressure.advance =
    e.pressure.burst > 0 &&
    !profile.ranged &&
    profile.dash === 0 &&
    ['line', 'sector'].includes(profile.melee?.shape ?? '') &&
    (profile.melee?.range ?? 0) < 330
      ? Math.min(95, (profile.melee?.range ?? 0) * 0.35 + 40)
      : 0;
}
