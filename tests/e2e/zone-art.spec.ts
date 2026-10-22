import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = 'docs/verification/zone-art-v1';
test('이전 제단 저장의 브라우저 로드·자동 저장은 진행과 물품을 보존한다', async ({ page }) => {
  await seedRegion(page, 8);
  const original = await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const state = structuredClone(store.state),
      r = state.run;
    r.phase = 'loot';
    r.gold = 75;
    r.altarUsed = true;
    r.zones = [
      { id: 0, x: 1250, y: 520, radius: 45, warning: 0, life: 100000, pulse: 0, kind: 'altar' },
    ];
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
    return { fighter: r.fighter, wave: r.wave, enemies: r.enemies };
  });
  await page.reload();
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  const current = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    const saved = await new Promise<any>((resolve) => {
      const q = db.transaction('saves').objectStore('saves').get('current');
      q.onsuccess = () => resolve(q.result);
    });
    db.close();
    return saved.run;
  });
  expect(current).not.toHaveProperty('altarUsed');
  expect(current.zones).toEqual([]);
  expect(current.gold).toBe(75);
  expect(current.fighter).toEqual(original.fighter);
  expect(current.wave).toBe(original.wave);
  expect(current.enemies).toEqual(original.enemies);
});

for (const [region, title] of [
  [1, '독지대'],
  [3, '냉기와 화롯불'],
  [4, '술병과 쇠사슬'],
  [6, '불길과 함정'],
  [7, '모래와 쇠사슬'],
  [8, '혈지대와 연막'],
  [9, '진법과 함정'],
] as const)
  test(`구역 이미지 실제 렌더링·판정 정렬: ${title}`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, region);
    await observeScene(page);
    const result = await page.evaluate(async (region) => {
      const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
      const r = store.state.run,
        scene = (window as any).regionScene;
      store.rendererReady = false;
      r.enemies = [r.enemies[3]];
      r.enemies[0].x = 1450;
      r.enemies[0].y = 450;
      r.enemies[0].state = 'recover';
      r.enemies[0].timer = 100;
      r.fighter.x = 850;
      r.fighter.y = 520;
      const kinds =
        region === 1
          ? ['poison', 'poison']
          : region === 3
            ? ['cold', 'cold']
            : region === 9
              ? ['gate', 'trap']
              : [];
      r.zones = kinds.map((kind, id) => ({
        id: region === 3 ? id : id + 1,
        kind,
        x: 620 + id * 520,
        y: 500,
        radius: 130,
        warning: 0,
        life: 10,
        pulse: 0,
      }));
      r.encounterObjects =
        region === 8
          ? ['blood', 'smoke', 'seal', 'safe'].map((kind, id) => ({
              id: id + 1,
              owner: r.enemies[0].id,
              kind,
              x: 490 + id * 310,
              y: 570,
              radius: 110,
              warning: 0,
              life: 10,
              pulse: 1,
              hp: 0,
              maxHp: 0,
              aim: 0,
            }))
          : [];
      if ([4, 6, 7].includes(region)) {
        r.enemies[0].bossId = `${region}-1`;
        r.encounterObjects = (region === 7 ? ['smoke', 'tether'] : ['mine', 'tether']).map(
          (kind, id) => ({
            id: id + 1,
            owner: r.enemies[0].id,
            kind,
            x: 620 + id * 520,
            y: 500,
            radius: 130,
            warning: 0,
            life: 10,
            pulse: 1,
            hp: 0,
            maxHp: 0,
            aim: 0,
          }),
        );
      }
      r.formations =
        region === 9
          ? [{ x: 850, y: 700, life: 5, pulse: 1, damage: 1, kind: 'earth', pulses: 1 }]
          : [];
      r.projectiles = [];
      scene.draw(r);
      store.notify();
      const pool = scene.paintedZones.pool;
      const images = pool
        .filter((i: any) => i.visible)
        .map((i: any) => ({
          texture: i.texture.key,
          frame: i.frame.name,
          x: i.x,
          y: i.y,
          width: i.displayWidth,
          height: i.displayHeight,
          depth: i.depth,
          alpha: i.alpha,
        }));
      // Repeated drawing and expiry must reuse the pool without ghost areas.
      for (let n = 0; n < 120; n++) scene.draw(r);
      const allocated = pool.length;
      const savedZones = r.zones;
      const savedObjects = r.encounterObjects;
      const savedFormations = r.formations;
      r.zones = [];
      r.encounterObjects = [];
      r.formations = [];
      scene.draw(r);
      const ghosts = pool.filter((i: any) => i.visible).length;
      r.zones = savedZones;
      r.encounterObjects = savedObjects;
      r.formations = savedFormations;
      scene.draw(r);
      return { images, allocated, ghosts };
    }, region);
    expect(result.images.length).toBeGreaterThanOrEqual(2);
    expect(result.allocated).toBe(result.images.length);
    expect(result.ghosts).toBe(0);
    for (const image of result.images) {
      expect(['painted-zones', 'boss-fields']).toContain(image.texture);
      expect(image.width).toBeGreaterThan(100);
      expect(image.depth).toBeLessThan(0);
      expect(image.alpha).toBeGreaterThan(0);
    }
    if (region === 3)
      expect(result.images.map((i: { frame: string }) => i.frame)).toEqual(['warm', 'cold']);
    if (region === 8)
      expect(result.images.map((i: { frame: string }) => i.frame)).toEqual([
        'blood',
        'smoke',
        'gate',
        'safe',
      ]);
    if (region === 4)
      expect(result.images.map((i: { frame: string }) => i.frame)).toEqual(['brew', 'chain']);
    if (region === 6)
      expect(result.images.map((i: { frame: string }) => i.frame)).toEqual(['fire', 'chain']);
    if (region === 7)
      expect(result.images.map((i: { frame: string }) => i.frame)).toEqual(['sand', 'chain']);
    await page.screenshot({ path: `${proof}/region-${region}.png` });
    await writeFile(`${proof}/region-${region}.json`, JSON.stringify(result, null, 2));
    expect(errors).toEqual([]);
  });
