import { it, expect } from 'vitest';
import { ensureHeldWeaponTexture } from '../src/game/held-weapon-textures';
import { makeLootItem } from '../src/domain/items';
import { bossReward } from '../src/domain/boss-loot';
it('late held artwork queues once, registers its crop on completion and reuses the texture', () => {
  const queued: string[] = [],
    frames: string[] = [],
    once = new Map<string, () => void>(),
    loaded = new Set<string>();
  const scene = {
    textures: {
      exists: (k: string) => loaded.has(k),
      get: () => ({ has: () => frames.length > 0, add: (name: string) => frames.push(name) }),
    },
    load: {
      once: (k: string, cb: () => void) => once.set(k, cb),
      image: (k: string) => queued.push(k),
      isLoading: () => false,
      start: () => {},
    },
  } as any;
  const item = bossReward('9-4', 'late')!;
  item.place = 'weapon';
  ensureHeldWeaponTexture(scene, item);
  ensureHeldWeaponTexture(scene, item);
  expect(queued).toEqual(['held-boss-9-4']);
  loaded.add(queued[0]);
  once.get('filecomplete-image-held-boss-9-4')!();
  ensureHeldWeaponTexture(scene, item);
  expect(frames).toEqual(['held']);
  expect(queued).toHaveLength(1);
});
it('single-hand atlases and absent equipment never request an extra per-item image', () => {
  const scene = {
    textures: { exists: () => false },
    load: {
      image: () => {
        throw Error('Unexpected fetch');
      },
    },
  } as any;
  ensureHeldWeaponTexture(scene);
  ensureHeldWeaponTexture(scene, makeLootItem('weapon-dart-0', 'dart', 'weapon'));
});
