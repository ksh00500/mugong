import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion } from './support/region';
test.skip(process.env.MUGONG_PRODUCTION_VERIFY !== '1', 'Explicit local production verification only.');
const proof = 'docs/verification/boss-pressure-v1/production';
for (const [width, height] of [[1440, 900], [1366, 768], [1093, 614]])
  test(`production pursuit and save ${width}x${height}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, 4);
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => { const q = indexedDB.open('mugong-local-v1', 1); q.onsuccess = () => resolve(q.result); });
      const state: any = await new Promise((resolve) => { const q = db.transaction('saves').objectStore('saves').get('current'); q.onsuccess = () => resolve(q.result); });
      const e = state.run.enemies[3];
      Object.assign(e, { state: 'approach', timer: 0, x: 400, y: 520, pressure: undefined, move: undefined, strike: undefined, pattern: 0 });
      state.run.enemies = [e]; state.run.zoneClock = 0;
      await new Promise<void>((resolve) => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put(state, 'current'); tx.oncomplete = () => resolve(); });
      db.close();
    });
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
    await expect(page.locator('script[src^="/assets/main-"]')).toHaveCount(1);
    await page.mouse.move(width * 0.35, height * 0.5);
    await page.mouse.down(); await page.keyboard.down('d');
    await page.waitForTimeout(4000);
    await page.keyboard.up('d'); await page.mouse.up();
    await mkdir(proof, { recursive: true });
    await page.screenshot({ path: `${proof}/combat-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: '여정을 잠시 멈추다' })).toBeVisible();
    await page.waitForTimeout(350);
    const result = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => { const q = indexedDB.open('mugong-local-v1', 1); q.onsuccess = () => resolve(q.result); });
      const state: any = await new Promise((resolve) => { const q = db.transaction('saves').objectStore('saves').get('current'); q.onsuccess = () => resolve(q.result); });
      db.close();
      return { pressure: state.run.enemies[0].pressure, hp: state.run.fighter.hp, x: state.run.fighter.x, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    await writeFile(`${proof}/${width}.json`, JSON.stringify({ width, height, ...result, errors }, null, 2));
    expect(result.pressure?.cooldown).toBeGreaterThan(0);
    expect(result.pressure?.cooldown).toBeLessThanOrEqual(5);
    expect(result.x).toBeGreaterThan(960);
    expect(result.overflow).toBe(false);
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
    expect(errors).toEqual([]);
    await writeFile(`${proof}/${width}.json`, JSON.stringify({ width, height, ...result, errors }, null, 2));
  });
