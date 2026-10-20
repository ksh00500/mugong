/** Boss pressure v1: more presence and endurance, unchanged final aim warnings. */
export const BALANCE = {
  bossHp: [1000, 1725, 2530, 3450],
  enemyHpFactor: 1.65,
  bossDamageFactor: 1.5,
  enemyDamageFactor: 1.2,
  bossRecoveryFactor: 0.65,
  bossWindupFactor: 0.85,
  bossApproachSpeed: 175,
} as const;

export function statPrecision(value: number) {
  return Math.round(value * 10) / 10;
}

export function encounterHp(stage: number, boss: boolean, spear = false) {
  return boss
    ? BALANCE.bossHp[Math.max(0, Math.min(3, stage))]
    : Math.round((32 + stage * 14 + (spear ? 10 : 0)) * BALANCE.enemyHpFactor);
}
