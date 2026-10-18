import { FIELD } from './content';
import { BALANCE } from './balance';
import { ROLE_PROFILES } from './region-enemies';
import { BOSS_ATTACKS } from './boss-attacks';
import { enemyAttack } from './combat';
import type { Enemy, Run } from './model';
import type { BossMove } from './campaign';
import { meleeKit } from './boss-melee';
import { bossCommitRange, pressureMovement } from './boss-pressure';

const observations = new WeakMap<Run, { x: number; y: number; vx: number; vy: number }>();
/** Smooth tactical course changes in simulation time, never steer a released attack. */
export function steerEnemy(e: Enemy, desired: { x: number; y: number }, dt: number) {
  const previous =
    e.steerX === undefined || e.steerY === undefined ? desired : { x: e.steerX, y: e.steerY };
  const blend = 1 - Math.exp(-Math.max(0, dt) * 12);
  const result = {
    x: previous.x + (desired.x - previous.x) * blend,
    y: previous.y + (desired.y - previous.y) * blend,
  };
  e.steerX = result.x;
  e.steerY = result.y;
  return result;
}
export function resetSteering(e: Enemy) {
  delete e.steerX;
  delete e.steerY;
}
export function turnToward(from: number, to: number, dt: number) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + Math.max(-dt * 10, Math.min(dt * 10, delta));
}
/** Ephemeral observation, never persisted. Teleports/dodges cannot create extreme leads. */
export function observeTarget(r: Run, dt: number) {
  if (dt <= 0) return;
  const old = observations.get(r),
    f = r.fighter;
  const dx = old ? (f.x - old.x) / dt : 0,
    dy = old ? (f.y - old.y) / dt : 0;
  const speed = Math.hypot(dx, dy);
  const factor = speed > 640 ? 0 : 1;
  const blend = 1 - Math.exp(-dt * 8);
  observations.set(r, {
    x: f.x,
    y: f.y,
    vx: (old?.vx ?? 0) * (1 - blend) + dx * factor * blend,
    vy: (old?.vy ?? 0) * (1 - blend) + dy * factor * blend,
  });
}
export function observedVelocity(r: Run) {
  const v = observations.get(r);
  return { x: v?.vx ?? 0, y: v?.vy ?? 0 };
}
export function predictedTarget(
  r: Run,
  e: Enemy,
  target: { x: number; y: number },
  ranged: boolean,
) {
  const v = target === r.fighter ? observations.get(r) : undefined;
  const spec = meleeKit(e)?.moves[e.move!];
  const shotSpeed = spec?.shot?.speed ?? 360;
  const lead = ranged
    ? e.bossId
      ? spec?.zone
        ? 1.15
        : Math.min(1.1, 0.45 + Math.hypot(target.x - e.x, target.y - e.y) / shotSpeed)
      : Math.min(0.28, Math.hypot(target.x - e.x, target.y - e.y) / 900)
    : (e.pressure?.burst ?? 0) > 0
      ? 0.3
      : 0.1;
  const cap = e.bossId && ranged ? 260 : 200;
  const factor =
    Math.hypot(v?.vx ?? 0, v?.vy ?? 0) * lead > cap ? cap / (Math.hypot(v!.vx, v!.vy) * lead) : 1;
  return {
    x: Math.max(FIELD.left, Math.min(FIELD.right, target.x + (v?.vx ?? 0) * lead * factor)),
    y: Math.max(FIELD.top, Math.min(FIELD.bottom, target.y + (v?.vy ?? 0) * lead * factor)),
  };
}

