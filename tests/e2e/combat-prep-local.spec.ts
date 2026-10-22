import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { makeLootItem } from '../../src/domain/items';
import { xpThreshold } from '../../src/domain/content';
import type { BoundFighter } from '../../src/domain/model';

const proof = process.env.MUGONG_COMPILED_PROOF ?? 'docs/verification/combat-prep-v1/compiled';
const output = process.env.MUGONG_COMPILED_DIR ?? 'dist-combat-prep-v1';
async function saved(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    const value = await new Promise<any>((resolve) => {
      const q = db.transaction('saves').objectStore('saves').get('current');
      q.onsuccess = () => resolve(q.result);
    });
    db.close();
    return value;
  });
}
test('컴파일 HTML·JS·CSS HTTP SHA', async ({ request }) => {
  await mkdir(proof, { recursive: true });
  const res = await request.get('/'),
    html = await res.text();
  expect(res.status()).toBe(200);
  expect(html).toBe(await readFile(`${output}/index.html`, 'utf8'));
  const records = [];
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)) {
    const url = match[1],
      response = await request.get(url);
    expect(response.status()).toBe(200);
    const sha = createHash('sha256')
      .update(await response.body())
      .digest('hex');
    expect(sha).toBe(
      createHash('sha256')
        .update(await readFile(output + url))
        .digest('hex'),
    );
    records.push({ url, sha256: sha });
  }
  await writeFile(`${proof}/http.json`, JSON.stringify(records, null, 2));
});
for (const [width, height, wave] of [
  [1440, 900, 4],
  [1366, 768, 9],
  [1093, 614, 19],
])
  test(`컴파일 정비·저장·보스·실제 입력 ${width}×${height}`, async ({ page }) => {
    test.setTimeout(90000);
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [],
      failed: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400 && /\/(art|assets|fonts)\//.test(r.url())) failed.push(r.url());
    });
    const state = emptyGame();
    startRun(state, '정비 검증', 123);
    const r = state.run!,
      f = r.fighter as BoundFighter;
    r.wave = wave;
    r.offers = [];
    spawnWave(r);
    r.gold = 100;
    f.level = f.spent = r.spent = 16;
    f.xp = xpThreshold(16);
    f.augmentOffers = [];
    f.augments = ['swift'];
    f.growth = { constitution: 1, strength: 1, agility: 1, inner: 1 };
    f.growthStartLevel = 0;
    f.hp = 150;
    f.arts = [{ id: 'huashan', level: 2, gauge: 0, combo: 0, defenseCd: 0 }];
    f.bindings = { huashan: f.items[0].id };
    f.active = 0;
    f.items.push({ ...makeLootItem('material-0', 'compiled-material', 'general'), count: 2 });
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
    await expect(page.locator('.prep-stop')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: '의원 · 회복 12전', exact: true }).click();
    await expect.poll(async () => (await saved(page)).run.fighter.hp).toBe(195);
    await page.getByRole('button', { name: '강화 · 12전 + 재료 2', exact: true }).click();
    await expect.poll(async () => (await saved(page)).run.fighter.items[0].upgrades).toBe(1);
    await page.reload();
    await expect(page.locator('.prep-stop')).toBeVisible({ timeout: 30000 });
    expect((await saved(page)).run.gold).toBe(76);
    await page.screenshot({ path: `${proof}/prep-${width}.png` });
    await page.getByRole('button', { name: `다음 ${wave + 1}웨이브 →`, exact: true }).click();
    await expect(page.locator('.wuxia-hud')).toHaveAttribute('data-phase', 'combat');
    const next = await saved(page);
    expect(next.run.wave).toBe(wave + 1);
    expect(next.run.enemies[0].maxHp).toBe([900, 1500, 2200, 3000][Math.floor(wave / 5)]);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
    await page.keyboard.down('d');
    await page.waitForTimeout(200);
    await page.keyboard.up('d');
    const box = (await page.locator('.game-canvas canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.5);
    await page.keyboard.press('Tab');
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await expect.poll(async () => (await saved(page)).run.fighter.x).toBeGreaterThan(f.x);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '가방 Tab', exact: true })).toBeFocused();
    await page.screenshot({ path: `${proof}/combat-${width}.png` });
    expect(await page.locator('script[src^="/assets/main-"]').count()).toBe(1);
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
    await writeFile(
      `${proof}/game-${width}.json`,
      JSON.stringify(
        {
          width,
          height,
          wave,
          compiled: true,
          servicesSaved: true,
          bossHp: next.run.enemies[0].maxHp,
          movement: true,
          attackInput: true,
          bagFocus: true,
          errors,
          failed,
        },
        null,
        2,
      ),
    );
  });
