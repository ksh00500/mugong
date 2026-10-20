/** Global balance v1: readable opening, increasing later pressure; saved HP is not rewritten. */
export const BALANCE = {
  bossHp: [1100, 1900, 2900, 4000],
  enemyHpByStage: [1.55, 1.75, 1.95, 2.1],
  enemyDamageByStage: [1.2, 1.3, 1.4, 1.5],
  bossDamageFactor: 1.6,
  bossRecoveryFactor: 0.65,
  bossWindupFactor: 0.85,
  bossApproachSpeed: 190,
  armourMinimumDamageFactor: 0.35,
  meleeOpeningBonus: 1.2,
  ordinaryGold: 3,
  bossGoldByStage: [28, 34, 40, 48],
} as const;
export function balanceStage(stage: number) {
  return Math.max(0, Math.min(3, Math.floor(stage)));
}
export const ordinaryHpFactor = (stage: number) => BALANCE.enemyHpByStage[balanceStage(stage)];
export const ordinaryDamageFactor = (stage: number) =>
  BALANCE.enemyDamageByStage[balanceStage(stage)];
export const ART_DAMAGE = {
  huashan: 0.97,
  wudang: 1,
  tianmo: 0.94,
  samja: 1,
  tang: 1,
  shaolin: 0.96,
  gaebang: 1.08,
  jegal: 1.05,
} as const;
export const ECONOMY = {
  medicPrices: [12, 16, 20, 24],
  medicinePrices: [8, 10, 14, 16],
  weaponPrices: [20, 24, 34, 40],
  regionalPrices: [26, 30, 34, 38],
} as const;

export function statPrecision(value: number) {
  return Math.round(value * 10) / 10;
}

export function encounterHp(stage: number, boss: boolean, spear = false) {
  return boss
    ? BALANCE.bossHp[balanceStage(stage)]
    : Math.round((32 + stage * 14 + (spear ? 10 : 0)) * ordinaryHpFactor(stage));
}