/** Keep personal boss moves; select useful moves instead of swinging at empty space. */
export function tacticalBossMove(e: Enemy, distance: number, run?: Run): BossMove | undefined {
  if (!e.bossId) return undefined;
  const [region, phase] = e.bossId.split('-').map(Number);
  const style = BOSS_ATTACKS[region]?.[phase - 1];
  if (!style) return undefined;
  const moves = style.sequence;
  const kit = meleeKit(e);
  if (kit) {
    // Every committed move advances its own slot. A useful fallback must not
    // reset the sequence to the same thrust over and over at long distance.
    for (let n = 0; n < moves.length; n++) {
      const index = (e.pattern + n) % moves.length,
        move = moves[index],
        spec = kit.moves[move];
      if (
        spec &&
        distance >= (spec.minimum ?? 0) &&
        (move !== 'summon' || !e.summoned) &&
        (spec.mechanic !== 'flag' ||
          !run?.encounterObjects?.some(
            (o) => o.owner === e.id && o.kind === 'flag' && o.hp > 0 && o.life > 0,
          )) &&
        (move !== 'stance' || (e.guardTime ?? 0) <= 0) &&
        (move !== 'bell' || (e.rageTime ?? 0) <= 0) &&
        distance <= spec.range + (spec.dash ?? 0) + 18 &&
        (move !== 'dash' || distance > 95)
      )
        return move;
    }
    return moves[e.pattern % moves.length];
  }
  const viable = (move: BossMove) =>
    move === 'summon'
      ? !e.summoned
      : move === 'slash' || move === 'pulse'
        ? distance <= style.melee + 18
        : move === 'thrust'
          ? distance <= style.thrust + 18
          : move === 'dash'
            ? distance <= style.dash + style.melee && distance > 100
            : distance <= 580;
  for (let n = 0; n < moves.length; n++) {
    const move = moves[(e.pattern + n) % moves.length];
    if (viable(move)) return move;
  }
  return moves[e.pattern % moves.length];
}

/** Approach, attack-slot waiting, and late recovery share purposeful positioning. */
export function tacticalMovement(
  r: Run,
  e: Enemy,
  target: { x: number; y: number },
  profile: {
    boss: boolean;
    ranged: boolean;
    range: number;
    dash: number;
    move?: BossMove;
    windup?: number;
    melee?: { contacts: number[]; shape: string; minimum?: number };
  },
) {
  const p = e.role ? ROLE_PROFILES[e.role] : undefined;
  const pressure =
    target === r.fighter ? pressureMovement(e, target, observedVelocity(r)) : undefined;
  const movementTarget = pressure?.target ?? target;
  const speed =
    (pressure?.speed ??
      p?.speed ??
      (profile.boss ? BALANCE.bossApproachSpeed : profile.ranged ? 88 : 115)) *
    ((e.rageTime ?? 0) > 0 ? 1.3 : 1);
  const dx = movementTarget.x - e.x,
    dy = movementTarget.y - e.y,
    d = Math.hypot(dx, dy) || 1;
  const nx = dx / d,
    ny = dy / d;
  const ranged = profile.ranged || profile.move === 'hazard';
  const baseDistance =
    p?.distance || (ranged ? Math.min(350, profile.range * 0.65) : profile.range * 0.66);
  // The walking stop distance must fit the same retreat margin as attack
  // admission; otherwise a short-range boss can stop outside its own attack.
  const desired =
    profile.boss && !ranged && profile.melee?.shape !== 'none'
      ? Math.min(
          baseDistance,
          Math.max(
            25,
            bossCommitRange(
              e,
              { ...profile, windup: profile.windup ?? 0.62 },
              observedVelocity(r),
              target,
            ) - 35,
          ),
        )
      : baseDistance;
  const advance =
    d > desired + 25
      ? 1
      : d < desired - 40 &&
          (ranged || flankRole(e) || ['0-2', '3-1', '9-3'].includes(e.bossId ?? ''))
        ? -1
        : 0;
  const side = (e.id % 2 ? 1 : -1) * (Math.floor((r.elapsed + e.id * 0.37) / 2.4) % 2 ? -1 : 1);
  const flank = e.role === 'assassin' || e.role === 'rider';
  const orbit =
    !pressure && d < profile.range + profile.dash + 180
      ? (ranged ? 0.48 : flank && d > 120 ? 0.62 : advance && d > 180 ? 0.22 : 0.32) * side
      : 0;
  let x = nx * advance - ny * orbit,
    y = ny * advance + nx * orbit;
  // React only to visible incoming shots while repositioning, never during a committed attack.
  if (
    !e.bossId &&
    ['bowman', 'needle', 'assassin', 'duelist', 'icehunter', 'ringblade'].includes(e.role ?? '')
  ) {
    for (const shot of r.projectiles) {
      if (!shot.friendly || (shot.delay ?? 0) > 0 || shot.hits.includes(e.id)) continue;
      const speed2 = shot.vx * shot.vx + shot.vy * shot.vy;
      if (speed2 < 1) continue;
      const time = ((e.x - shot.x) * shot.vx + (e.y - shot.y) * shot.vy) / speed2;
      if (time <= 0 || time > 0.28) continue;
      if (
        Math.hypot(shot.x + shot.vx * time - e.x, shot.y + shot.vy * time - e.y) >
        shot.radius + 32
      )
        continue;
      const speed = Math.sqrt(speed2);
      x -= (shot.vy / speed) * side * 0.9;
      y += (shot.vx / speed) * side * 0.9;
      break;
    }
  }
  for (const zone of r.formations ?? []) {
    if ((!ranged && !flank) || zone.damage <= 0 || (zone.pulses ?? 0) <= 0) continue;
    const zx = e.x - zone.x,
      zy = e.y - zone.y,
      zd = Math.hypot(zx, zy);
    if (zd < 145) {
      x += ((zd > 1 ? zx / zd : side) * (145 - zd)) / 145;
      y += ((zd > 1 ? zy / zd : side) * (145 - zd)) / 145;
    }
  }
  for (const other of r.enemies) {
    if (other === e || other.hp <= 0) continue;
    const ox = e.x - other.x,
      oy = e.y - other.y,
      od = Math.hypot(ox, oy);
    if (od < 76) {
      const weight = ((76 - od) / 76) * 0.9;
      x += (od > 1 ? ox / od : side) * weight;
      y += (od > 1 ? oy / od : (e.id % 3) - 1) * weight;
    }
  }
  // A trapped archer slides along the boundary instead of retreating into it forever.
  if ((e.x < FIELD.left + 60 && x < 0) || (e.x > FIELD.right - 60 && x > 0)) {
    x = 0;
    y += e.y < (FIELD.top + FIELD.bottom) / 2 ? 0.85 : -0.85;
  }
  if ((e.y < FIELD.top + 60 && y < 0) || (e.y > FIELD.bottom - 60 && y > 0)) {
    y = 0;
    x += e.x < (FIELD.left + FIELD.right) / 2 ? 0.85 : -0.85;
  }
  const length = Math.max(1, Math.hypot(x, y));
  return { x: (x / length) * speed, y: (y / length) * speed };
}

