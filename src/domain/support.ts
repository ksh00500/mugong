import { characterStats } from './character';
import type { ArtId, Fighter } from './model';
import { maximumHp } from './content';

/** Learned milestones support every equipped technique, including their own.
 * Derived from levels: no extra saved flags or switch-triggered buff stacks. */
export const ART_SUPPORTS: Record<ArtId, readonly [string, string]> = {
  huashan: ['공격 간격 8% 감소', '이동 속도 8% 증가'],
  wudang: ['방어 재사용 10% 감소', '적중·반격 궁극 충전 15% 증가'],
  tianmo: ['체력 50% 미만에서 기본 공격 피해 12% 증가', '적 처치 시 체력 2 회복'],
  samja: ['기본 공격 피해 8% 증가', '받는 피해 8% 감소'],
  tang: ['모든 기본 공격에 독 부여 · 최대 3중첩', '독 최대 5중첩 · 처치 시 주변 두 적에게 전독'],
  shaolin: ['받는 피해 10% 감소', '기본 공격 중 피격 경직 방지'],
  gaebang: ['기본 공격 사거리 8% 증가', '공격 중 이동 속도 65% → 80%'],
  jegal: ['적중·반격 궁극 충전 10% 증가', '적 처치 시 현재 무공의 궁극 충전 +8'],
};

export function supportEffects(id: ArtId, level: number) {
  return ART_SUPPORTS[id].flatMap((description, index) =>
    level >= (index ? 4 : 2) ? [{ level: index ? 4 : 2, description }] : [],
  );
}

export function supportStats(f: Pick<Fighter, 'arts' | 'hp'> & Partial<Fighter>) {
  const stats = characterStats({ ...f, level: f.level ?? 0 });
  const has = (id: import('./character').AugmentId) => f.augments?.includes(id);
  const unlocked = (id: ArtId, level: number) =>
    f.arts.some((a) => a.id === id && a.level >= level);
  return {
    attackIntervalFactor: (unlocked('huashan', 2) ? 0.92 : 1) * (has('tempo') ? 0.9 : 1),
    movementFactor: (unlocked('huashan', 4) ? 1.08 : 1) * ((f.traitState?.momentum ?? 0) > 0 ? 1.15 : 1),
    defenseCooldownFactor: (unlocked('wudang', 2) ? 0.9 : 1) * (has('resolve') ? 0.85 : 1) * Math.max(0.65, 1 / (1 + stats.agility / 400)),
    gaugeFactor: (unlocked('wudang', 4) ? 1.15 : 1) * (unlocked('jegal', 2) ? 1.1 : 1) * (1 + Math.min(0.5, stats.inner / 1000)) * (f.innate === 'calm' && (f.traitState?.untouched ?? 0) >= 5 ? 1.2 : 1),
    attackDamageFactor:
      (unlocked('samja', 2) ? 1.08 : 1) *
      (unlocked('tianmo', 2) && f.hp < maximumHp(f) * 0.5 ? 1.12 : 1),
    incomingDamageFactor: (unlocked('samja', 4) ? 0.92 : 1) * (unlocked('shaolin', 2) ? 0.9 : 1) * (has('iron') ? 0.9 : 1),
    killHealing: unlocked('tianmo', 4) ? 2 : 0,
    killGauge: unlocked('jegal', 4) ? 8 : 0,
    resistAttackStagger: unlocked('shaolin', 4),
    attackRangeFactor: unlocked('gaebang', 2) ? 1.08 : 1,
    attackMovementFactor: unlocked('gaebang', 4) ? 0.8 : 0.65,
    poisonLevel: unlocked('tang', 4) ? 4 : unlocked('tang', 2) ? 2 : 0,
  };
}

export function milestoneGain(id: ArtId, level: number, stage: string) {
  return level === 2 || level === 4 ? ART_SUPPORTS[id][level === 2 ? 0 : 1] : stage;
}
