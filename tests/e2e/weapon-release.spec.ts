import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { emptyGame, startRun } from '../../src/domain/game';
import { ART_WEAPONS } from '../../src/domain/content';
import { makeLootItem } from '../../src/domain/items';
import type { ArtId, BoundFighter, WeaponStyle } from '../../src/domain/model';
import { isGameSave } from '../../src/platform/save-validation';

const proof =
  process.env.MUGONG_RELEASE_PROOF ?? 'docs/verification/daytona-20261004-weapon-boss-v1/public';
test.beforeEach(async () => {
  test.skip(!process.env.MUGONG_DAYTONA_URL, '공개 배포 검사 전용');
  await mkdir(proof, { recursive: true });
});

test('공개 파일이 검증한 최신 빌드와 동일하다', async ({ request }) => {
  const release = JSON.parse(await readFile(`${proof}/../release.json`, 'utf8'));
  const results = [];
  for (const file of release.changedFiles as string[]) {
    const response = await request.get(`/${file}`);
    expect(response.status(), file).toBe(200);
    const actual = createHash('sha256')
      .update(await response.body())
      .digest('hex');
    const expected = createHash('sha256')
      .update(await readFile(`dist/${file}`))
      .digest('hex');
    expect(actual, file).toBe(expected);
    results.push({ file, sha256: actual, status: response.status() });
  }
  await writeFile(`${proof}/files.json`, JSON.stringify(results, null, 2));
});

for (const [appearance, style] of [
  [9, 'dart'],
  [7, 'gauntlet'],
  [3, 'sword'],
] as const) {
  test(`공개 외형 ${appearance} ${style} 공격·방어·저장 재개`, async ({ page }) => {
    const errors: string[] = [],
      failedAssets: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400 && /\/(assets|art|fonts)\//.test(response.url()))
        failedAssets.push(`${response.status()} ${response.url()}`);
    });
    const state = emptyGame();
    startRun(state, '무기 배포 검증', 123);
    const run = state.run!,
      f = run.fighter as BoundFighter;
    const art = (Object.keys(ART_WEAPONS) as ArtId[]).find(
      (id) => ART_WEAPONS[id] === (style as WeaponStyle),
    )!;
    const item = makeLootItem(`weapon-${style}-0`, `release-${style}`, 'weapon');
    f.appearance = appearance;
    f.items = [item];
    f.arts = [{ id: art, level: 5, gauge: 100, combo: 0, defenseCd: 0 }];
    f.bindings = { [art]: item.id };
    f.active = 0;
    f.x = 960;
    f.y = 520;
    run.offers = [];
    run.enemies.forEach((enemy) => {
      enemy.x = 1450;
      enemy.y = 400;
      enemy.hp = enemy.maxHp = 100000;
      enemy.state = 'windup';
      enemy.timer = 1000;
    });
    expect(isGameSave(state)).toBe(true);
    await page.goto('/');
    await expect(page.locator('.home-scene')).toBeVisible();
    await page.evaluate(async (value) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('mugong-local-v1', 1);
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put(value, 'current');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, state);
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
    await page.keyboard.down('d');
    await page.waitForTimeout(180);
    await page.keyboard.up('d');
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width * 0.72, canvas.y + canvas.height * 0.52);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${proof}/appearance-${appearance}-${style}-attack.png` });
    await page.mouse.up();
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(100);
    await page.mouse.up({ button: 'right' });
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('dialog', { name: '가방 · 정보 확인' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '일시 정지' }).click();
    await page.getByRole('button', { name: '저장하고 일시 종료' }).click();
    await expect(page.locator('.home-run-card')).toContainText('무기 배포 검증');
    await page.getByRole('button', { name: '강호 이어하기 1 / 20 →' }).click();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
    const resources = await page.evaluate(() =>
      performance.getEntriesByType('resource').map((r) => new URL(r.name).pathname),
    );
    expect(resources).toContain('/art/held-darts-v1.webp');
    expect(resources).toContain('/art/held-gauntlets-v1.webp');
    expect(resources).toContain(`/art/hero-roster-v1/actions-${Math.floor(appearance / 5)}.webp`);
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
    await writeFile(
      `${proof}/appearance-${appearance}-${style}.json`,
      JSON.stringify(
        {
          appearance,
          style,
          resources,
          errors,
          failedAssets,
          storage: 'isolated Playwright context',
        },
        null,
        2,
      ),
    );
  });
}
