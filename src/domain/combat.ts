import { bossById, type BossMove } from './campaign';
import { BALANCE } from './balance';
import type { Enemy, FieldZone, WeaponStyle } from './model';
import { BOSS_ATTACKS } from './boss-attacks';
import { meleeMove } from './boss-melee';
import { bossShots } from './boss-kit';
import { roleAttack } from './region-enemies';
import { dashOrigin, fanOffset } from './enemy-geometry';
import { combatOrigin, projectileHitsBody } from './combat-body';

export const STRIKE_TIMING = { duration: 0.28, contact: 0.09 } as const;

/** Shared by collision, tactical movement and attack animation. */
export function enemyAttack(e: Enemy) {
  const definition = bossById(e.bossId);
  if (definition) {
    const personal = BOSS_ATTACKS[Number(definition.id.split('-')[0])][definition.phase - 1];
    let move: BossMove = e.move ?? personal.sequence[e.pattern % personal.sequence.length];
    if (move === 'summon' && e.summoned && !e.move) move = 'slash';
    const melee = meleeMove(e, move);
    if (melee)
      return {
        boss: true,
        ranged: !!melee.shot || !!melee.zone,
        range: melee.range,
        arc: melee.arc ?? Math.PI,
        dash: melee.dash ?? 0,
        origin: melee.zone
          ? { x: e.targetX ?? e.x, y: e.targetY ?? e.y }
          : dashOrigin(e, melee.dash ?? 0),
        shots: bossShots(e, melee),
        windup: melee.windup,
        recovery: melee.recovery * ((e.rageTime ?? 0) > 0 ? 0.85 : 1),
        radius: melee.range,
        zone: undefined,
        returning: false,
        move,
        melee,
      };
    const ranged = move === 'fan' || move === 'ring';
    const dash = move === 'dash' ? personal.dash : 0;
    const range =
      move === 'thrust'
        ? personal.thrust
        : move === 'hazard'
          ? 560
          : ranged || move === 'summon'
            ? 500
            : personal.melee;
    const arc = move === 'thrust' ? 0.28 : move === 'dash' ? 0.5 : personal.arc;
    const origin =
      move === 'hazard' ? { x: e.targetX ?? e.x, y: e.targetY ?? e.y } : dashOrigin(e, dash);
    const count = move === 'ring' ? personal.ring : move === 'fan' ? personal.shots : 0;
    const shots = Array.from({ length: count }, (_, n) => ({
      angle:
        (move === 'ring'
          ? (n / count) * Math.PI * 2 + ((e.pattern % 2) * Math.PI) / count
          : e.aim + (personal.burst ? 0 : fanOffset(n, count, personal.spread, e.pattern))) +
        (e.windDeflection ?? 0),
      speed: personal.speed,
      life: 4,
      delay: personal.burst && move === 'fan' ? n * 0.18 : 0,
    }));
    return {
      boss: true,
      ranged,
      range,
      arc,
      dash,
      origin,
      shots,
      windup: Math.max(0.4, personal.windup * BALANCE.bossWindupFactor),
      recovery:
        Math.max(0.28, personal.recovery * BALANCE.bossRecoveryFactor) *
        ((e.rageTime ?? 0) > 0 ? 0.75 : 1),
      radius: personal.radius,
      zone: personal.zone,
      returning: personal.returning ?? false,
      move,
      melee: undefined,
    };
  }
  const role = roleAttack(e);
  if (role) return { ...role, returning: e.role === 'ringblade', melee: undefined };
  const boss = e.kind === 'chief' || e.kind === 'captain';
  const ranged = e.kind === 'archer' || e.kind === 'captain';
  const range = ranged ? 480 : e.kind === 'spear' ? 215 : boss ? 200 : 98;
  const arc = boss ? 1.4 : e.kind === 'spear' ? 0.42 : 0.85;
  const dash = e.strike
    ? Math.hypot(e.strike.toX - e.strike.fromX, e.strike.toY - e.strike.fromY)
    : e.kind === 'chief' && e.elite && e.pattern % 2 === 1
      ? 180
      : 0;
  const origin = dashOrigin(e, dash);
  const count = ranged ? (boss ? (e.elite ? 5 : 3) : 1) : 0;
  const shots = Array.from({ length: count }, (_, n) => ({
    angle: e.aim + (n - (count - 1) / 2) * 0.19 + (e.windDeflection ?? 0),
    speed: 360,
    life: 4,
    delay: 0,
  }));
  if (e.kind === 'captain' && e.elite && e.pattern % 3 === 2)
    for (let n = 0; n < 10; n++)
      shots.push({ angle: (n / 10) * Math.PI * 2, speed: 260, life: 3, delay: 0 });
  return {
    boss,
    ranged,
    range,
    arc,
    dash,
    origin,
    shots,
    windup: boss ? 0.9 : 0.65,
    recovery: boss ? 0.8 : 0.65,
    move: undefined as BossMove | undefined,
    radius: 110,
    zone: undefined,
    returning: false,
    melee: undefined,
  };
}

/** A dash hits its warned corridor as well as the final melee sector. */
export function dashHits(
  from: { x: number; y: number },
  to: { x: number; y: number },
  target: { x: number; y: number },
) {
  return projectileHitsBody(combatOrigin(from), combatOrigin(to), target, 30);
}

/** Ephemeral presentation cues: never included in a save or used for damage rules. */
export type CombatCue =
  | { kind: 'ultimate'; art: import('./model').ArtId; x: number; y: number }
  | { kind: 'field'; action: FieldZone['kind']; x: number; y: number }
  | {
      kind: 'mechanic';
      action: 'bell' | 'exchange' | 'reflect' | 'repair' | 'sand';
      x: number;
      y: number;
    }
  | {
      kind: 'strike';
      x: number;
      y: number;
      angle: number;
      friendly: boolean;
      thrust: boolean;
      weapon?: WeaponStyle;
    }
  | {
      kind: 'impact';
      x: number;
      y: number;
      angle: number;
      target: number | 'hero';
      amount: number;
      killed: boolean;
    }
  | {
      kind: 'defense';
      x: number;
      y: number;
      fromX?: number;
      fromY?: number;
      angle: number;
      action: 'evade' | 'guard' | 'counter' | 'block' | 'leech';
    };
export type CombatCueSink = (cue: CombatCue) => void;
