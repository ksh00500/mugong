import type { BossMove } from './campaign';
import type { Enemy, FieldZone, Projectile, WeaponStyle } from './model';
export type MeleeMove = {
  name: string;
  shape: 'sector' | 'line' | 'circle' | 'none';
  range: number;
  arc?: number;
  width?: number;
  dash?: number;
  minimum?: number;
  windup: number;
  recovery: number;
  duration: number;
  contacts: number[];
  damage: number;
  slow?: number;
  knockback?: number;
  pull?: number;
  bleed?: number;
  poison?: number;
  leech?: number;
  visual?: 'chain';
  motion?: 'slash' | 'thrust' | 'cast' | 'throw' | 'shoot';
  mechanic?: 'grab' | 'bell' | 'stance' | 'flag' | 'reinforcements' | 'signature';
  variant?: number;
  shot?: {
    visual: NonNullable<Projectile['visual']>;
    count: number;
    speed: number;
    spread?: number;
    life?: number;
    returning?: boolean;
    status?: Projectile['status'];
    ring?: boolean;
  };
  zone?: { kind: FieldZone['kind']; radius: number };
};
export type BossKit = {
  weapon: WeaponStyle;
  sequence: BossMove[];
  moves: Partial<Record<BossMove, MeleeMove>>;
};
export const attack = (name: string, overrides: Partial<MeleeMove> = {}): MeleeMove => ({
  name,
  shape: 'sector',
  range: 145,
  arc: 0.65,
  windup: 0.62,
  recovery: 0.46,
  duration: 0.32,
  contacts: [0.1],
  damage: 1,
  ...overrides,
});

/** One volley, shared by the attack profile and the saved contact release. */
export function bossShots(e: Enemy, spec: MeleeMove) {
  const shot = spec.shot;
  return shot
    ? Array.from({ length: shot.count }, (_, n) => ({
        angle:
          e.aim +
          (e.windDeflection ?? 0) +
          (shot.ring
            ? (n * Math.PI * 2) / shot.count
            : (n - (shot.count - 1) / 2) * (shot.spread ?? 0.2)),
        speed: shot.speed,
        life: shot.life ?? 3.5,
        delay: 0,
      }))
    : [];
}