/** Keep only the last readable part of anticipation still, and the first
 * short recovery window punishable. Attack frames never acquire steering. */
export function repositionFactor(e: Enemy, profile: { windup: number; recovery: number }) {
  if (e.state === 'approach') return 1;
  if (e.state === 'windup') return e.timer > Math.min(0.4, profile.windup * 0.45) ? 0.42 : 0;
  if (e.state === 'recover') {
    const pause =
      meleeKit(e) &&
      (['slam', 'sweep'].includes(e.move ?? '') ||
        (['0-1', '0-4'].includes(e.bossId ?? '') && e.move === 'slash'))
        ? Math.min(0.5, profile.recovery * 0.6)
        : 0.18;
    return e.timer < profile.recovery - pause ? 0.72 : 0;
  }
  return 0;
}
function flankRole(e: Enemy) {
  return e.role === 'assassin' || e.role === 'rider';
}

const attackQueues = new WeakMap<Run, Map<Enemy, number>>();
/** FIFO admission prevents low-ID enemies repeatedly taking the same slot.
 * This scheduling state is transient and stale/out-of-range waiters are removed. */
export function canCommitAttack(r: Run, e: Enemy) {
  if (e.bossId || r.enemies.length <= 2 || (e.confused ?? 0) > 0) return true;
  let queue = attackQueues.get(r);
  if (!queue) attackQueues.set(r, (queue = new Map()));
  for (const [other] of queue) {
    const p = enemyAttack(other);
    if (
      !r.enemies.includes(other) ||
      other.hp <= 0 ||
      other.state !== 'approach' ||
      other.timer > 0 ||
      (other.staggerTime ?? 0) > 0 ||
      Math.hypot(other.x - r.fighter.x, other.y - r.fighter.y) >= p.range + p.dash + 20
    )
      queue.delete(other);
  }
  if (!queue.has(e)) queue.set(e, r.elapsed);
  const nearby = r.enemies.filter(
    (other) =>
      other !== e &&
      other.hp > 0 &&
      Math.hypot(other.x - r.fighter.x, other.y - r.fighter.y) < 650 &&
      (other.state === 'windup' || other.state === 'strike'),
  );
  if (nearby.length >= 3 || queue.keys().next().value !== e) return false;
  queue.delete(e);
  return true;
}
