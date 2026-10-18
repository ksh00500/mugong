import { regionName } from './campaign';
import type { Enemy, Run } from './model';
import { dashOrigin, fanOffset } from './enemy-geometry';

export const ENEMY_ROLES = [
  'raider',
  'guard',
  'bowman',
  'needle',
  'bombardier',
  'duelist',
  'swordcaster',
  'icehunter',
  'iceweaver',
  'brawler',
  'staffguard',
  'slinger',
  'assassin',
  'trapper',
  'crossbow',
  'rider',
  'ringblade',
  'bloodblade',
  'hexer',
  'gatekeeper',
  'engineer',
] as const;
export type EnemyRole = (typeof ENEMY_ROLES)[number];
type RoleProfile = {
  kind: Enemy['kind'];
  speed: number;
  distance: number;
  move: 'slash' | 'thrust' | 'dash' | 'fan' | 'hazard' | 'pulse';
  range: number;
  arc: number;
  windup: number;
  recovery: number;
  dash?: number;
  shots?: number;
  spread?: number;
  radius?: number;
  zone?: 'poison' | 'cold' | 'trap' | 'gate' | 'blood';
  guard?: boolean;
  strafe?: number;
};
export const ROLE_PROFILES: Record<EnemyRole, RoleProfile> = {
  raider: {
    kind: 'sword',
    speed: 114,
    distance: 0,
    move: 'slash',
    range: 100,
    arc: 0.9,
    windup: 0.75,
    recovery: 0.9,
  },
  guard: {
    kind: 'spear',
    speed: 82,
    distance: 0,
    move: 'thrust',
    range: 220,
    arc: 0.42,
    windup: 0.9,
    recovery: 1.1,
    guard: true,
  },
  bowman: {
    kind: 'archer',
    speed: 88,
    distance: 300,
    move: 'fan',
    range: 510,
    arc: 0,
    windup: 0.9,
    recovery: 1.1,
    shots: 1,
    strafe: 30,
  },
  needle: {
    kind: 'archer',
    speed: 108,
    distance: 310,
    move: 'fan',
    range: 520,
    arc: 0,
    windup: 0.8,
    recovery: 1.05,
    shots: 3,
    spread: 0.13,
    strafe: 52,
  },
  bombardier: {
    kind: 'archer',
    speed: 74,
    distance: 350,
    move: 'hazard',
    range: 560,
    arc: 0,
    windup: 1.2,
    recovery: 2.2,
    radius: 100,
    zone: 'poison',
  },
  duelist: {
    kind: 'sword',
    speed: 120,
    distance: 0,
    move: 'thrust',
    range: 150,
    arc: 0.23,
    windup: 0.75,
    recovery: 0.9,
  },
  swordcaster: {
    kind: 'archer',
    speed: 86,
    distance: 330,
    move: 'fan',
    range: 520,
    arc: 0,
    windup: 1.05,
    recovery: 1.25,
    shots: 2,
    spread: 0.18,
  },
  icehunter: {
    kind: 'spear',
    speed: 108,
    distance: 0,
    move: 'dash',
    range: 105,
    arc: 0.3,
    windup: 1.05,
    recovery: 1.4,
    dash: 200,
  },
  iceweaver: {
    kind: 'archer',
    speed: 72,
    distance: 320,
    move: 'hazard',
    range: 500,
    arc: 0,
    windup: 1.2,
    recovery: 2.1,
    radius: 85,
    zone: 'cold',
  },
  brawler: {
    kind: 'sword',
    speed: 88,
    distance: 0,
    move: 'pulse',
    range: 100,
    arc: 1,
    windup: 1.05,
    recovery: 1.25,
  },
  staffguard: {
    kind: 'spear',
    speed: 70,
    distance: 0,
    move: 'slash',
    range: 165,
    arc: 1.3,
    windup: 1.15,
    recovery: 1.3,
    guard: true,
  },
  slinger: {
    kind: 'archer',
    speed: 90,
    distance: 280,
    move: 'fan',
    range: 460,
    arc: 0,
    windup: 0.95,
    recovery: 1.35,
    shots: 1,
  },
  assassin: {
    kind: 'sword',
    speed: 155,
    distance: 0,
    move: 'dash',
    range: 85,
    arc: 0.34,
    windup: 0.85,
    recovery: 1.5,
    dash: 220,
    strafe: 45,
  },
  trapper: {
    kind: 'spear',
    speed: 95,
    distance: 230,
    move: 'hazard',
    range: 480,
    arc: 0,
    windup: 1.15,
    recovery: 2.1,
    radius: 65,
    zone: 'trap',
  },
  crossbow: {
    kind: 'archer',
    speed: 60,
    distance: 370,
    move: 'fan',
    range: 600,
    arc: 0,
    windup: 1.2,
    recovery: 1.6,
    shots: 3,
    spread: 0.08,
  },
  rider: {
    kind: 'spear',
    speed: 185,
    distance: 250,
    move: 'dash',
    range: 95,
    arc: 0.4,
    windup: 1.2,
    recovery: 1.8,
    dash: 370,
  },
  ringblade: {
    kind: 'archer',
    speed: 115,
    distance: 300,
    move: 'fan',
    range: 540,
    arc: 0,
    windup: 0.95,
    recovery: 1.55,
    shots: 3,
    spread: 0.14,
    strafe: 45,
  },
  bloodblade: {
    kind: 'sword',
    speed: 125,
    distance: 0,
    move: 'slash',
    range: 120,
    arc: 0.8,
    windup: 0.85,
    recovery: 0.8,
  },
  hexer: {
    kind: 'archer',
    speed: 64,
    distance: 330,
    move: 'hazard',
    range: 530,
    arc: 0,
    windup: 1.25,
    recovery: 2.2,
    radius: 110,
    zone: 'blood',
  },
  gatekeeper: {
    kind: 'spear',
    speed: 65,
    distance: 0,
    move: 'thrust',
    range: 250,
    arc: 0.4,
    windup: 1.1,
    recovery: 1.2,
    guard: true,
  },
  engineer: {
    kind: 'archer',
    speed: 60,
    distance: 330,
    move: 'hazard',
    range: 570,
    arc: 0,
    windup: 1.3,
    recovery: 2.3,
    radius: 95,
    zone: 'gate',
  },
};
/** Repeated slots are intentional encounter weights, not identical regional enemies. */
export const REGION_ROSTERS: Record<string, EnemyRole[]> = {
  청하현: ['raider', 'guard', 'bowman', 'raider', 'guard'],
  독무곡: ['needle', 'bombardier', 'needle', 'needle', 'bombardier', 'guard'],
  천검산: ['duelist', 'swordcaster', 'duelist', 'guard', 'swordcaster'],
  설산: ['icehunter', 'iceweaver', 'bowman', 'icehunter', 'iceweaver'],
  폐사: ['brawler', 'staffguard', 'brawler', 'slinger', 'staffguard'],
  죽림: ['assassin', 'needle', 'needle', 'assassin', 'trapper'],
  고묘: ['trapper', 'crossbow', 'guard', 'crossbow', 'trapper'],
  서역사막: ['rider', 'assassin', 'ringblade', 'rider', 'ringblade'],
  혈마전: ['bloodblade', 'hexer', 'bloodblade', 'assassin', 'hexer'],
  팔진고성: ['engineer', 'crossbow', 'gatekeeper', 'crossbow', 'engineer'],
};
export function regionEnemy(r: Pick<Run, 'wave' | 'regionRoute'>, slot: number) {
  const roles = REGION_ROSTERS[regionName(r)];
  const role = roles?.[slot % roles.length];
  return role
    ? { role, kind: ROLE_PROFILES[role].kind }
    : { kind: (['sword', 'spear', 'archer'] as const)[slot % 3] };
}
export function roleAttack(e: Enemy) {
  if (!e.role) return null;
  const p = ROLE_PROFILES[e.role];
  const move = p.move;
  const dash = p.dash ?? 0;
  const origin =
    move === 'hazard' ? { x: e.targetX ?? e.x, y: e.targetY ?? e.y } : dashOrigin(e, dash);
  return {
    boss: false,
    ranged: move === 'fan',
    range: p.range,
    arc: p.arc,
    dash,
    origin,
    move,
    windup: Math.max(0.55, p.windup * 0.85),
    recovery: Math.max(0.55, Math.min(1.5, p.recovery * 0.7)),
    radius: p.radius ?? p.range,
    zone: p.zone,
    shots: Array.from({ length: p.shots ?? 0 }, (_, n) => ({
      // Even volleys include a centre shot instead of leaving a safe hole
      // exactly where the enemy aimed (notably the two-shot sword caster).
      angle:
        e.aim + fanOffset(n, p.shots ?? 0, p.spread ?? 0.2, e.pattern) + (e.windDeflection ?? 0),
      speed: e.role === 'needle' ? 310 : 360,
      life: 3,
      delay: 0,
    })),
  };
}
export function retreatVector(e: Enemy, target: { x: number; y: number }) {
  const p = e.role ? ROLE_PROFILES[e.role] : null;
  if (!p) return null;
  const distance = Math.hypot(target.x - e.x, target.y - e.y);
  const away =
    p.distance === 0
      ? distance > p.range * 0.7
        ? 1
        : 0
      : distance < p.distance * 0.75
        ? -1
        : distance > p.distance * 1.15
          ? 1
          : 0;
  const angle = Math.atan2(target.y - e.y, target.x - e.x);
  const side =
    p.strafe && distance > p.range * 0.8 && distance < p.range + (p.dash ?? 0) + 250
      ? Math.sin(e.id) * p.strafe
      : 0;
  return {
    x: Math.cos(angle) * away * p.speed - Math.sin(angle) * side,
    y: Math.sin(angle) * away * p.speed + Math.cos(angle) * side,
  };
}
