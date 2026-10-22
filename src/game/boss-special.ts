import type Phaser from 'phaser';
import type { Enemy, EncounterObject } from '../domain/model';
import type { MotionAction } from './directional-motion';
import { MOTION_DIRECTIONS } from './directional-motion';
import { bossMotionClock } from './boss-motion';
import { bossMotionCycle } from './boss-motion-cycle';
import type { SpecialArt } from './boss-special-data';
const characters: SpecialArt[] = [];
const registry = new Map<string, SpecialArt>();
const frames = new Map<string, Map<string, SpecialArt['frames'][number]>>();
const remainingRegistry = new Map<string, { moves: string[] }>();
const loaders = import.meta.glob('./boss-special-regions/region-*.json', { import: 'default' });
const requests = new Map<number, Promise<void>>();
const readyRegions = new Set<number>();
export const bossSpecialReady = (region: number) => region < 0 || readyRegions.has(region);
export async function prepareBossSpecial(region = -1): Promise<void> {
  if (region < 0) {
    await Promise.all(Array.from({ length: 10 }, (_, i) => prepareBossSpecial(i)));
    return;
  }
  const previous = requests.get(region);
  if (previous) return previous;
  const loader = loaders['./boss-special-regions/region-' + region + '.json'];
  if (!loader) throw Error('Unknown boss region ' + region);
  const request = loader().then((raw) => {
    const data = raw as {
      region: number;
      characters: SpecialArt[];
      remaining: { bossId: string; moves: string[] }[];
    };
    if (data.region !== region || data.characters.length !== 4)
      throw Error('Invalid reviewed boss metadata');
    for (const art of data.characters) {
      characters.push(art);
      registry.set(art.bossId, art);
      frames.set(art.bossId, new Map(art.frames.map((frame) => [frame.name, frame])));
    }
    for (const art of data.remaining) remainingRegistry.set(art.bossId, art);
    readyRegions.add(region);
  });
  requests.set(region, request);
  void request.catch(() => requests.delete(region));
  return request;
}
// Node audits keep their synchronous drawing API after module evaluation.
if (typeof window === 'undefined') await prepareBossSpecial();

export function bossSpecialArt(enemy: Pick<Enemy, 'bossId'>, region: number) {
  return enemy.bossId && Number(enemy.bossId.split('-')[0]) === region
    ? registry.get(enemy.bossId)
    : undefined;
}

export function bossSpecialFrame(
  enemy: Pick<Enemy, 'bossId' | 'id' | 'guardTime'>,
  region: number,
  direction: number,
  move: string,
  action: MotionAction,
  progress: number,
  strike: { duration: number; contacts: readonly number[] },
  objects: readonly EncounterObject[] = [],
) {
  const art = bossSpecialArt(enemy, region);
  if (!art || action === 'death' || action === 'hurt') return undefined;
  const grabbed = objects.some(
    (o) => o.owner === enemy.id && o.mechanic === 'grab' && o.stage === 1 && o.life > 0,
  );
  const guarding = (enemy.guardTime ?? 0) > 0 && ['idle', 'walk', 'recover'].includes(action);
  // A successful grab owns its hold until the simulation actually releases it.
  const selectedMove = grabbed ? 'grab' : guarding ? 'stance' : move;
  if (!art.moves.includes(selectedMove)) return undefined;
  const motion = bossMotionClock(selectedMove, action, progress, strike, grabbed || guarding);
  if (!motion) return undefined;
  const { view, flip } = MOTION_DIRECTIONS[direction];
  const extra = remainingRegistry.get(art.bossId);
  const cycle = bossMotionCycle(motion, action, progress, strike);
  const name = extra?.moves.includes(selectedMove)
    ? `${view}-remaining-${selectedMove}-${cycle}-${motion.pose}`
    : `${view}-${selectedMove}-${motion.pose}`;
  const bank = frames.get(art.bossId)!;
  const frame = bank.get(`${view}-${selectedMove}-cycle-${cycle}-${motion.pose}`) ?? bank.get(name);
  if (!frame) return undefined;
  return { frame, flip, view, action, motion: { ...motion, cycle } };
}

export function registerBossSpecial(texture: Phaser.Textures.Texture) {
  for (const art of characters)
    for (const frame of art.frames)
      if (frame.texture === texture.key && !texture.has(frame.name))
        texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
}

/** One fixed clearance across ordinary and special poses, with no pose fitting. */
export function bossHealthClearance(enemy: Pick<Enemy, 'bossId'>, region: number, base: number) {
  return Math.max(base, bossSpecialArt(enemy, region)?.healthClearance ?? 0);
}
