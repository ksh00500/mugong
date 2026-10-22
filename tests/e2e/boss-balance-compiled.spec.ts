import { test, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { seedLoadingRun } from './support/loading';
const proof = 'docs/verification/boss-balance-v1/compiled';
test('빌드 HTML·JS·CSS HTTP SHA 확인', async ({ request }) => {
  await mkdir(proof, { recursive: true });
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toBe(await readFile('dist-boss-balance-v1/index.html', 'utf8'));
  const rows = [];
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)) {
    const r = await request.get(m[1]);
    expect(r.status()).toBe(200);
    const hash = createHash('sha256')
      .update(await r.body())
      .digest('hex');
    expect(hash).toBe(
      createHash('sha256')
        .update(await readFile('dist-boss-balance-v1' + m[1]))
        .digest('hex'),
    );
    rows.push({ url: m[1], sha256: hash });
  }
  await writeFile(`${proof}/http.json`, JSON.stringify(rows, null, 2));
});
for (const [region, width, height] of [
  [4, 1093, 614],
  [0, 1366, 768],
  [9, 1440, 900],
])
  test(`컴파일 실제 큰 기술→반격→재개·가방 R${region}`, async ({ page }) => {
    test.setTimeout(60000);
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const state = await seedLoadingRun(page, region, 5);
    const r = state.run!,
      e = r.enemies.find((e) => e.bossId)!;
    e.x = 960;
    e.y = 530;
    e.state = 'windup';
    e.move = region === 9 ? 'combo' : 'slam';
    e.timer = 0.4;
    e.aim = 0;
    e.targetX = 1250;
    e.targetY = 530;
    r.fighter.x = 1250;
    r.fighter.y = 530;
    r.enemies = [e];
    r.zones = [];
    r.encounterObjects = [];
    await page.evaluate(async (state) => {
      const db = await new Promise<IDBDatabase>((ok) => {
        const q = indexedDB.open('mugong-local-v1', 1);
        q.onsuccess = () => ok(q.result);
      });
      await new Promise<void>((ok) => {
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put(state, 'current');
        tx.oncomplete = () => ok();
      });
      db.close();
    }, state);
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 30000,
    });
    await expect(page.locator('.boss-panel')).toHaveAttribute('data-boss-opening', 'true', {
      timeout: 8000,
    });
    await expect(page.locator('.boss-phase')).toContainText('반격 기회');
    await page.screenshot({ path: `${proof}/R${region}.png` });
    await expect(page.locator('.boss-panel')).toHaveAttribute('data-boss-opening', 'false', {
      timeout: 8000,
    });
    await page.keyboard.press('Tab');
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.inventory-workspace')).toHaveCount(0);
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/R${region}.json`,
      JSON.stringify(
        {
          region,
          width,
          height,
          realClockOpening: true,
          openingEnds: true,
          bagReturned: true,
          errors,
          independentContext: true,
        },
        null,
        2,
      ),
    );
  });
