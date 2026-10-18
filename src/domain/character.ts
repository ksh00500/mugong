import type { Fighter, Run } from './model';

export const TRAITS = {
  unyielding: ['불굴', '전투마다 한 번, 치명상을 체력 1로 버팁니다.'],
  gambler: ['승부사', '체력 35% 미만에서 기본 공격 피해가 20% 증가합니다.'],
  calm: ['침착', '5초 동안 피해를 받지 않으면 궁극 충전량이 20% 증가합니다.'],
  quickhands: ['재빠른 손', '무공 전환 후 다음 기본 공격 피해가 25% 증가합니다. 재사용 4초.'],
  counter: ['반격 본능', '반격 성공 후 다음 기본 공격 피해가 35% 증가합니다.'],
  flexible: ['유연한 몸', '회피 후 다음 기본 적중의 경직이 0.12초 증가합니다.'],
  focus: ['집중력', '같은 적에 세 번 연속 기본 공격 적중 시 세 번째 피해가 15% 증가합니다.'],
  momentum: ['파죽지세', '적 처치 후 2초 동안 이동 속도가 15% 증가합니다.'],
  herbal: ['약초 체질', '약품의 체력 회복량이 25% 증가합니다.'],
  circulation: ['내공 순환', '궁극 사용 시 최대 체력의 5%를 회복합니다.'],
} as const;
export type TraitId = keyof typeof TRAITS;
export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];
export const AUGMENTS = {
  vigor: ['강건', '최대 체력 +60'],
  might: ['괴력', '근력 +30'],
  swift: ['경쾌', '기민 +20'],
  reservoir: ['내공 확장', '내공 +40'],
  iron: ['철벽', '받는 피해 10% 감소'],
  tempo: ['속공', '기본 공격 간격 10% 감소'],
  medicine: ['약리', '약품 회복량 25% 증가'],
  resolve: ['수비 숙달', '방어 행동 재사용 시간 15% 감소'],
} as const;
export type AugmentId = keyof typeof AUGMENTS;
export const AUGMENT_IDS = Object.keys(AUGMENTS) as AugmentId[];
export const AUGMENT_LEVELS = [10, 25, 50];
export function characterStats(f: Pick<Fighter, 'level' | 'growth'> & Partial<Fighter>) {
  const levels = Math.max(0, f.level - (f.growthStartLevel ?? 0));
  const has = (id: AugmentId) => f.augments?.includes(id);
  return {
    constitution: levels * 10 * (f.growth?.constitution ?? 0),
    strength: levels * 5 * (f.growth?.strength ?? 0) + (has('might') ? 30 : 0),
    agility: levels * 3 * (f.growth?.agility ?? 0) + (has('swift') ? 20 : 0),
    inner: levels * 5 * (f.growth?.inner ?? 0) + (has('reservoir') ? 40 : 0),
    hpBonus: has('vigor') ? 60 : 0,
  };
}
export function augmentOffers(f: Fighter, random: () => number) {
  if (f.progressionVersion !== 2 || f.augmentOffers?.length) return;
  const due = AUGMENT_LEVELS.filter(level => f.level >= level).length;
  if ((f.augments?.length ?? 0) >= due) return;
  const pool = AUGMENT_IDS.filter(id => !f.augments?.includes(id));
  for (let n = pool.length - 1; n > 0; n--) {
    const at = Math.floor(random() * (n + 1));
    [pool[n], pool[at]] = [pool[at], pool[n]];
  }
  f.augmentOffers = pool.slice(0, 3);
}
export function pendingChoices(r?: Run | null) {
  return !!r && (!!r.offers.length || !!r.fighter.augmentOffers?.length);
}
export function medicineFactor(f: Partial<Fighter>) {
  return (f.innate === 'herbal' ? 1.25 : 1) * (f.augments?.includes('medicine') ? 1.25 : 1);
}
export function innateAttack(f: Fighter, maximum: number) {
  const state = f.traitState ??= {};
  const boost = (state.attackBoost ?? 0) + (f.innate === 'gambler' && f.hp < maximum * 0.35 ? 0.2 : 0);
  state.attackBoost = 0;
  return 1 + boost;
}
export function innateHit(f: Fighter, target: number, sequence = f.attackSeq) {
  if (f.innate !== 'focus') return 1;
  const state = f.traitState ??= {};
  if (state.sequence === sequence && state.target === target) return 1;
  state.hits = state.target === target ? (state.hits ?? 0) + 1 : 1;
  state.target = target;
  state.sequence = sequence;
  return state.hits % 3 === 0 ? 1.15 : 1;
}
export function stepTraits(f: Fighter, dt: number) {
  if (!f.innate) return;
  const state = f.traitState ??= {};
  state.untouched = Math.min(5, (state.untouched ?? 0) + dt);
  state.switchCd = Math.max(0, (state.switchCd ?? 0) - dt);
  state.momentum = Math.max(0, (state.momentum ?? 0) - dt);
}
