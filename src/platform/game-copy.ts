import { ARTS } from '../domain/content';
import { bossById } from '../domain/campaign';
import type { ArtId, Fighter, Item } from '../domain/model';
import { DEFENSE_RULES, techniqueStats } from '../domain/techniques';
import { t } from './i18n';
import { medicineFactor } from '../domain/character';

export function itemDescription(item: Item, fighter?: Fighter) {
  switch (item.kind) {
    case 'medicine':
      return t('체력 {0} 회복 · 전투 후 바로 사용', { 0: item.power * medicineFactor(fighter ?? {}) });
    case 'manual':
      return t('경험치 +{0} · 기본 능력 성장', { 0: item.power });
    case 'sword':
      return t('무장 가방에 수납하고 무공에 연결하세요.');
    case 'robe':
      return t('착용하면 적의 공격 피해를 줄입니다.');
    case 'boots':
      return t('착용하면 이동이 빨라집니다.');
    case 'charm':
      return t('착용하면 모든 무공의 기본 공격력이 증가합니다.');
    case 'ore':
      if (item.originBoss)
        return t(
          '보스 고유 재료 · 정비에서 판매하거나 보관할 수 있습니다. 강화에 자동 소모되지 않습니다.',
        );
      return t('정비에서 장비 강화에 쓰거나 판매할 수 있습니다.');
  }
}
export function itemOrigin(item: Item) {
  const boss = bossById(item.originBoss);
  return boss ? t('{0}의 전리품', { 0: t(boss.name) }) : '';
}
export function itemEffect(item: Item, fighter?: Fighter) {
  switch (item.kind) {
    case 'sword':
    case 'charm':
      return t('공격 +{0}', { 0: item.power.toFixed(1) });
    case 'robe':
      return t('받는 피해 −{0}', { 0: item.power.toFixed(1) });
    case 'boots':
      return t('이동 속도 +{0}%', { 0: Math.round(((item.power * 8) / 265) * 1000) / 10 });
    case 'medicine':
      return t('체력 +{0}', { 0: item.power * medicineFactor(fighter ?? {}) });
    case 'manual':
      return t('경험치 +{0}', { 0: item.power });
    case 'ore':
      return t('재료');
  }
}
export function defenseDescription(id: ArtId, level: number, fighter?: Fighter) {
  const stats = techniqueStats(id, level, fighter);
  if (id === 'huashan')
    return t('{0}초 동안 피해를 받지 않고 회피합니다.', { 0: DEFENSE_RULES.evadeDuration });
  if (id === 'wudang')
    return t('{0}초 안에 공격을 받으면 막고 반격합니다. 반격 피해 {1}, 궁극 충전 +{2}.', {
      0: stats.guardDuration,
      1: stats.counterDamage,
      2: Math.round(stats.counterGauge * 100) / 100,
    });
  if (id === 'samja')
    return t('{0}초 동안 받는 피해를 {1}% 줄입니다.', {
      0: stats.guardDuration,
      1: Math.round((1 - DEFENSE_RULES.guardDamageFactor) * 100),
    });
  if (id === 'tang' || id === 'gaebang') return t('짧게 이동하며 0.22초 동안 피해를 피합니다.');
  if (id === 'shaolin' || id === 'jegal')
    return t('{0}초 동안 받는 피해를 {1}% 줄입니다.', { 0: stats.guardDuration, 1: 70 });
  return t('전방 피해 {0}. 최근 잃은 체력 일부를 되찾습니다.', {
    0: stats.leechDamage,
  });
}
export function techniqueCopy(id: ArtId, level: number, fighter?: Fighter) {
  const d = ARTS[id],
    stats = techniqueStats(id, level, fighter);
  return {
    description: t(d.description),
    attack: t('공격력 배율 ×{0} · 공격 간격 {1}초', {
      0: Math.round(stats.multiplier * 100) / 100,
      1: Math.round(stats.attackInterval * 1000) / 1000,
    }),
    defense: defenseDescription(id, level, fighter),
    cooldown: t('재사용 {0}초', { 0: Math.round(stats.defenseCooldown * 100) / 100 }),
    ultimate:
      id === 'gaebang'
        ? t('취기 100으로 다음 초식 한 번 강화 · 최대 두 번 예약')
        : level >= stats.ultimateLevel
          ? id === 'wudang'
            ? t('4초 동안 흘리기 판정을 늘리고 반격합니다.')
            : id === 'tianmo'
              ? t('5초 동안 공격을 강화하며 체력을 소모합니다.')
              : id === 'shaolin'
                ? t('5초 동안 피해 45% 경감 · 적중 시 추가 충격파')
                : id === 'jegal'
                  ? t('진점 네 개를 5초 동안 연결해 진동 피해를 줍니다.')
                  : id === 'tang'
                    ? t('주변 적의 독을 폭발시키고 중첩 절반을 남깁니다.')
                    : t('궁극 피해 {0} · 게이지 100 필요', { 0: stats.ultimateDamage })
          : t('궁극은 Lv.{0}에 개방됩니다.', { 0: stats.ultimateLevel }),
    extra: id === 'samja' && level >= 8 ? t('A·B·C 세 초식을 순서대로 사용합니다.') : level >= 3 ? t('A와 B 초식을 번갈아 사용합니다.') : '',
    healing: id === 'tianmo' ? t('최근 4초의 손실 체력을 공격으로 회복 · 저장 한도 24') : '',
    advanced:
      id === 'samja' && level >= 9
        ? t(
            level >= 10
              ? '검기를 가장 가까운 적의 위치로 날립니다.'
              : '기본 공격에 전방 검기를 더합니다.',
          )
        : id === 'tang'
          ? t('독은 최대 {0}중첩 · 지속 피해는 게이지를 채우지 않습니다.', {
              0: level >= 4 ? 5 : 3,
            })
          : id === 'jegal'
            ? t('건진·곤진 각각 최대 두 개 · Lv.3부터 연결 진동')
            : id === 'gaebang'
              ? t('취기 두 칸 저장 · Lv.5에서 강화타 두 번 적중 시 혼취')
              : '',
    ultimateExtra:
      level < stats.ultimateLevel
        ? ''
        : id === 'huashan'
          ? t('시전 후 0.9초 동안 피해를 받지 않습니다.')
          : id === 'tianmo'
            ? t('강화 중 처치마다 체력 2.4 회복 · 총 회복 한도 12')
            : id === 'samja' && level >= 10
              ? t('남은 적을 향해 피해 90의 검기를 추가로 날립니다.')
              : '',
  };
}
