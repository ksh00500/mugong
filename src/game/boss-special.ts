import type Phaser from 'phaser';
import type { Enemy, EncounterObject } from '../domain/model';
import type { MotionAction } from './directional-motion';
import { MOTION_DIRECTIONS } from './directional-motion';
import { bossMotionClock } from './boss-motion';
import { bossMotionCycle } from './boss-motion-cycle';
import remaining from './boss-remaining-frames.json' with { type: 'json' };
import special from './shaolin-special-frames.json' with { type: 'json' };
import tianjian from './tianjian-special-frames.json' with { type: 'json' };
import dokmu from './dokmu-special-frames.json' with { type: 'json' };
import qingha from './qingha-special-frames.json' with { type: 'json' };
import three from './three-special-frames.json' with { type: 'json' };

import snow from './snow-special-frames.json' with { type: 'json' };
import snowComplete from './snow-special-complete-frames.json' with { type: 'json' };
import tombBamboo from './tomb-bamboo-special-frames.json' with { type: 'json' };
import tombBambooComplete from './tomb-bamboo-complete-frames.json' with { type: 'json' };

export const SNOW_SPECIAL_ART = snow;
/** Additional Snow actions; existing Mokjin dash/slam retain their source frames. */
export const SNOW_COMPLETE_ART = snowComplete;
export const TOMB_BAMBOO_SPECIAL_ART = tombBamboo;
export const TOMB_BAMBOO_COMPLETE_ART = tombBambooComplete;
export const SHAOLIN_SPECIAL_ART = special;
export const TIANJIAN_SPECIAL_ART = tianjian;
export const DOKMU_SPECIAL_ART = dokmu;
export const QINGHA_SPECIAL_ART = qingha;
export const BOSS_REMAINING_ART = remaining;
export const THREE_SPECIAL_ART = three;
const remainingRegistry = new Map(remaining.characters.map((art) => [art.bossId, art]));
const originals = [
  ...special.characters,
  ...tianjian.characters,
  ...dokmu.characters,
  ...qingha.characters,
  ...snow.characters,
  ...three.characters,
  ...tombBamboo.characters,
];
const snowRegistry = new Map(snowComplete.characters.map((art) => [art.bossId, art]));
const tombBambooRegistry = new Map(tombBambooComplete.characters.map((art) => [art.bossId, art]));
const characters = [
  ...originals,
  ...snowComplete.characters.filter((a) => !originals.some((b) => b.bossId === a.bossId)),
].map((art) => {
  const extra =
    remainingRegistry.get(art.bossId) ??
    (originals.some((a) => a.bossId === art.bossId) ? snowRegistry.get(art.bossId) : undefined) ??
    tombBambooRegistry.get(art.bossId);
  return {
    ...art,
    moves: [...art.moves, ...(extra?.moves ?? [])],
    frames: [...art.frames, ...(extra?.frames ?? [])],
    healthClearance: Math.max(art.healthClearance, extra?.healthClearance ?? 0),
  };
});
const registry = new Map(characters.map((art) => [art.bossId, art]));
const frames = new Map(
  characters.map((art) => [art.bossId, new Map(art.frames.map((f) => [f.name, f]))]),
);

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
