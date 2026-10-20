import type { Fighter, Item, Place } from '../domain/model';
import { BOSS_KITS } from '../domain/boss-melee';
import type { BossMove } from '../domain/campaign';
import { t } from './i18n';

/** Display precision only; authoritative combat and save values are never rounded here. */
export const displayValue = (value: number, digits = 1) => Number(value.toFixed(digits));
export function itemQuantity(items: readonly Item[]) {
  return t('{0}종 · 총 {1}개', {
    0: items.length,
    1: items.reduce((sum, item) => sum + item.count, 0),
  });
}
export function stowLabel(place: Place) {
  return t(place === 'weapon' ? '무장 가방에 수납' : '일반 가방에 수납');
}

export type Condition = {
  id: string;
  name: string;
  remaining: number;
  stacks?: number;
  severe?: boolean;
};
export function activeConditions(f: Fighter): Condition[] {
  const definitions: [keyof Fighter, string, boolean?][] = [
    ['capturedTime', '붙잡힘', true],
    ['freezeTime', '동결', true],
    ['bleedTime', '출혈'],
    ['poisonTime', '중독'],
    ['burnTime', '화상'],
    ['healSuppression', '회복량 감소'],
    ['slowTime', '둔화'],
  ];
  const conditions: Condition[] = definitions.flatMap(([id, name, severe]) => {
    const remaining = Number(f[id] ?? 0);
    return remaining > 0 ? [{ id, name, remaining, severe }] : [];
  });
  if ((f.coldStacks ?? 0) > 0 && (f.coldTime ?? 0) > 0)
    conditions.push({ id: 'coldTime', name: '냉기', remaining: f.coldTime!, stacks: f.coldStacks });
  return conditions;
}

const moveCopy: Record<BossMove, [string, string]> = {
  slash: ['베기', '검격이 지나간 뒤 접근하세요.'],
  sweep: ['횡베기', '검격이 지나간 뒤 접근하세요.'],
  thrust: ['찌르기', '찌르기 방향의 옆으로 피하세요.'],
  dash: ['돌진', '돌진 준비를 보고 옆으로 피하세요.'],
  fan: ['원거리 사격', '탄 사이로 이동하며 접근하세요.'],
  ring: ['원형 사격', '탄 사이로 이동하며 접근하세요.'],
  pulse: ['지면 충격', '지면 충격 범위에서 벗어나세요.'],
  slam: ['진각', '지면 충격 범위에서 벗어나세요.'],
  hazard: ['장판 설치', '장판이 없는 곳에서 싸우세요.'],
  summon: ['지원 소환', '소환된 적과 보스를 함께 살피세요.'],
  combo: ['연속 공격', '마지막 연격 뒤에 반격하세요.'],
  stance: ['반격 자세', '방어 자세가 풀린 뒤 공격하세요.'],
  grab: ['잡기', '잡기 준비 중에는 거리를 벌리세요.'],
  bell: ['범종', '종이 울리기 전 거리를 벌리세요.'],
};
/** Read the shipped boss kit, rather than inventing a second combat rules table. */
export function bossBriefing(id: string) {
  const kit = BOSS_KITS[id];
  if (!kit) return [];
  const entries = kit.sequence.flatMap((move) => {
    const spec = kit.moves[move];
    if (!spec) return [];
    const category =
      spec.mechanic === 'grab'
        ? 'grab'
        : spec.mechanic === 'stance'
          ? 'stance'
          : spec.mechanic === 'bell'
            ? 'bell'
            : spec.mechanic === 'reinforcements'
              ? 'summon'
              : spec.shot
                ? spec.shot.ring
                  ? 'ring'
                  : 'fan'
                : spec.zone
                  ? 'hazard'
                  : spec.dash
                    ? 'dash'
                    : spec.contacts.length > 1
                      ? 'combo'
                      : spec.shape === 'circle'
                        ? 'pulse'
                        : spec.shape === 'line'
                          ? 'thrust'
                          : move;
    return [{ move, category, label: moveCopy[category][0], advice: moveCopy[category][1] }];
  });
  const distinct = entries.filter(
    (entry, index) => entries.findIndex((other) => other.label === entry.label) === index,
  );
  // Prefer different responses, rather than two adjacent cuts with the same advice.
  const first = distinct[0];
  const second = distinct.find((entry) => entry.advice !== first?.advice) ?? distinct[1];
  return first ? (second ? [first, second] : [first]) : [];
}
