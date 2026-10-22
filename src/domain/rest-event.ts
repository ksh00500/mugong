import type { Run } from './model';
import { maximumHp } from './content';
import { makeLootItem } from './items';
import { regionName } from './campaign';
import { nearestWaystationStop } from './waystation';

export const REST_EVENT_KINDS = ['herbalist', 'manuscript', 'salvage'] as const;
export const ALL_REST_EVENT_KINDS = [...REST_EVENT_KINDS, 'pilgrim', 'duelist', 'caravan'] as const;
export type RestEventKind = (typeof ALL_REST_EVENT_KINDS)[number];
export type RestEventRecord = { wave: number; kind: RestEventKind; choice: 'accept' | 'leave' };
const titles = {
  herbalist: '약초 실험',
  manuscript: '떠돌이 서생',
  salvage: '버려진 보급함',
  pilgrim: '순례자의 약상자',
  duelist: '이름 없는 무인의 가르침',
  caravan: '다친 행상',
} as const;
const stories = {
  herbalist: '약초꾼이 혈기로 약의 성질을 확인해 달라고 합니다. 체력을 내주면 회복약을 받습니다.',
  manuscript: '서생이 여비 대신 수련 비급을 내놓았습니다. 필요한 비용과 보상을 확인하세요.',
  salvage: '낡은 보급함을 발견했습니다. 잠금 수리 비용을 내면 강화 재료를 얻습니다.',
  pilgrim: '순례자가 약상자를 열었습니다. 강화 재료를 건네면 회복약으로 바꿔 줍니다.',
  duelist: '낯선 무인이 실전 수련을 제안합니다. 체력을 내주면 수련 비급을 받습니다.',
  caravan: '행상이 다친 동료를 돕고 있습니다. 소형 회복약을 건네면 강화 재료로 보답합니다.',
} as const;
/** Derived from immutable run identity, wave and region, not the mutable combat RNG. */
export function restEvent(run: Run) {
  let hash = 2166136261;
  for (const c of `${run.id}/${run.wave}/${regionName(run)}`)
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  // Existing journeys keep their three-kind fate; only new journeys opt into revision 2.
  const pool = run.restEventRevision === 2 ? ALL_REST_EVENT_KINDS : REST_EVENT_KINDS;
  const kind = pool[hash % pool.length];
  const stage = Math.floor((run.wave - 1) / 5);
  const hpCost = ['herbalist', 'duelist'].includes(kind)
    ? Math.ceil(maximumHp(run.fighter) * (kind === 'duelist' ? 0.25 : 0.18))
    : 0;
  const itemCost =
    kind === 'pilgrim'
      ? { templateId: 'material-0', count: 2 }
      : kind === 'caravan'
        ? { templateId: 'medicine-small', count: 1 }
        : undefined;
  const goldCost = kind === 'manuscript' ? 18 + stage * 4 : kind === 'salvage' ? 10 + stage * 3 : 0;
  const templateId =
    kind === 'herbalist' || kind === 'pilgrim'
      ? 'medicine-small'
      : kind === 'manuscript' || kind === 'duelist'
        ? 'manual-training'
        : 'material-0';
  const count =
    kind === 'herbalist' || kind === 'pilgrim'
      ? 2
      : kind === 'salvage'
        ? 3
        : kind === 'caravan'
          ? 5
          : 1;
  const heldCount = itemCost
    ? run.fighter.items
        .filter((i) => i.templateId === itemCost.templateId && i.place !== 'warehouse')
        .reduce((sum, i) => sum + i.count, 0)
    : 0;
  const record = run.restEvents?.find((e) => e.wave === run.wave);
  return {
    kind,
    title: titles[kind],
    story: stories[kind],
    hpCost,
    goldCost,
    itemCost,
    heldCount,
    templateId,
    count,
    record,
    available:
      !record &&
      (hpCost ? run.fighter.hp >= hpCost + 1 : run.fighter.hp > 0) &&
      (!itemCost || heldCount >= itemCost.count) &&
      run.gold >= goldCost,
  };
}
export function resolveRestEvent(run: Run, choice: 'accept' | 'leave') {
  if (!['accept', 'leave'].includes(choice)) return false;
  if (run.phase !== 'prep' || ![4, 9, 14, 19].includes(run.wave)) return false;
  if (nearestWaystationStop(run.fighter, run)?.id !== 'fortune') return false;
  const event = restEvent(run);
  if (event.record || (choice === 'accept' && !event.available)) return false;
  if (choice === 'accept') {
    if (event.itemCost) {
      let remaining = event.itemCost.count;
      for (const item of run.fighter.items) {
        if (item.place === 'warehouse' || item.templateId !== event.itemCost.templateId) continue;
        const used = Math.min(item.count, remaining);
        item.count -= used;
        remaining -= used;
        if (!remaining) break;
      }
      run.fighter.items = run.fighter.items.filter((i) => i.count > 0);
    }
    run.gold -= event.goldCost;
    run.fighter.hp -= event.hpCost;
    const item = makeLootItem(event.templateId, `${run.id}-event-${run.wave}`, 'ground');
    item.count = event.count;
    run.fighter.items.push(item);
  }
  (run.restEvents ??= []).push({ wave: run.wave, kind: event.kind, choice });
  return true;
}
