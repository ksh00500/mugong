/** Tactical balance v3: enemy HP/damage are 70% of v2; movement stays responsive. */
export const BALANCE = {
  bossHp: [630, 1050, 1540, 2100],
  enemyHpFactor: 1.155,
  bossDamageFactor: 0.945,
  enemyDamageFactor: 0.84,
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
