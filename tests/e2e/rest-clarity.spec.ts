import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { REGIONS } from '../../src/domain/campaign';
import { makeLootItem } from '../../src/domain/items';
import { restEvent, type RestEventKind } from '../../src/domain/rest-event';
import { waystationTheme } from '../../src/domain/waystation';
import type { GameState } from '../../src/domain/model';
import { isGameSave } from '../../src/platform/save-validation';
import { observeScene } from './support/region';
const mode = process.env.MUGONG_REST_CLARITY_MODE ?? 'source',
  proof = `docs/verification/rest-clarity-v1/${mode}`;
async function fits(e: Locator, page: Page) {
  const b = (await e.boundingBox())!,
    v = page.viewportSize()!;
  expect(b).not.toBeNull();
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(v.width + 1);
  expect(b.y + b.height).toBeLessThanOrEqual(v.height + 1);
  expect(await e.evaluate((e) => e.scrollWidth <= e.clientWidth + 2)).toBe(true);
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    return new Promise<GameState>((resolve) => {
      const q = db.transaction('saves').objectStore('saves').get('current');
      q.onsuccess = () => {
        resolve(q.result);
        db.close();
      };
    });
  });
}
function stateFor(wave: number, region: number, seed = 123) {
  const s = emptyGame();
  startRun(s, '기연·쉼터 검사', seed);
  const r = s.run!;
  delete r.restEventRevision; // Exercise the saved revision-1 encounters unchanged.
  r.regionRoute = REGIONS.filter((_, n) => n !== region)
    .slice(0, 4)
    .map((x) => x.name);
  r.regionRoute[Math.floor((wave - 1) / 5)] = REGIONS[region].name;
  r.wave = wave;
  spawnWave(r);
  r.offers = [];
  r.gold = 150;
  r.fighter.hp = 60;
  r.fighter.items.push({
    ...makeLootItem('material-0', 'rest-test-material', 'general'),
    x: 1,
    y: 0,
    count: 4,
  });
  return s;
}
async function seed(page: Page, state: GameState, locale = 'ko') {
  await mkdir(proof, { recursive: true });
  expect(isGameSave(state)).toBe(true);
  await page.addInitScript((locale) => {
    localStorage.setItem('mugong-language-v1', locale);
    (window as any).regionModule = (name: string) =>
      import(
        performance
          .getEntriesByType('resource')
          .map((x) => x.name)
          .find((url) => new URL(url).pathname === name) ?? name
      );
  }, locale);
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible({ timeout: 30000 });
  await page.evaluate(async (state) => {
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
  }, state);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
}
async function approach(page: Page, id: string) {
  const marker = page.locator(`[data-stop="${id}"]`);
  await marker.click();
  await expect(marker).toHaveAttribute('data-near', 'true', { timeout: 12000 });
  await page.keyboard.press('e');
  await expect(page.locator('.waystation-dialog,.rest-market')).toBeVisible();
}

for (const [wave, region, width, height] of [
  [4, 0, 1440, 900],
  [9, 3, 1366, 768],
  [14, 5, 1093, 614],
  [19, 9, 1093, 614],
])
  test(`rest ${wave}: real services, encounter, reload and boss departure`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const state = stateFor(wave, region),
      offer = restEvent(state.run!);
    await seed(page, state);
    const world = page.locator('.waystation-world');
    await expect(world).toHaveAttribute('data-region-theme', String(region));
    await expect(world).toHaveAttribute('data-rest-wave', String(wave));
    await expect(world).toContainText(waystationTheme(state.run!).name);
    for (const marker of await page.locator('.waystation-marker').all()) await fits(marker, page);
    await page.screenshot({ path: `${proof}/world-${wave}.png` });
    await approach(page, 'physician');
    const price = [12, 16, 20, 24][Math.floor((wave - 1) / 5)];
    const heal = page.getByRole('button', { name: `의원 · 회복 ${price}전`, exact: true });
    await fits(heal, page);
    await heal.click();
    await expect.poll(async () => (await saved(page)).run!.fighter.hp).toBe(105);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-stop="physician"]')).toBeFocused();
    await approach(page, 'merchant');
    await page.locator('.market-purchase button').click();
    await expect.poll(async () => (await saved(page)).run!.supplies![0].stock).toBe(2);
    await page.keyboard.press('Escape');
    await approach(page, 'blacksmith');
    await page.getByRole('button', { name: '강화 · 12전 + 재료 2', exact: true }).click();
    await expect.poll(async () => (await saved(page)).run!.fighter.items[0].upgrades).toBe(1);
    await page.keyboard.press('Escape');
    await approach(page, 'fortune');
    const event = page.locator('.rest-event');
    await expect(event).toHaveAttribute('data-event-kind', offer.kind);
    await fits(event.locator('button.primary'), page);
    const before = (await saved(page)).run!;
    await event.getByRole('button', { name: '거래하기', exact: true }).click();
    await expect.poll(async () => (await saved(page)).run!.restEvents?.length).toBe(1);
    const after = (await saved(page)).run!;
    expect(after.gold).toBe(before.gold - offer.goldCost);
    expect(after.fighter.hp).toBe(before.fighter.hp - offer.hpCost);
    expect(after.fighter.items.at(-1)).toMatchObject({
      templateId: offer.templateId,
      count: offer.count,
      place: 'ground',
    });
    await expect(event.locator('[role="status"]')).toBeFocused();
    await page.screenshot({ path: `${proof}/event-${wave}.png` });
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-stop="fortune"]')).toBeFocused();
    await page.reload();
    await expect(world).toBeVisible({ timeout: 45000 });
    await approach(page, 'fortune');
    await expect(page.locator('.rest-event-actions')).toHaveCount(0);
    expect((await saved(page)).run!.restEvents).toEqual(after.restEvents);
    await page.keyboard.press('Escape');
    await approach(page, 'exit');
    const next = page.getByRole('button', { name: `다음 ${wave + 1}웨이브 →`, exact: true });
    await fits(next, page);
    await next.click();
    await expect(
      page.getByRole('button', { name: '남은 물품 두고 진행', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '남은 물품 두고 진행', exact: true }).click();
    await expect.poll(async () => (await saved(page)).run!.wave).toBe(wave + 1);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 45000,
    });
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/flow-${wave}.json`,
      JSON.stringify(
        {
          wave,
          region,
          width,
          height,
          event: offer.kind,
          hpCost: offer.hpCost,
          goldCost: offer.goldCost,
          record: after.restEvents,
          bossWave: wave + 1,
          errors,
        },
        null,
        2,
      ) + '\n',
    );
  });

for (const kind of ['herbalist', 'manuscript', 'salvage'] as RestEventKind[])
  test(`event ${kind}: insufficient funds and decline are persistent`, async ({ page }) => {
    test.setTimeout(90000);
    let state = stateFor(19, 2);
    for (let n = 1; restEvent(state.run!).kind !== kind; n++) state = stateFor(19, 2, n);
    const offer = restEvent(state.run!);
    state.run!.gold = 0;
    state.run!.fighter.hp = offer.hpCost || 60;
    await page.setViewportSize({ width: 1093, height: 614 });
    await seed(page, state);
    await approach(page, 'fortune');
    await expect(page.locator('.rest-event button.primary')).toBeDisabled();
    await page.getByRole('button', { name: '그냥 지나가기', exact: true }).click();
    await expect.poll(async () => (await saved(page)).run!.restEvents?.[0].choice).toBe('leave');
    await page.reload();
    await expect(page.locator('.waystation-world')).toBeVisible({ timeout: 45000 });
    await approach(page, 'fortune');
    await expect(page.locator('.rest-event-actions')).toHaveCount(0);
    expect((await saved(page)).run!.gold).toBe(0);
    expect((await saved(page)).run!.fighter.hp).toBe(state.run!.fighter.hp);
  });
for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'])
  test(`small rest dialogue in ${locale}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1093, height: 614 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page, stateFor(14, 7), locale);
    await approach(page, 'fortune');
    for (const button of await page.locator('.waystation-dialog button').all())
      await fits(button, page);
    await page.screenshot({ path: `${proof}/event-small-${locale}.png` });
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-stop="fortune"]')).toBeFocused();
  });

