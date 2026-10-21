import type { Run } from './model';
import { maximumHp } from './content';
import { makeLootItem } from './items';
import { regionName } from './campaign';
import { nearestWaystationStop } from './waystation';

export const REST_EVENT_KINDS = ['herbalist', 'manuscript', 'salvage'] as const;
export type RestEventKind = (typeof REST_EVENT_KINDS)[number];
export type RestEventRecord = { wave: number; kind: RestEventKind; choice: 'accept' | 'leave' };
const titles = {
  herbalist: '약초 실험',
  manuscript: '떠돌이 서생',
  salvage: '버려진 보급함',
} as const;
const stories = {
  herbalist: '약초꾼이 혈기로 약의 성질을 확인해 달라고 합니다. 체력을 내주면 회복약을 받습니다.',
  manuscript: '서생이 여비 대신 수련 비급을 내놓았습니다. 필요한 비용과 보상을 확인하세요.',
  salvage: '낡은 보급함을 발견했습니다. 잠금 수리 비용을 내면 강화 재료를 얻습니다.',
} as const;
/** Derived from immutable run identity, wave and region, not the mutable combat RNG. */
export function restEvent(run: Run) {
  let hash = 2166136261;
  for (const c of `${run.id}/${run.wave}/${regionName(run)}`)
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const kind = REST_EVENT_KINDS[hash % REST_EVENT_KINDS.length];
  const stage = Math.floor((run.wave - 1) / 5);
  const hpCost = kind === 'herbalist' ? Math.ceil(maximumHp(run.fighter) * 0.18) : 0;
  const goldCost = kind === 'manuscript' ? 18 + stage * 4 : kind === 'salvage' ? 10 + stage * 3 : 0;
  const templateId =
    kind === 'herbalist'
      ? 'medicine-small'
      : kind === 'manuscript'
        ? 'manual-training'
        : 'material-0';
  const count = kind === 'herbalist' ? 2 : kind === 'salvage' ? 3 : 1;
  const record = run.restEvents?.find((e) => e.wave === run.wave);
  return {
    kind,
    title: titles[kind],
    story: stories[kind],
    hpCost,
    goldCost,
    templateId,
    count,
    record,
    available:
      !record &&
      (hpCost ? run.fighter.hp >= hpCost + 1 : run.fighter.hp > 0) &&
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
    run.gold -= event.goldCost;
    run.fighter.hp -= event.hpCost;
    const item = makeLootItem(event.templateId, `${run.id}-event-${run.wave}`, 'ground');
    item.count = event.count;
    run.fighter.items.push(item);
  }
  (run.restEvents ??= []).push({ wave: run.wave, kind: event.kind, choice });
  return true;
}
