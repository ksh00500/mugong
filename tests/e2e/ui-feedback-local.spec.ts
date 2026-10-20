import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { seedRegion } from './support/region';

const proof = 'docs/verification/ui-feedback-v1/compiled';
test('컴파일 HTML·JS·CSS HTTP 일치', async ({ request }) => {
  await mkdir(proof, { recursive: true });
  const response = await request.get('/'),
    html = await response.text();
  expect(response.status()).toBe(200);
  expect(html).toBe(await readFile('dist-ui-feedback-v1/index.html', 'utf8'));
  const records = [];
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)) {
    const url = match[1],
      res = await request.get(url);
    expect(res.status()).toBe(200);
    const sha = createHash('sha256')
      .update(await res.body())
      .digest('hex');
    expect(sha).toBe(
      createHash('sha256')
        .update(await readFile('dist-ui-feedback-v1' + url))
        .digest('hex'),
    );
    records.push({ url, sha256: sha });
  }
  await writeFile(`${proof}/http.json`, JSON.stringify(records, null, 2));
});

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`컴파일 게임 입력·가방·흔들림 설정 ${width}×${height}`, async ({ page }) => {
    test.setTimeout(90000);
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [],
      failed: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400 && /\/(art|assets|fonts)\//.test(r.url())) failed.push(r.url());
    });
    await seedRegion(page, 0);
    await expect(page.locator('script[src^="/assets/main-"]')).toHaveCount(1);
    await expect(page.locator('.player-panel .meter.health .meter-fill')).toHaveCSS(
      'transform',
      /matrix\(1,/,
    );
    await page.keyboard.down('d');
    // Record a real movement input in the compiled game, without a dev-module hook.
    await page.waitForTimeout(180);
    await page.keyboard.up('d');
    const box = (await page.locator('.game-canvas canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
    await page.keyboard.press('Tab');
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '가방 Tab', exact: true })).toBeFocused();
    await page.screenshot({ path: `${proof}/combat-${width}.png`, animations: 'disabled' });
    await page.getByRole('button', { name: '일시 정지', exact: true }).click();
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByLabel('화면 흔들림', { exact: true }).selectOption('standard');
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('mugong-feedback-v1')!).shake),
    ).toBe('standard');
    await page.screenshot({ path: `${proof}/settings-${width}.png`, animations: 'disabled' });
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
    await writeFile(
      `${proof}/game-${width}.json`,
      JSON.stringify(
        {
          width,
          height,
          compiled: true,
          movementAndAttackInput: true,
          bagOpenClose: true,
          settingSaved: true,
          errors,
          failed,
          independentContext: true,
        },
        null,
        2,
      ),
    );
  });
}
