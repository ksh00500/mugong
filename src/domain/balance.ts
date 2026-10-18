/** Combat v4 restores the pre-v3 pressure; final warnings remain readable. */
export const BALANCE = {
  bossHp: [900, 1500, 2200, 3000],
  enemyHpFactor: 1.65,
  bossDamageFactor: 1.35,
  enemyDamageFactor: 1.2,
  bossRecoveryFactor: 0.65,
  bossWindupFactor: 0.85,
  bossApproachSpeed: 125,
} as const;

export function statPrecision(value: number) {
  return Math.round(value * 10) / 10;
}

export function encounterHp(stage: number, boss: boolean, spear = false) {
  return boss
    ? BALANCE.bossHp[Math.max(0, Math.min(3, stage))]
    : Math.round((32 + stage * 14 + (spear ? 10 : 0)) * BALANCE.enemyHpFactor);
}
