import type Phaser from 'phaser';
import type { Enemy } from '../domain/model';
import { MOTION_DIRECTIONS, type MotionAction } from './directional-motion';
import staff from './shaolin-staff-frames.json' with { type: 'json' };
import family from './shaolin-family-frames.json' with { type: 'json' };
import zhuge from './zhuge-family-frames.json' with { type: 'json' };
import tianjian from './tianjian-family-frames.json' with { type: 'json' };
import dokmu from './dokmu-family-frames.json' with { type: 'json' };
import hyeolma from './hyeolma-family-frames.json' with { type: 'json' };
import desert from './desert-family-frames.json' with { type: 'json' };
import qingha from './qingha-family-frames.json' with { type: 'json' };
import snow from './snow-family-frames.json' with { type: 'json' };
import bamboo from './bamboo-family-frames.json' with { type: 'json' };
import tomb from './tomb-family-frames.json' with { type: 'json' };
import { enemyArtSlot } from '../platform/region-art';
import { registerBossSpecial } from './boss-special';
import { bossMotionClock } from './boss-motion';

export const STAFF_ART = staff;
export const SHAOLIN_FAMILY_ART = family;
export const ZHUGE_FAMILY_ART = zhuge;
export const TIANJIAN_FAMILY_ART = tianjian;
export const DOKMU_FAMILY_ART = dokmu;
export const HYEOLMA_FAMILY_ART = hyeolma;
export const DESERT_FAMILY_ART = desert;
export const QINGHA_FAMILY_ART = qingha;
export const SNOW_FAMILY_ART = snow;
export const BAMBOO_FAMILY_ART = bamboo;
export const TOMB_FAMILY_ART = tomb;
export type AuthoredEnemyFrame = (typeof staff.frames)[number];
const frames = new Map(staff.frames.map((frame) => [frame.name, frame]));
// Source texture also identifies the family; identical display IDs in another
// region must never replace this actor's animation table.
const familyFrameKey = (art: { id: string; frames: readonly { texture: string }[] }) =>
  `${art.id}/${art.frames[0].texture}`;
const familyFrames = new Map(
  [
    ...family.characters,
    ...zhuge.characters,
    ...tianjian.characters,
    ...dokmu.characters,
    ...hyeolma.characters,
    ...desert.characters,
    ...qingha.characters,
    ...snow.characters,
    ...bamboo.characters,
    ...tomb.characters,
  ].map((art) => [familyFrameKey(art), new Map(art.frames.map((f) => [f.name, f]))]),
);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function usesAuthoredStaff(enemy: Pick<Enemy, 'kind' | 'bossId'>, region: number) {
  return region === 4 && !enemy.bossId && enemy.kind === 'spear';
}

/** A source drawing is selected, never warped or fitted to its weapon bounds. */
export function authoredStaffFrame(
  direction: number,
  action: MotionAction,
  progress: number,
  gait: number,
  reduced = false,
) {
  const { view, flip } = MOTION_DIRECTIONS[direction];
  const p = clamp(progress);
  let kind = 'locomotion',
    pose = 0;
  if (action === 'walk' && !reduced) {
    // Left step → passing → right step → passing. Movement distance drives gait.
    pose = [1, 2, 3, 2][Math.floor((((gait % 1) + 1) % 1) * 4)];
  } else if (action === 'windup') {
    kind = 'combat';
    pose = p < 0.45 ? 0 : 1;
  } else if (action === 'strike') {
    kind = 'combat';
    // Contact drawing is visible before the simulation's 0.09s hit in a 0.28s strike.
    pose = p < 0.18 ? 1 : p < 0.48 ? 2 : 3;
  } else if (action === 'recover') {
    kind = 'combat';
    pose = p < 0.42 ? 4 : 5;
  } else if (action === 'hurt') {
    pose = reduced || p > 0.7 ? 0 : 4;
  } else if (action === 'death') pose = 5;
  const frame = frames.get(`${view}-${kind}-${pose}`)!;
  return { frame, flip, view, action };
}

/** Registration uses saved source rectangles; no runtime pixel scans or normalization. */
export function registerAuthoredStaff(texture: Phaser.Textures.Texture) {
  for (const frame of staff.frames)
    if (frame.texture === texture.key && !texture.has(frame.name))
      texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
}

