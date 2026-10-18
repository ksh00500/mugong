import type { Run } from './model';

/** Contact effects, shared by environmental fields and boss installations. */
export const FIELD_EFFECTS = {
  poison: { damage: 4, interval: 0.8, slow: 0.4 },
  cold: { damage: 4, interval: 1, slow: 0.6 },
  trap: { damage: 16, interval: 0, slow: 0.8 },
  gate: { damage: 7, interval: 1.2, slow: 0.8 },
  fire: { damage: 9, interval: 0.65, slow: 0 },
  brew: { damage: 0, interval: 0.5, slow: 2 },
  blood: { damage: 6, interval: 0.9, slow: 0 },
  seal: { damage: 8, interval: 1, slow: 0 },
  safe: { damage: 8, interval: 1, slow: 0 },
} as const;
export type ContactEffect = keyof typeof FIELD_EFFECTS;
export function applyFieldContact(r: Run, effect: ContactEffect, damage: (amount: number) => void) {
  const profile = FIELD_EFFECTS[effect],
    f = r.fighter;
  // Evasion protects against both the impact and its secondary effect.
  if (f.invulnerable > 0) return 0;
  const before = f.hp;
  if (profile.damage) damage(profile.damage);
  if (profile.damage && f.hp >= before) return 0;
  if (f.hp > 0) {
    f.slowTime = Math.max(f.slowTime ?? 0, profile.slow);
    if (effect === 'seal') f.healSuppression = Math.max(f.healSuppression ?? 0, 5);
    if (effect === 'poison') f.poisonTime = 2.4;
    if (effect === 'fire') f.burnTime = 1.6;
    if (effect === 'cold') {
      f.coldStacks = Math.min(3, (f.coldStacks ?? 0) + 1);
      f.coldTime = 3;
      if (f.coldStacks >= 3) {
        f.freezeTime = 0.65;
        f.coldStacks = 0;
      }
    }
  }
  return Math.max(0, before - f.hp);
}
export function stepFieldStatuses(r: Run, dt: number, damage: (amount: number) => void) {
  const f = r.fighter;
  const amount =
    ((f.poisonTime ?? 0) > 0 ? 3 : 0) +
    ((f.burnTime ?? 0) > 0 ? 4 : 0) +
    ((f.bleedTime ?? 0) > 0 ? 3 : 0);
  f.bleedTime = Math.max(0, (f.bleedTime ?? 0) - dt);
  f.coldTime = Math.max(0, (f.coldTime ?? 0) - dt);
  f.freezeTime = Math.max(0, (f.freezeTime ?? 0) - dt);
  f.capturedTime = Math.max(0, (f.capturedTime ?? 0) - dt);
  if (!f.coldTime) f.coldStacks = 0;
  if (
    r.zones?.some(
      (z) => z.kind === 'cold' && z.id === 0 && Math.hypot(z.x - f.x, z.y - f.y) < z.radius,
    )
  ) {
    f.coldStacks = 0;
    f.freezeTime = 0;
  }
  f.poisonTime = Math.max(0, (f.poisonTime ?? 0) - dt);
  f.burnTime = Math.max(0, (f.burnTime ?? 0) - dt);
  if (!amount) {
    f.fieldTick = 0;
    return;
  }
  f.fieldTick = (f.fieldTick ?? 0) + dt;
  if (f.fieldTick >= 0.8) {
    f.fieldTick -= 0.8;
    damage(amount);
  }
}
