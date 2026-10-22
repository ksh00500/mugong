import type { ArtId, BoundFighter, Enemy, FieldZone, Projectile, Run } from './model';
import { bossById, regionName } from './campaign';
import { compatibleWeapon } from './inventory';
import { itemIdentity, itemRarity } from './items';
import { meleeKit } from './boss-melee';

export const PROJECTILE_VISUALS = [
  'bronze-dart',
  'steel-needle',
  'jade-needle',
  'wind-blade',
  'sword-wave',
  'flying-sword',
  'arrow',
  'returning-blade',
  'stone',
  'poison-bomb',
  'palm-wave',
  'ice-bomb',
  'fire-bomb',
  'blood-orb',
  'seal-bolt',
  'spike-bomb',
  'brew-pot',
  'ice-shard',
] as const;
export type ProjectileVisual = (typeof PROJECTILE_VISUALS)[number];

export const HOSTILE_PROJECTILE_FRAMES = {
  'poison-bomb': 0,
  'ice-bomb': 1,
  'fire-bomb': 2,
  'blood-orb': 3,
  'seal-bolt': 4,
  'spike-bomb': 5,
  'brew-pot': 6,
  'ice-shard': 7,
} as const;

export function hazardProjectileVisual(kind: FieldZone['kind']): ProjectileVisual {
  return (
    (
      {
        poison: 'poison-bomb',
        cold: 'ice-bomb',
        fire: 'fire-bomb',
        blood: 'blood-orb',
        gate: 'seal-bolt',
        trap: 'spike-bomb',
        brew: 'brew-pot',
      } as Partial<Record<FieldZone['kind'], ProjectileVisual>>
    )[kind] ?? 'stone'
  );
}

export function hostileProjectileVisual(
  run: Pick<Run, 'wave' | 'regionRoute'>,
  enemy: Pick<Enemy, 'kind' | 'bossId' | 'role'> & Partial<Pick<Enemy, 'move' | 'pattern'>>,
  returning = false,
): ProjectileVisual {
  const kit = meleeKit(enemy);
  const spec = kit?.moves[enemy.move ?? kit.sequence[(enemy.pattern ?? 0) % kit.sequence.length]];
  if (spec?.shot) return spec.shot.visual;
  if (spec?.zone) return hazardProjectileVisual(spec.zone.kind);
  const region = bossById(enemy.bossId)?.region ?? regionName(run);
  const personal: Record<string, ProjectileVisual> = {
    '1-2': 'poison-bomb',
    '3-2': 'ice-shard',
    '3-4': 'ice-shard',
    '5-4': 'steel-needle',
    '6-4': 'flying-sword',
    '8-3': 'blood-orb',
    '8-4': 'sword-wave',
    '9-1': 'wind-blade',
    '9-3': 'sword-wave',
    '9-4': 'wind-blade',
  };
  if (enemy.bossId && personal[enemy.bossId]) return personal[enemy.bossId];
  if (!enemy.bossId && enemy.role) {
    if (enemy.role === 'ringblade') return 'returning-blade';
    if (enemy.role === 'bowman' || enemy.role === 'crossbow') return 'arrow';
    if (enemy.role === 'slinger') return 'stone';
    if (enemy.role === 'needle') return region === '독무곡' ? 'jade-needle' : 'steel-needle';
    if (enemy.role === 'swordcaster') return 'sword-wave';
  }
  if (returning) return region === '천검산' ? 'flying-sword' : 'returning-blade';
  if (region === '독무곡') return 'jade-needle';
  if (region === '천검산') return 'sword-wave';
  if (region === '죽림') return 'steel-needle';
  if (!enemy.bossId && enemy.kind === 'archer') return region === '폐사' ? 'stone' : 'arrow';
  return region === '설산' || region === '고묘' || region === '팔진고성' ? 'arrow' : 'sword-wave';
}

/** Capture the bound weapon at release; switching arts cannot change a shot already in flight. */
export function friendlyProjectileVisual(f: BoundFighter, art: ArtId, level = 1): ProjectileVisual {
  if (art === 'jegal') return 'wind-blade';
  if (art !== 'tang') return level >= 10 ? 'flying-sword' : 'sword-wave';
  const weapon = f.items.find(
    (item) =>
      item.place === 'weapon' && item.id === f.bindings?.[art] && compatibleWeapon(item, art),
  );
  if (!weapon) return 'bronze-dart';
  const identity = itemIdentity(weapon);
  if (identity === 'weapon-dart-0') return 'bronze-dart';
  if (identity === 'weapon-dart-1') return 'steel-needle';
  if (identity === 'weapon-dart-2') return 'jade-needle';
  return itemRarity(weapon) === 'common'
    ? 'bronze-dart'
    : itemRarity(weapon) === 'refined'
      ? 'steel-needle'
      : 'jade-needle';
}

/** Older saves have no visual metadata and retain a sensible, deterministic appearance. */
export function projectileVisual(p: Projectile): ProjectileVisual {
  if (!p.friendly && p.landing) return hazardProjectileVisual(p.landing.kind);
  return (
    p.visual ??
    (!p.friendly
      ? p.returnAt !== undefined
        ? 'returning-blade'
        : 'arrow'
      : p.art === 'tang'
        ? 'steel-needle'
        : p.art === 'jegal'
          ? 'wind-blade'
          : p.art === 'samja' && (p.level ?? 0) >= 10
            ? 'flying-sword'
            : 'sword-wave')
  );
}
