import { ITEM_CATALOGUE } from '../domain/items';
import { ITEM_ARTWORK } from './item-art';
import { BOSSES, REGIONS } from '../domain/campaign';
import { bossReward } from '../domain/boss-loot';

export const HELD_WEAPON_IMAGES = Object.fromEntries(
  [
    ...ITEM_CATALOGUE.filter((item) => item.kind === 'sword').map((item) => item.id),
    ...BOSSES.map(
      (boss) => `${REGIONS.findIndex((region) => region.name === boss.region)}-${boss.phase}`,
    )
      .filter((id) => bossReward(id, 'preview')?.kind === 'sword')
      .map((id) => `boss-${id}`),
  ]
    .filter((id) => ITEM_ARTWORK[id])
    .map((id) => [`held-${id}`, ITEM_ARTWORK[id].src]),
);
export const UI_IMAGES = {
  augmentIcons: '/art/character-polish-v1/augment-icons.webp',
  recruit0: '/art/character-polish-v1/recruit-0.webp',
  recruit1: '/art/character-polish-v1/recruit-1.webp',
  recruit2: '/art/character-polish-v1/recruit-2.webp',
  navigation: '/art/delivery-v1/ui/navigation-v1.webp',
  symbols: '/art/delivery-v1/ui/symbols-v1.webp',
  materials: '/art/delivery-v1/ui/materials-v2.webp',
  portrait: '/art/delivery-v1/portrait-v1.webp',
  lobby: '/art/delivery-v1/ui/lobby-v2.webp',
  newArts: '/art/ui/new-arts-v1.png',
  weapons: '/art/ui/weapons-v2.png',
  bossLoot: '/art/ui/boss-loot-v1.png',
} as const;

export const COMBAT_IMAGES = {
  'held-darts': '/art/held-darts-v1.webp',
  'held-gauntlets': '/art/held-gauntlets-v1.webp',
  forest: '/art/delivery-v1/forest-v1.webp',
  hero: '/art/animation-rebuild-v2/hero.webp',
  ...HELD_WEAPON_IMAGES,
  enemy: '/art/delivery-v1/enemy-atlas-v1.webp',
  'painted-effects': '/art/delivery-v1/ui/effects-v2.webp',
  'painted-zones': '/art/zone-art-v2.png',
  'painted-projectiles': '/art/projectiles-v1.webp',
  'painted-stone': '/art/projectile-stone-v1.webp',
  'enemy-role-directions': '/art/hostile-consistency-v3/roles-directions.webp',
  'enemy-role-rear': '/art/hostile-consistency-v3/roles-rear.webp',
  'hostile-identity-directions': '/art/hostile-consistency-v3/identity-directions.webp',
  'hostile-identity-rear': '/art/hostile-consistency-v3/identity-rear.webp',
  'hostile-identity-actions': '/art/animation-rebuild-v2/identity.webp',
  'enemy-role-actions': '/art/animation-rebuild-v2/roles.webp',
  'hostile-projectiles': '/art/hostile-projectiles-v2.png',
  'hud-artwork': '/art/delivery-v1/ui/hud-atlas-v3.webp',
  'encounter-props': '/art/encounter-props-v1.png',
  'boss-mechanics': '/art/boss-mechanics-v1.png',
  'repair-drone-motion': '/art/animation-rebuild-v2/drone.webp',
  'hero-reactions': '/art/animation-rebuild-v2/hero-reactions.webp',
  'boss-fields': '/art/boss-fields-v1.png',
} as const;

export type ImageManifest = Readonly<Record<string, string>>;
export type PreparedImages = Record<string, HTMLImageElement>;
export type ImageProgress = { completed: number; total: number };
const images = new Map<string, Promise<HTMLImageElement>>();

/** Share both completed and in-flight images; failed requests may be retried. */
function prepareImage(url: string): Promise<HTMLImageElement> {
  const cached = images.get(url);
  if (cached) return cached;
  const request = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    const timeout = window.setTimeout(() => fail(), 60000);
    function finish() {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
    }
    function fail() {
      finish();
      reject(new Error(`Image unavailable: ${url}`));
    }
    image.onerror = fail;
    image.onload = () => {
      // A downloaded file is not ready to paint until decoding finishes.
      void image.decode().then(() => {
        finish();
        resolve(image);
      }, fail);
    };
    image.src = url;
  });
  images.set(url, request);
  void request.catch(() => {
    if (images.get(url) === request) images.delete(url);
  });
  return request;
}

export async function prepareImages(
  manifest: ImageManifest,
  onProgress?: (progress: ImageProgress) => void,
): Promise<PreparedImages> {
  const entries = Object.entries(manifest);
  let completed = 0;
  onProgress?.({ completed, total: entries.length });
  return Object.fromEntries(
    await Promise.all(
      entries.map(async ([key, url]) => {
        const image = await prepareImage(url);
        onProgress?.({ completed: ++completed, total: entries.length });
        return [key, image];
      }),
    ),
  );
}

/** Fonts never block the interface. Only hint fonts that the current locale uses. */
export function preloadFonts(locale: string) {
  if (locale !== 'ko' && locale !== 'en') return;
  for (const name of ['GowunDodum-Regular', 'GowunBatang-Bold']) {
    const href = `/fonts/${name}.woff2`;
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    link.href = href;
    document.head.append(link);
  }
}
