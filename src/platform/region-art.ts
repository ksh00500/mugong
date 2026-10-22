import artIndex from './region-art-manifests.json';
import { REGIONS, regionName, bossById } from '../domain/campaign';
import type { Enemy, Run } from '../domain/model';

type ArtEntry = {
  all: Record<string, string>;
  ordinary: Record<string, string>;
  bosses: Record<string, Record<string, string>>;
};
// JSON infers a wide union of optional literal keys; the generator and parity test own this schema.
const regions = artIndex.regions as unknown as readonly ArtEntry[];

export function regionArtIndex(run?: Pick<Run, 'wave' | 'regionRoute'> | null) {
  return run ? REGIONS.findIndex((region) => region.name === regionName(run)) : -1;
}

export function regionArtManifest(index: number): Record<string, string> {
  return { ...(regions[index]?.all ?? {}) };
}

/** Keep source/test galleries complete, but only gate play on the actors in this encounter. */
export function runArtBosses(run: Run | null | undefined) {
  const index = regionArtIndex(run);
  if (!run || index < 0) return [];
  const ids = new Set(run.enemies.map((e) => e.bossId).filter((id): id is string => !!id));
  if (run.wave % 5 === 0) ids.add(`${index}-${run.wave / 5}`);
  return [...ids].filter((id) => id.startsWith(`${index}-`)).sort();
}
export function runArtKey(run: Run | null | undefined) {
  return `${regionArtIndex(run)}:${runArtBosses(run).join(',')}`;
}
export function runArtManifest(run: Run | null | undefined): Record<string, string> {
  const entry = regions[regionArtIndex(run)];
  if (!entry) return {};
  const bosses = entry.bosses;
  return Object.assign({}, entry.ordinary, ...runArtBosses(run).map((id) => bosses[id] ?? {}));
}

export function enemyMotionRepairSlots(index: number) {
  return index === 2 ? [2] : index === 4 ? [2, 3] : index === 9 ? [3] : [];
}

/** The generated rear diagonal is left-facing in most plates. Calibrated from
 * the actual artwork, independently of the requested column label. */
export function enemyDirectionFlip(index: number, slot: number, view: number, flipped: boolean) {
  // v3 contact plate: R0/R2 look right; the last three R6 rows look left.
  // Do not reuse the previous atlas orientation table after replacing artwork.
  const rearLeft = index === 6 ? slot >= 4 : index !== 0 && index !== 2;
  return view === 3 && rearLeft ? !flipped : flipped;
}

/** Slots 0–2 are the three gameplay roles; slots 3–6 are source boss phases. */
export function enemyArtSlot(enemy: Pick<Enemy, 'kind' | 'bossId' | 'role'>, region = -1) {
  if (enemy.bossId) {
    const boss = bossById(enemy.bossId);
    if (boss) return boss.phase + 2;
  }
  if (enemy.role === 'needle') return region === 5 ? 2 : 0;
  if (region === 7 && !enemy.bossId) {
    if (enemy.role === 'rider') return 0;
    if (enemy.role === 'assassin') return 1;
    if (enemy.role === 'ringblade') return 2;
  }
  if (enemy.role === 'hexer' && region === 8) return 5;
  return enemy.kind === 'archer' || enemy.kind === 'captain' ? 2 : enemy.kind === 'spear' ? 1 : 0;
}

/** Dedicated tools remain visible in all five views; bosses take precedence over inherited role. */
export function enemyRepairSlot(enemy: Pick<Enemy, 'bossId' | 'role'>) {
  if (enemy.bossId) return enemy.bossId === '5-2' ? 3 : undefined;
  return enemy.role === 'iceweaver'
    ? 0
    : enemy.role === 'trapper'
      ? 1
      : enemy.role === 'engineer'
        ? 2
        : undefined;
}

/** One replacement identity owns its directions and every action together. */
export function hostileIdentitySlot(
  enemy: Pick<Enemy, 'bossId' | 'kind' | 'role'>,
  region: number,
) {
  if (enemy.bossId === '2-1') return 0;
  if (enemy.bossId === '4-4') return 2;
  if (
    !enemy.bossId &&
    region === 4 &&
    enemyArtSlot(enemy, region) === 2 &&
    enemyRepairSlot(enemy) === undefined
  )
    return 1;
  return undefined;
}
