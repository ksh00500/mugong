import { characterStats } from './character';
import type { ArtId, Fighter, Item, ItemKind, WeaponStyle } from './model';
import { statPrecision } from './balance';
import source from './catalogue.json' with { type: 'json' };
export const W = 1920,
  H = 1080;
export const FIELD = { left: 155, right: 1765, top: 215, bottom: 855 };
export const BAG = { weapon: { w: 4, h: 7 }, general: { w: 10, h: 8 } };
export const ARTS: Record<
  ArtId,
  {
    name: string;
    short: string;
    color: number;
    hex: string;
    max: number;
    defense: string;
    description: string;
    stages: string[];
  }
> = {
  huashan: {
    name: '화산매화검법',
    short: '매화',
    color: 0xd38494,
    hex: '#c7667e',
    max: 5,
    defense: '매화보 · 짧은 무적 회피',
    description: '넓은 검로와 빠른 발놀림. 적 사이를 파고들어 매화를 흩뿌립니다.',
    stages: [
      '횡베기',
      '날렵함 · 공격 간격 감소',
      '연속 베기 · 두 번째 공격 피해 +15%',
      '매화보 재사용 감소',
      '매화난무 · 무적 광역 베기',
    ],
  },
  wudang: {
    name: '무당태극검',
    short: '태극',
    color: 0x79b9bc,
    hex: '#4c929a',
    max: 5,
    defense: '흘려받기 · 타이밍 반격',
    description: '긴 찌르기와 반격. 상대의 힘을 받아 되돌려줍니다.',
    stages: [
      '직선 찌르기',
      '흘리기 · 반격 피해 증가',
      '찌르기와 베기 교차 · 두 번째 공격 피해 +15%',
      '반격 성공 시 게이지 증가',
      '태극진 · 주변 적을 한 번에 타격',
    ],
  },
  tianmo: {
    name: '천마신공',
    short: '천마',
    color: 0xc66055,
    hex: '#a83f38',
    max: 5,
    defense: '혈기탈취 · 적중 시 체력 회복',
    description: '체력을 걸고 파고들며, 최근 잃은 체력을 공격으로 되찾습니다.',
    stages: [
      '강한 내려베기',
      '처치 시 체력 소량 회복',
      '베기와 찌르기 교차 · 두 번째 공격 피해 +15%',
      '혈기탈취 강화',
      '천마강림 · 강한 광역 공격',
    ],
  },
  samja: {
    name: '삼재검법',
    short: '삼재',
    color: 0xd6bb76,
    hex: '#ad8b3e',
    max: 10,
    defense: '기초 방어 · 짧게 피해 경감',
    description: '느리게 쌓이는 기초. 깊은 수련 끝에는 검기와 이기어검에 도달합니다.',
    stages: [
      '기본 베기',
      '기본 공격 강화',
      '기본 찌르기',
      '단단한 방어',
      '기본 공격 강화',
      '기본 공격 강화',
      '공격 간격 감소',
      '삼재 완성 · 궁극 개방',
      '검기 · 원거리 참격',
      '이기어검 · 검을 부리는 경지',
    ],
  },
  tang: {
    name: '당문독공',
    short: '당문',
    color: 0x84ac6b,
    hex: '#5c8153',
    max: 5,
    defense: '독연보 · 짧은 측면 회피',
    description: '독침으로 중독을 쌓고, 빈틈에 누적된 독을 터뜨립니다.',
    stages: ['쇄독침', '독맥침식', '산화침', '전독', '만독개화'],
  },
  shaolin: {
    name: '소림금강공',
    short: '소림',
    color: 0xc6a868,
    hex: '#9b773a',
    max: 5,
    defense: '금강체 · 피해 경감',
    description: '공격을 견디며 접근하고 진각으로 주변을 밀어냅니다.',
    stages: ['나한권', '금강체', '진각', '반진', '금강불괴'],
  },
  gaebang: {
    name: '개방취봉법',
    short: '개방',
    color: 0xb68b58,
    hex: '#875e38',
    max: 5,
    defense: '취보 · 방향을 틀어 회피',
    description: '봉을 휘둘러 취기를 모으고 다음 초식 두 번을 강화합니다.',
    stages: ['비틀걸음', '취보', '낙신횡소', '주흥', '취몽천하'],
  },
  jegal: {
    name: '제갈팔진술',
    short: '제갈',
    color: 0x869da2,
    hex: '#637e83',
    max: 5,
    defense: '기문보 · 진 안에서 피해 경감',
    description: '건진과 곤진을 배치해 적의 길을 묶고 진동을 일으킵니다.',
    stages: ['건진', '기문정위', '곤진', '합진', '기문팔진'],
  },
};
export const ART_IDS = Object.keys(ARTS) as ArtId[];
for (const art of ART_IDS) {
  ARTS[art].stages = source.arts.filter((stage) => stage.art === ARTS[art].name).map((stage) => stage.name);
}
export const ART_WEAPONS: Record<ArtId, WeaponStyle> = {
  huashan: 'sword', wudang: 'sword', tianmo: 'dao', samja: 'sword',
  tang: 'dart', shaolin: 'gauntlet', gaebang: 'staff', jegal: 'fan',
};
export const REGIONS = ['죽림 외곽', '낡은 산문', '고요한 고개', '강호의 문턱'];
export function isPrep(wave: number) {
  return wave % 5 === 4;
}
export function isBoss(wave: number) {
  return wave % 5 === 0;
}
export function xpThreshold(level: number) {
  return 20 * level + 2.5 * level * (level - 1);
}
export function nextXp(level: number) {
  return xpThreshold(level + 1);
}
export const ITEM_DEFS: Record<
  ItemKind,
  { name: string; w: number; h: number; power: number; icon: string }
