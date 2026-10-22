import { makeWeapon, ART_WEAPONS } from '../domain/content';
import type { ArtId, BoundFighter } from '../domain/model';
import type { PresetId, Seat } from './model';
import { ITEM_CATALOGUE } from '../domain/items';
export const PVP_RULES = {
  width: 1280,
  height: 800,
  left: 80,
  right: 1200,
  top: 140,
  bottom: 680,
  hp: 240,
  speed: 260,
  tickRate: 60,
  snapshotRate: 20,
  countdown: 180,
  roundTime: 5400,
  interval: 180,
  maxRounds: 5,
  inputTimeoutMs: 200,
  reconnectMs: 30000,
} as const;
export const PVP_PRESETS: Record<
  PresetId,
  { name: string; appearance: 0 | 3 | 5 | 8; arts: readonly ArtId[]; description: string }
> = {
  sword: {
    name: '검객',
    appearance: 0,
    arts: ['huashan', 'wudang'],
    description: '회피 베기 · 반격',
  },
  monk: {
    name: '소림',
    appearance: 5,
    arts: ['shaolin', 'samja'],
    description: '근접 충격 · 방어',
  },
  shadow: {
    name: '암영',
    appearance: 3,
    arts: ['tang', 'tianmo'],
    description: '독침 · 혈도 흡혈',
  },
  mystic: {
    name: '기문',
    appearance: 8,
    arts: ['gaebang', 'jegal'],
    description: '봉술 · 기문 부채',
  },
};
export const isPreset = (value: unknown): value is PresetId =>
  typeof value === 'string' && Object.hasOwn(PVP_PRESETS, value);
/** Server-owned trial loadouts. Never imports a local fighter or inventory. */
export function pvpFighter(preset: PresetId, seat: Seat, name: string): BoundFighter {
  const p = PVP_PRESETS[preset],
    items = p.arts.map((id, i) => ({
      ...makeWeapon(ART_WEAPONS[id], `pvp-${seat}-${id}`, 'weapon', 70),
      templateId: ITEM_CATALOGUE.find(
        (item) => item.kind === 'sword' && item.style === ART_WEAPONS[id],
      )!.id,
      x: i * 2,
    }));
  return {
    id: `pvp-${seat}`,
    name,
    appearance: p.appearance,
    level: 16,
    xp: 0,
    hp: PVP_RULES.hp,
    arts: p.arts.map((id) => ({
      id,
      level: id === 'samja' ? 8 : 5,
      gauge: 0,
      combo: 0,
      defenseCd: 0,
    })),
    active: 0,
    items,
    bindings: Object.fromEntries(p.arts.map((id, i) => [id, items[i].id])),
    x: seat === 0 ? 430 : 850,
    y: 420,
    facing: seat === 0 ? 0 : Math.PI,
    action: 'idle',
    actionTime: 0,
    cooldown: 0,
    invulnerable: 0,
    guard: 0,
    shield: 0,
    attackSeq: 0,
  };
}
