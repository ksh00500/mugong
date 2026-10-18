import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { observeScene, seedRegion } from './support/region';
const proof = 'docs/verification/boss-mechanics-v1';
test('정화초 파괴·동결·출혈·장풍의 실제 텍스처가 프레임 정리 이후에도 남는다', async ({ page }) => {
  await mkdir(proof, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedRegion(page, 1);
  await observeScene(page);
  const result = await page.evaluate(async () => {
    const load = (window as any).regionModule;
    const { gameStore: store } = await load('/src/platform/store.ts');
    const { signatureCast, damageObject, stepEncounters } = await load(
      '/src/domain/boss-encounters.ts',
    );
    const r = store.state.run,
      f = r.fighter,
      e = r.enemies[3],
      scene = (window as any).regionScene;
    store.rendererReady = false;
    r.enemies = [e];
    r.zones = [];
    r.encounterObjects = [];
    r.effects = [];
    r.projectiles = [];
    Object.assign(e, { bossId: '1-4', x: 900, y: 350, hp: 500, maxHp: 1000, skillClock: 0 });
    Object.assign(f, { x: 960, y: 500, coldStacks: 2, freezeTime: 0.6, bleedTime: 2 });
    signatureCast(r, e);
    scene.draw(r);
    const herb = r.encounterObjects.find((o: any) => o.kind === 'herb');
    damageObject(r, herb, 999);
    stepEncounters(r, 0.01, () => {});
    r.projectiles = [
      {
        x: 1100,
        y: 500,
        vx: 320,
        vy: 0,
        life: 2,
        friendly: false,
        damage: 12,
        radius: 13,
        hits: [],
        visual: 'palm-wave',
      },
    ];
    scene.draw(r);
    store.notify();
    return scene.children.list
      .filter((c: any) => c.visible && ['boss-mechanics', 'boss-fields'].includes(c.texture?.key))
      .map((c: any) => ({ texture: c.texture.key, frame: c.frame.name }));
  });
  expect(result).toContainEqual({ texture: 'boss-mechanics', frame: '10' });
  expect(result).toContainEqual({ texture: 'boss-mechanics', frame: '11' });
  expect(result).toContainEqual({ texture: 'boss-fields', frame: '6' });
  expect(result).toContainEqual({ texture: 'boss-fields', frame: '7' });
  expect(errors).toEqual([]);
  await page.screenshot({ path: `${proof}/cleansing-status-palm.png` });
});
for (const [id, kind] of [
  ['5-4', 'bamboo'],
  ['5-3', 'falling-bamboo'],
  ['9-1', 'door'],
  ['9-3', 'rotating-door'],
  ['6-4', 'stone-door'],
  ['9-2', 'drone'],
  ['6-3', 'blade'],
  ['7-4', 'oasis'],
  ['7-3', 'sandwall'],
  ['4-3', 'bell'],
  ['8-4', 'exchange'],
  ['4-2', 'grab'],
  ['1-3', 'poison-mist'],
  ['9-4', 'formation'],
] as const)
  test(`실제 전투 로딩·전용 그림·저장 재개: ${kind}`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, Number(id.split('-')[0]));
    await observeScene(page);
    const result = await page.evaluate(
      async ({ id, kind }) => {
        const load = (window as any).regionModule;
        const { gameStore: store } = await load('/src/platform/store.ts');
        const { signatureCast, stepEncounters, damageObject } = await load(
          '/src/domain/boss-encounters.ts',
        );
        const { isGameSave } = await load('/src/platform/save-validation.ts');
        const r = store.state.run,
          f = r.fighter,
          e = r.enemies[3];
        store.rendererReady = false;
        r.enemies = [e];
        r.zones = [];
        r.encounterObjects = [];
        r.projectiles = [];
        r.effects = [];
        Object.assign(e, {
          bossId: id,
          x: 900,
          y: 420,
          hp: 500,
          maxHp: 1000,
          state: 'recover',
          timer: 100,
          pattern: id === '1-3' ? 2 : 0,
          skillClock: 0,
        });
        Object.assign(f, { x: 1000, y: 500, hp: 100, invulnerable: 0 });
        if (kind === 'grab') {
          f.x = 940;
          f.y = 420;
        }
        signatureCast(r, e);
        if (kind === 'drone') r.encounterObjects.find((o: any) => o.kind === 'turret').hp = 15;
        for (let n = 0; n < (kind === 'grab' ? 52 : kind === 'bell' ? 62 : 85); n++)
          stepEncounters(r, 1 / 60, (v: number) => (f.hp -= v));
        (window as any).regionScene.draw(r);
        store.notify();
        const objects = r.encounterObjects.map((o: any) => ({
          kind: o.kind,
          mechanic: o.mechanic,
          stage: o.stage,
          x: o.x,
          y: o.y,
        }));
        const images = (window as any).regionScene.children.list
          .filter(
            (c: any) => c.visible && ['boss-mechanics', 'boss-fields'].includes(c.texture?.key),
          )
          .map((c: any) => ({
            texture: c.texture.key,
            frame: c.frame.name,
            x: c.x,
            y: c.y,
            width: c.displayWidth,
            height: c.displayHeight,
          }));
        const copy = JSON.parse(JSON.stringify(store.state));
        const valid = isGameSave(copy);
        return {
          objects,
          images,
          valid,
          alpha: (window as any).regionScene.textures.get('boss-mechanics').source[0].image.src,
        };
      },
      { id, kind },
    );
    expect(result.objects.some((o: any) => o.mechanic === kind)).toBe(true);
    expect(result.valid).toBe(true);
    if (!['grab', 'exchange'].includes(kind)) expect(result.images.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `${proof}/${kind}.png` });
    await writeFile(`${proof}/${kind}.json`, JSON.stringify({ result, errors }, null, 2));
  });
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1093, height: 614 },
])
  test(`새 기믹 HUD와 가방 조작 영역: ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedRegion(page, 8);
    await observeScene(page);
    await expect(page.locator('.game-canvas')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    const buttons = page.getByRole('button', { name: '닫기', exact: false });
    await expect(buttons.first()).toBeVisible();
    await page.screenshot({ path: `${proof}/bag-${viewport.width}.png` });
  });