> = {
  sword: { name: '강철검', w: 1, h: 3, power: 5, icon: '⚔' },
  robe: { name: '무명 도포', w: 2, h: 3, power: 2, icon: '衣' },
  boots: { name: '경량 가죽신', w: 2, h: 2, power: 1, icon: '足' },
  charm: { name: '청옥 패옥', w: 1, h: 1, power: 3, icon: '◇' },
  medicine: { name: '금창약', w: 1, h: 1, power: 35, icon: '葯' },
  manual: { name: '수련 비급', w: 1, h: 2, power: 20, icon: '書' },
  ore: { name: '철광석', w: 1, h: 1, power: 0, icon: '◆' },
};
export function makeItem(kind: ItemKind, id: string, place: Item['place'], quality = 100): Item {
  const d = ITEM_DEFS[kind];
  return {
    id,
    kind,
    name: d.name,
    w: d.w,
    h: d.h,
    place,
    x: 0,
    y: 0,
    rotated: false,
    count: 1,
    quality,
    statRevision: ['sword', 'robe', 'boots', 'charm'].includes(kind) ? 1 : undefined,
    power: ['sword', 'robe', 'boots', 'charm'].includes(kind)
      ? statPrecision((d.power * quality) / 100)
      : Math.round((d.power * quality) / 100),
  };
}
export function makeWeapon(style: WeaponStyle, id: string, place: Item['place'], quality = 70): Item {
  const names: Record<WeaponStyle, string> = {
    sword: '수련검', dao: '수련도', dart: '수련 암기', gauntlet: '수련 권갑',
    staff: '수련봉', fan: '수련 부채',
  };
  const shapes: Record<WeaponStyle, { w: number; h: number }> = {
    sword: { w: 1, h: 3 }, dao: { w: 1, h: 3 }, dart: { w: 1, h: 1 },
    gauntlet: { w: 2, h: 1 }, staff: { w: 1, h: 4 }, fan: { w: 2, h: 2 },
  };
  return { ...makeItem('sword', id, place, quality), name: names[style], weaponStyle: style, ...shapes[style] };
}
export function maximumHp(f?: { level?: number; growth?: Fighter['growth']; growthStartLevel?: number; augments?: Fighter['augments'] }) {
  const stats = f ? characterStats({ ...f, level: f.level ?? 0 }) : undefined;
  return 120 + Math.round((stats?.constitution ?? 0) + (stats?.hpBonus ?? 0));
}
