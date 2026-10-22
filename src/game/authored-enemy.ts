import type Phaser from 'phaser';
import type { Enemy } from '../domain/model';
import { MOTION_DIRECTIONS, type MotionAction } from './directional-motion';
import type staffType from './shaolin-staff-frames.json';
let staff = {
  version: 1,
  id: 'unloaded',
  pixelScale: 0.225,
  cell: { width: 0, height: 0, padding: 32 },
  healthClearance: 0,
  frames: [],
} as typeof staffType;
import type familyType from './shaolin-family-frames.json';
let family = { version: 1, characters: [] } as typeof familyType;
import type zhugeType from './zhuge-family-frames.json';
let zhuge = { version: 1, characters: [] } as typeof zhugeType;
import type tianjianType from './tianjian-family-frames.json';
let tianjian = { version: 1, characters: [] } as typeof tianjianType;
import type dokmuType from './dokmu-family-frames.json';
let dokmu = { version: 1, characters: [] } as typeof dokmuType;
import type hyeolmaType from './hyeolma-family-frames.json';
let hyeolma = { version: 1, characters: [] } as typeof hyeolmaType;
import type desertType from './desert-family-frames.json';
let desert = { version: 1, characters: [] } as typeof desertType;
import type qinghaType from './qingha-family-frames.json';
let qingha = { version: 1, characters: [] } as typeof qinghaType;
import type snowType from './snow-family-frames.json';
let snow = { version: 1, characters: [] } as typeof snowType;
import type bambooType from './bamboo-family-frames.json';
let bamboo = { version: 1, characters: [] } as typeof bambooType;
import type tombType from './tomb-family-frames.json';
let tomb = { version: 1, characters: [] } as typeof tombType;
import { enemyArtSlot } from '../platform/region-art';
import { registerBossSpecial } from './boss-special';
import { bossMotionClock } from './boss-motion';

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
const familyLoaders = import.meta.glob('./*-family-frames.json', { import: 'default' });
const nativeRegions = [
  'qingha',
  'dokmu',
  'tianjian',
  'snow',
  'shaolin',
  'bamboo',
  'tomb',
  'desert',
  'hyeolma',
  'zhuge',
];
const nativeRequests = new Map<number, Promise<void>>();
const nativeReadyRegions = new Set<number>();
export const nativeFamilyReady = (region: number) => region < 0 || nativeReadyRegions.has(region);
export async function prepareNativeFamily(region = -1): Promise<void> {
  if (region < 0) {
    await Promise.all(nativeRegions.map((_, i) => prepareNativeFamily(i)));
    return;
  }
  const previous = nativeRequests.get(region);
  if (previous) return previous;
  const loader = familyLoaders['./' + nativeRegions[region] + '-family-frames.json'];
  if (!loader) throw Error('Unknown native region ' + region);
  const request = Promise.all([
    loader(),
    region === 4
      ? import('./shaolin-staff-frames.json').then((m) => m.default)
      : Promise.resolve(null),
  ]).then(([raw, staffRaw]) => {
    switch (region) {
      case 0:
        qingha = raw as typeof qingha;
        break;
      case 1:
        dokmu = raw as typeof dokmu;
        break;
      case 2:
        tianjian = raw as typeof tianjian;
        break;
      case 3:
        snow = raw as typeof snow;
        break;
      case 4:
        family = raw as typeof family;
        break;
      case 5:
        bamboo = raw as typeof bamboo;
        break;
      case 6:
        tomb = raw as typeof tomb;
        break;
      case 7:
        desert = raw as typeof desert;
        break;
      case 8:
        hyeolma = raw as typeof hyeolma;
        break;
      case 9:
        zhuge = raw as typeof zhuge;
        break;
    }
    for (const art of (raw as typeof family).characters)
      familyFrames.set(
        familyFrameKey(art),
        new Map(art.frames.map((frame) => [frame.name, frame])),
      );
    if (staffRaw) {
      staff = staffRaw;
      for (const frame of staff.frames) frames.set(frame.name, frame);
    }
    nativeReadyRegions.add(region);
  });
  nativeRequests.set(region, request);
  void request.catch(() => nativeRequests.delete(region));
  return request;
}
if (typeof window === 'undefined') await prepareNativeFamily();
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