for (const webgl of [false, true])
  test(`crowded warnings, shot cues and safe field ${webgl ? 'WebGL' : 'Canvas'}`, async ({
    page,
  }) => {
    test.skip(mode !== 'source', 'Source-only render observation');
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1093, height: 614 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (webgl)
      await page.addInitScript(() => {
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          const get = proto.getExtension;
          proto.getExtension = function (name: string) {
            return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
          };
        }
      });
    const state = stateFor(1, 0);
    state.run!.fighter.invulnerable = 100;
    await seed(page, state);
    await observeScene(page);
    const result = await page.evaluate(async () => {
      const w = window as any,
        s = w.regionScene,
        store = (await w.regionModule('/src/platform/store.ts')).gameStore,
        r = store.state.run;
      s.scene.pause();
      store.paused = false;
      const origin = r.enemies[0];
      r.enemies = [
        {
          ...origin,
          role: 'guard',
          kind: 'spear',
          state: 'windup',
          timer: 0.2,
          x: 1040,
          y: 530,
          aim: Math.PI,
        },
        {
          ...origin,
          id: 9001,
          role: 'bowman',
          kind: 'archer',
          state: 'windup',
          timer: 0.2,
          x: 2100,
          y: 530,
          aim: Math.PI,
        },
      ];
      r.zones = [
        { id: 9, kind: 'poison', x: 850, y: 530, radius: 160, life: 5, warning: 0, pulse: 0 },
        { id: 10, kind: 'fire', x: 1030, y: 530, radius: 130, life: 5, warning: 1, pulse: 0 },
        { id: 0, kind: 'cold', x: 960, y: 700, radius: 80, life: 5, warning: 0, pulse: 0 },
      ];
      r.effects = Array.from({ length: 10 }, (_, n) => ({
        x: 900 + n * 12,
        y: 530,
        kind: 'burst',
        life: 0.5,
        duration: 0.5,
        radius: 160,
        color: 0xd38494,
        angle: 0,
      }));
      s.draw(r);
      store.notify();
      const dimmed = s.paintedEffects.pool.filter((p: any) => p.visible).map((p: any) => p.alpha);
      return {
        renderer: s.game.renderer.type,
        warningDepth: s.clarity.ink.depth,
        edgeDepth: s.clarity.edges.depth,
        hpDepth: s.graphics.depth,
        warningCommands: s.clarity.ink.commandBuffer.length,
        edgeCommands: s.clarity.edges.commandBuffer.length,
        dimmed,
      };
    });
    expect(result.renderer).toBe(webgl ? 2 : 1);
    expect(result.warningDepth).toBeGreaterThan(5003);
    expect(result.hpDepth).toBeGreaterThan(result.warningDepth);
    expect(result.warningCommands).toBeGreaterThan(0);
    expect(result.edgeCommands).toBeGreaterThan(0);
    expect(result.dimmed).toHaveLength(10);
    expect(result.dimmed.every((a: number) => a <= 0.55)).toBe(true);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-threat-cues', '1');
    await page.screenshot({ path: `${proof}/combat-${webgl ? 'webgl' : 'canvas'}.png` });
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/combat-${webgl ? 'webgl' : 'canvas'}.json`,
      JSON.stringify({ ...result, errors, syntheticScene: true }, null, 2) + '\n',
    );
  });
