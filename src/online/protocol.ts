import type { Command, InputFrame, GameState } from '../domain/model';
import { ARTS } from '../domain/content';
import { AUGMENT_IDS } from '../domain/character';
export interface OnlineSave {
  revision: number;
  commit: string;
  state: GameState;
  locked: string | null;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 160) =>
  typeof v === 'string' && v.length > 0 && v.length <= max && !/[\p{C}]/u.test(v);
// Accept intents only. No seed, HP, XP, item attributes or uploaded state is accepted.
export function onlineCommand(v: unknown): Command | null {
  if (!object(v) || typeof v.type !== 'string') return null;
  const keys: Record<string, string[]> = {
    recruit: [],
    buyRecruitTicket: [],
    startRecruit: ['id', 'name'],
    startBasic: ['name'],
    next: [],
    claim: [],
    choose: ['offer'],
    chooseAugment: ['id'],
    deferTraining: [],
    openTraining: [],
    switch: ['delta'],
    moveItem: ['id', 'place', 'x', 'y', 'rotated'],
    bind: ['art', 'item'],
    arrangeItems: [],
    use: ['id'],
    buySupply: ['templateId'],
    sellMaterial: ['id'],
    refine: ['id'],
    heal: [],
    discardItem: ['id'],
    select: ['id'],
    restEvent: ['choice'],
  };
  const allowed = keys[v.type];
  if (!allowed || Object.keys(v).some((k) => k !== 'type' && !allowed.includes(k))) return null;
  for (const k of ['id', 'item', 'templateId']) if (k in v && !text(v[k])) return null;
  if (
    ['startRecruit', 'startBasic'].includes(v.type) &&
    (!text(v.name, 12) || !String(v.name).trim())
  )
    return null;
  if (
    [
      'startRecruit',
      'select',
      'use',
      'discardItem',
      'moveItem',
      'refine',
      'sellMaterial',
      'chooseAugment',
    ].includes(v.type) &&
    !text(v.id)
  )
    return null;
  if (v.type === 'chooseAugment' && !AUGMENT_IDS.includes(v.id as never)) return null;
  if (
    v.type === 'choose' &&
    (!object(v.offer) ||
      Object.keys(v.offer).length !== 2 ||
      !Object.hasOwn(ARTS, String(v.offer.art)) ||
      !['learn', 'upgrade'].includes(String(v.offer.type)))
  )
    return null;
  if (v.type === 'bind' && (!Object.hasOwn(ARTS, String(v.art)) || !text(v.item))) return null;
  if (v.type === 'buySupply' && !text(v.templateId)) return null;
  if (v.type === 'switch' && v.delta !== 1 && v.delta !== -1) return null;
  if (v.type === 'restEvent' && !['accept', 'leave'].includes(String(v.choice))) return null;
  if (
    v.type === 'moveItem' &&
    (!['weapon', 'general', 'ground', 'warehouse', 'equipped'].includes(String(v.place)) ||
      ['x', 'y'].some(
        (k) => k in v && (!Number.isSafeInteger(v[k]) || Number(v[k]) < 0 || Number(v[k]) > 100),
      ) ||
      ('rotated' in v && typeof v.rotated !== 'boolean'))
  )
    return null;
  return v as unknown as Command;
}
export function onlineInput(v: unknown): InputFrame | null {
  if (!object(v) || Object.keys(v).sort().join(',') !== 'aim,attack,defense,dx,dy,ultimate')
    return null;
  if (
    ['dx', 'dy', 'aim'].some((k) => typeof v[k] !== 'number' || !Number.isFinite(v[k])) ||
    Math.abs(Number(v.aim)) > Math.PI * 4 ||
    Math.abs(Number(v.dx)) > 1 ||
    Math.abs(Number(v.dy)) > 1 ||
    ['attack', 'defense', 'ultimate'].some((k) => typeof v[k] !== 'boolean')
  )
    return null;
  return v as unknown as InputFrame;
}
