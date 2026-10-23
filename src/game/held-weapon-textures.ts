import type Phaser from 'phaser';
import type { Item } from '../domain/model';
import { dedicatedItemArt } from '../platform/item-art';
import { SINGLE_WEAPON_FRAMES } from './weapon-grips';

const pending = new WeakMap<Phaser.Scene, Set<string>>();
/** Equipment can change after arena preload (party join, loot or a rest rebind).
 * Queue only the displayed weapon once. Never substitute the previously held blade.
 * Loader failures follow the arena's existing error/retry path.
 */
export function ensureHeldWeaponTexture(scene: Phaser.Scene, item?: Item) {
  const art = dedicatedItemArt(item);
  if (!art) return;
  const single = SINGLE_WEAPON_FRAMES[art.id];
  if (single) return; // The shared dart/gauntlet atlas is prepared with HeldWeapon.
  const key = `held-${art.id}`;
  if (scene.textures.exists(key)) {
    const texture = scene.textures.get(key);
    if (!texture.has('held'))
      texture.add('held', 0, ...(art.bounds as [number, number, number, number]));
    return;
  }
  const queue = pending.get(scene) ?? new Set<string>();
  pending.set(scene, queue);
  if (queue.has(key)) return;
  queue.add(key);
  scene.load.once(`filecomplete-image-${key}`, () => {
    queue.delete(key);
    const texture = scene.textures.get(key);
    if (!texture.has('held'))
      texture.add('held', 0, ...(art.bounds as [number, number, number, number]));
  });
  scene.load.image(key, art.src);
  if (!scene.load.isLoading()) scene.load.start();
}