/** Native families own their five camera views and twelve source poses. */
export function authoredEnemyArt(enemy: Pick<Enemy, 'kind' | 'bossId' | 'role'>, region: number) {
  if (region === 6) {
    // Both trapper and guard use spear kind; explicit role owns the tool.
    const slot = enemy.bossId
      ? enemyArtSlot(enemy, region)
      : enemy.role === 'trapper'
        ? 0
        : enemy.role === 'guard'
          ? 1
          : enemy.role === 'crossbow'
            ? 2
            : enemy.kind === 'archer'
              ? 2
              : enemy.kind === 'spear'
                ? 1
                : 0;
    return tomb.characters.find((art) => art.slot === slot);
  }
  if (region === 5) {
    // Explicit roles own the held tool; boss identity precedes inherited roles.
    const slot = enemy.bossId
      ? enemyArtSlot(enemy, region)
      : enemy.role === 'assassin'
        ? 0
        : enemy.role === 'needle'
          ? 1
          : enemy.role === 'trapper'
            ? 2
            : enemy.kind === 'archer'
              ? 1
              : enemy.kind === 'spear'
                ? 2
                : 0;
    return bamboo.characters.find((art) => art.slot === slot);
  }
  if (region === 3) {
    // Iceweaver and bowman both use archer kind; the role owns its held tool.
    const slot = enemy.bossId
      ? enemyArtSlot(enemy, region)
      : enemy.role === 'icehunter'
        ? 0
        : enemy.role === 'iceweaver'
          ? 1
          : enemy.role === 'bowman'
            ? 2
            : enemy.kind === 'spear'
              ? 0
              : 2;
    return snow.characters.find((art) => art.slot === slot);
  }
  if (region === 0) {
    const slot = enemy.bossId
      ? enemyArtSlot(enemy, region)
      : enemy.role === 'raider'
        ? 0
        : enemy.role === 'guard'
          ? 1
          : enemy.role === 'bowman'
            ? 2
            : enemyArtSlot(enemy, region);
    return qingha.characters.find((art) => art.slot === slot);
  }
  if (region === 7) {
    const slot = enemy.bossId
      ? enemyArtSlot(enemy, region)
      : enemy.role === 'rider'
        ? 0
        : enemy.role === 'assassin'
          ? 1
          : enemy.role === 'ringblade'
            ? 2
            : enemyArtSlot(enemy, region);
    return desert.characters.find((art) => art.slot === slot);
  }
  if (region === 8) {
    const slot = enemy.bossId
      ? enemyArtSlot(enemy, region)
      : enemy.role === 'bloodblade'
        ? 0
        : enemy.role === 'assassin'
          ? 1
          : enemy.role === 'hexer'
            ? 2
            : enemyArtSlot(enemy, region);
    return hyeolma.characters.find((art) => art.slot === slot);
  }
  if (region === 1) {
    const slot = enemy.bossId
      ? enemyArtSlot(enemy, region)
      : enemy.role === 'needle'
        ? 0
        : enemy.role === 'guard'
          ? 1
          : enemy.role === 'bombardier'
            ? 2
            : enemyArtSlot(enemy, region);
    return dokmu.characters.find((art) => art.slot === slot);
  }
  if (region === 2) {
    const slot = enemy.bossId
      ? enemyArtSlot(enemy, region)
      : enemy.role === 'duelist'
        ? 0
        : enemy.role === 'guard'
          ? 1
          : enemy.role === 'swordcaster'
            ? 2
            : enemyArtSlot(enemy, region);
    return tianjian.characters.find((art) => art.slot === slot);
  }
  if (region === 9) {
    // Engineer and crossbowman both use kind=archer; the held tool belongs to
    // the gameplay role. Boss identity takes precedence over an inherited role.
    const slot = enemy.bossId
      ? enemyArtSlot(enemy, region)
      : enemy.role === 'engineer'
        ? 0
        : enemy.role === 'gatekeeper'
          ? 1
          : enemy.role === 'crossbow'
            ? 2
            : enemyArtSlot(enemy, region);
    return zhuge.characters.find((art) => art.slot === slot);
  }
  if (region !== 4) return undefined;
  if (usesAuthoredStaff(enemy, region)) return staff;
  return family.characters.find((art) => art.slot === enemyArtSlot(enemy, region));
}

export function authoredEnemyFrame(
  art: NonNullable<ReturnType<typeof authoredEnemyArt>>,
  direction: number,
  action: MotionAction,
  progress: number,
  gait: number,
  reduced = false,
  strike?: { duration: number; contacts: number[] },
) {
  if (art.id === staff.id) return authoredStaffFrame(direction, action, progress, gait, reduced);
  const { view, flip } = MOTION_DIRECTIONS[direction];
  const p = clamp(progress);
  let kind = 'locomotion',
    pose = 0;
  if (action === 'walk' && !reduced) pose = [1, 2, 3, 2][Math.floor((((gait % 1) + 1) % 1) * 4)];
  else if (action === 'windup') {
    kind = 'combat';
    pose = p < 0.45 ? 0 : 1;
  } else if (action === 'strike') {
    kind = 'combat';
    // The ordinary throw releases its projectile at the windup/strike boundary.
    // Melee damage is delayed; a thrown stone must already show release at t=0.
    strike ??= art.id === 'slinger' ? { duration: 0.18, contacts: [0] } : undefined;
    if (strike) {
      // Every combo contact owns a contact exposure. Seconds, rather than one
      // normalized cycle, keep the second and third strikes visible as attacks.
      pose = bossMotionClock('', action, p, strike)!.pose;
    } else pose = p < 0.18 ? 1 : p < 0.48 ? 2 : 3;
  } else if (action === 'recover') {
    kind = 'combat';
    pose = p < 0.42 ? 4 : 5;
  } else if (action === 'hurt') pose = reduced || p > 0.7 ? 0 : 4;
  else if (action === 'death') pose = 5;
  const frame = familyFrames.get(familyFrameKey(art))!.get(`${view}-${kind}-${pose}`)!;
  return { frame, flip, view, action };
}

export function registerAuthoredEnemy(texture: Phaser.Textures.Texture) {
  registerBossSpecial(texture);
  registerAuthoredStaff(texture);
  for (const art of [
    ...family.characters,
    ...zhuge.characters,
    ...tianjian.characters,
    ...dokmu.characters,
    ...hyeolma.characters,
    ...desert.characters,
    ...qingha.characters,
    ...snow.characters,
    ...bamboo.characters,
    ...tomb.characters,
  ])
    for (const frame of art.frames)
      if (frame.texture === texture.key && !texture.has(frame.name))
        texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
}
