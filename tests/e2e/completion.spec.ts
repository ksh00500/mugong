import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { REGIONS } from '../../src/domain/campaign';
import { makeLootItem } from '../../src/domain/items';
import { restEvent, ALL_REST_EVENT_KINDS } from '../../src/domain/rest-event';
import type { GameState } from '../../src/domain/model';
import { isGameSave } from '../../src/platform/save-validation';
import { observeScene } from './support/region';
import { messages } from '../../src/platform/messages';
const mode = process.env.MUGONG_COMPLETION_MODE ?? 'source',
  proof = `docs/verification/remaining-gameplay-v1/${mode}`;
function fixture(wave = 4, seed = 123) {
  const s = emptyGame();
  startRun(s, '이어지는 강호', seed);
  const r = s.run!;
  r.regionRoute = REGIONS.slice(0, 4).map((r) => r.name);
  r.wave = wave;
  spawnWave(r);
  r.offers = [];
  r.gold = 100;
  r.fighter.hp = 50;
  r.fighter.items.push({ ...makeLootItem('material-0', 'npc-material', 'ground'), count: 6 });
  return s;
}
async function seed(page: Page, state: GameState, locale = 'ko') {
  expect(isGameSave(state)).toBe(true);
  await mkdir(proof, { recursive: true });
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
  await expect(page.locator('.home-scene')).toBeVisible({ timeout: 45000 });
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
async function fits(e: Locator, page: Page) {
  const b = await e.boundingBox(),
    v = page.viewportSize()!;
  expect(b).not.toBeNull();
  expect(b!.x).toBeGreaterThanOrEqual(0);
  expect(b!.y).toBeGreaterThanOrEqual(0);
  expect(b!.x + b!.width).toBeLessThanOrEqual(v.width + 1);
  expect(b!.y + b!.height).toBeLessThanOrEqual(v.height + 1);
}
async function ready(page: Page) {
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
}
async function approach(page: Page, id: string) {
  const m = page.locator(`[data-stop="${id}"]`);
  await m.click();
  await expect(m).toHaveAttribute('data-near', 'true', { timeout: 12000 });
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toBeVisible();
}
for (const [width, height, locale] of [
  [1440, 900, 'ko'],
  [1366, 768, 'ko'],
  [1093, 614, 'ko'],
  [1093, 614, 'en'],
  [1093, 614, 'ja'],
  [1093, 614, 'zh-CN'],
  [1093, 614, 'zh-TW'],
] as const)
  test(`actual fatal hit, claim, reload and history ${width} ${locale}`, async ({ page }) => {
    const translated = (key: string) =>
      locale === 'ko'
        ? key
        : (messages[key]?.[{ en: 0, ja: 1, 'zh-CN': 2, 'zh-TW': 3 }[locale]] ?? key);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const s = fixture(1),
      r = s.run!,
      f = r.fighter;
    f.hp = 2;
    f.invulnerable = 0;
    r.enemies.forEach((e) => {
      e.x = 1500;
      e.y = 700;
      e.state = 'recover';
      e.timer = 10;
    });
    r.projectiles = [
      {
        x: f.x,
        y: f.y - 32,
        vx: 0,
        vy: 0,
        radius: 40,
        life: 1,
        damage: 100,
        friendly: false,
        hits: [],
        owner: r.enemies[0].id,
      },
    ];
    await seed(page, s, locale);
    const death = page.getByRole('dialog', { name: translated('강호에 남긴 이름'), exact: true });
    await expect(death).toBeVisible({ timeout: 45000 });
    await expect(death.locator('.combat-fatal')).toContainText(translated('적의 투사체'));
    const back = death.getByRole('button', { name: translated('세가로 돌아가기'), exact: true });
    await fits(back, page);
    await expect
      .poll(async () => (await saved(page)).run?.combatReport?.fatal?.source.kind)
      .toBe('projectile');
    await page.screenshot({ path: `${proof}/death-${width}-${locale}.png` });
    await back.click();
    await expect(page.locator('.home-scene')).toBeVisible();
    await expect
      .poll(async () => (await saved(page)).family.journeys?.[0].combatReport?.fatal?.hpAfter)
      .toBe(0);
    await page.reload();
    await expect(page.locator('.home-scene')).toBeVisible();
    await page.getByRole('button', { name: translated('기록'), exact: true }).click();
    await page.locator('.journey-history > details > summary').first().click();
    await expect(page.locator('.journey-history .combat-fatal')).toContainText(
      translated('적의 투사체'),
    );
    await page.locator('.journey-history .combat-review summary').last().click();
    await page.locator('.journey-records .home-records').hover();
    await page.mouse.wheel(0, 600);
    await fits(
      page.getByRole('dialog').getByRole('button', {
        name: translated('{0} 닫기').replace('{0}', translated('세가의 기록')),
        exact: true,
      }),
      page,
    );
    await page.screenshot({ path: `${proof}/history-${width}-${locale}.png` });
    expect(errors).toEqual([]);
  });
for (const kind of ALL_REST_EVENT_KINDS)
  test(`revision 2 ${kind} exact transaction and persisted choice`, async ({ page }) => {
    let s = fixture(14);
    for (let n = 1; restEvent(s.run!).kind !== kind; n++) s = fixture(14, n);
    const r = s.run!,
      offer = restEvent(r);
    r.fighter.hp = 120;
    if (offer.itemCost)
      r.fighter.items.push({
        ...makeLootItem(offer.itemCost.templateId, 'event-payment', 'ground'),
        count: offer.itemCost.count,
      });
    await page.setViewportSize({ width: 1093, height: 614 });
    await seed(page, s);
    await ready(page);
    await approach(page, 'fortune');
    const event = page.locator('.rest-event');
    await expect(event).toHaveAttribute('data-event-kind', kind);
    const accept = event.getByRole('button', { name: '거래하기', exact: true });
    await fits(accept, page);
    await accept.click();
    await expect.poll(async () => (await saved(page)).run!.restEvents?.[0].kind).toBe(kind);
    const after = (await saved(page)).run!;
    expect(after.fighter.hp).toBe(120 - offer.hpCost);
    expect(after.gold).toBe(100 - offer.goldCost);
    expect(after.fighter.items.at(-1)).toMatchObject({
      templateId: offer.templateId,
      count: offer.count,
      place: 'ground',
    });
    await page.screenshot({ path: `${proof}/event-${kind}.png` });
    await page.reload();
    await ready(page);
    await approach(page, 'fortune');
    await expect(page.locator('.rest-event-actions')).toHaveCount(0);
    expect((await saved(page)).run!.restEvents).toEqual(after.restEvents);
  });
for (const [npc, reduced] of [
  ['physician', false],
  ['merchant', false],
  ['blacksmith', false],
  ['physician', true],
] as const)
  test(`saved ${npc} service plays authored work with fixed feet ${reduced ? 'reduced' : 'normal'}`, async ({
    page,
  }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1093, height: 614 });
    await seed(page, fixture());
    await ready(page);
    const root = page.locator('.game-canvas');
    await expect(root).toHaveAttribute(`data-rest-work-${npc}`, 'ready', { timeout: 30000 });
    if (mode === 'source') await observeScene(page);
    await approach(page, npc);
    if (npc === 'physician')
      await page.getByRole('button', { name: '의원 · 회복 12전', exact: true }).click();
    else if (npc === 'merchant') await page.locator('.market-purchase button').click();
    else await page.getByRole('button', { name: '강화 · 12전 + 재료 2', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(root).toHaveAttribute('data-rest-working', npc);
    const frames: string[] = [],
      scales: number[] = [];
    if (mode === 'source')
      for (let n = 0; n < 14; n++) {
        const pose = await page.evaluate((npc) => {
          const s = (window as any).regionScene,
            w = s.waystation.workers.get(npc);
          return w.visible ? { frame: w.frame.name, scale: w.scaleX, x: w.x, y: w.y } : null;
        }, npc);
        if (pose) {
          frames.push(pose.frame);
          scales.push(pose.scale);
        }
        if (n === 5)
          await page.screenshot({ path: `${proof}/work-${npc}${reduced ? '-reduced' : ''}.png` });
        await page.waitForTimeout(90);
      }
    else await page.screenshot({ path: `${proof}/work-${npc}${reduced ? '-reduced' : ''}.png` });
    if (mode === 'source') {
      expect(new Set(frames)).toEqual(new Set(reduced ? ['2'] : ['0', '1', '2', '3']));
      expect(new Set(scales).size).toBe(1);
      await writeFile(
        `${proof}/work-${npc}${reduced ? '-reduced' : ''}.json`,
        JSON.stringify({ frames, scales }, null, 2),
      );
    }
    await expect(root).toHaveAttribute('data-rest-working', '', { timeout: 4000 });
  });
if (mode === 'source')
  test('regional metadata failures are visible and a retry preserves the journey', async ({
    page,
  }) => {
    let failed = false;
    await page.route('**/src/game/boss-special-regions/region-0.json*', (route) => {
      failed = true;
      return route.abort();
    });
    await seed(page, fixture(1));
    await expect(page.getByRole('button', { name: '다시 시도', exact: false })).toBeVisible({
      timeout: 45000,
    });
    expect(failed).toBe(true);
    await page.unroute('**/src/game/boss-special-regions/region-0.json*');
    await page.getByRole('button', { name: '다시 시도', exact: false }).click();
    await ready(page);
    expect((await saved(page)).run!.id).toBe(fixture(1).run!.id);
  });

if (mode !== 'source')
  for (let region = 0; region < 10; region++)
    test(`compiled region ${region} loads only its own reviewed metadata`, async ({ page }) => {
      const s = fixture(5),
        r = s.run!;
      r.regionRoute = [
        REGIONS[region].name,
        ...REGIONS.filter((_, n) => n !== region)
          .slice(0, 3)
          .map((r) => r.name),
      ];
      spawnWave(r);
      r.offers = [];
      r.fighter.invulnerable = 100;
      await page.setViewportSize({ width: 1093, height: 614 });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await seed(page, s);
      await ready(page);
      await expect(page.locator('.game-canvas')).toHaveAttribute('data-art-region', String(region));
      const loaded = await page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .map((e) => new URL(e.name).pathname)
          .filter((path) => path.endsWith('.js')),
      );
      const family = loaded.filter((path) => /-family-frames-/.test(path)),
        boss = loaded.filter((path) => /\/region-\d+-[^/]+\.js$/.test(path));
      expect(family).toHaveLength(1);
      expect(boss).toHaveLength(1);
      expect(boss[0]).toContain(`/region-${region}-`);
      expect(errors).toEqual([]);
      await page.screenshot({ path: `${proof}/region-${region}.png` });
      await writeFile(
        `${proof}/region-${region}.json`,
        JSON.stringify({ region, family, boss, errors }, null, 2),
      );
    });
