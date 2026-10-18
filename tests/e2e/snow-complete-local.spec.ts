import { test, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { regionArtManifest } from '../../src/platform/region-art';
import { seedRegion } from './support/region';
const proof = 'docs/verification/snow-special-complete-v2';
test('compiled preview serves matching JavaScript and every installed special atlas', async ({
  request,
}) => {
  await mkdir(proof, { recursive: true });
  const res = await request.get('/'),
    html = await res.text();
  expect(res.status()).toBe(200);
  expect(html).toBe(await readFile('dist-snow-special-v2/index.html', 'utf8'));
  const art = JSON.parse(await readFile('src/game/snow-special-complete-frames.json', 'utf8'));
  const urls = [
    ...(Object.values(art.textures) as string[]),
    ...Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g), (m) => m[1]),
  ];
  const records = [];
  for (const url of urls) {
    const r = await request.get(url);
    expect(r.status(), url).toBe(200);
    const sha = createHash('sha256')
      .update(await r.body())
      .digest('hex');
    expect(sha, url).toBe(
      createHash('sha256')
        .update(await readFile('dist-snow-special-v2' + url))
        .digest('hex'),
    );
    records.push({ url, sha256: sha });
  }
  await writeFile(proof + '/served-files.json', JSON.stringify(records, null, 2) + '\n');
});
for (const [region, viewport] of [
  [3, { width: 1440, height: 900 }],
  [3, { width: 1366, height: 768 }],
  [3, { width: 1093, height: 614 }],
] as const) {
  test(`compiled region ${region} at ${viewport.width} loads all current art and accepts input`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [],
      failed: string[] = [],
      loaded = new Set<string>();
    const expected = Object.values(regionArtManifest(region));
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      const path = new URL(r.url()).pathname;
      if (r.status() >= 400 && /^\/(art|assets|fonts)\//.test(path)) failed.push(path);
      if (r.status() === 200 && expected.includes(path)) loaded.add(path);
    });
    await seedRegion(page, region);
    await expect(page.locator('script[src^="/assets/main-"]')).toHaveCount(1);
    await expect.poll(() => loaded.size).toBe(expected.length);
    await page.keyboard.down('d');
    await page.waitForTimeout(180);
    await page.keyboard.up('d');
    const box = (await page.locator('canvas').first().boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.5);
    await page.waitForTimeout(180);
    await page.getByRole('button', { name: '가방', exact: false }).first().click();
    await expect(page.getByRole('dialog', { name: '가방 · 정보 확인' })).toBeVisible();
    await page.getByRole('button', { name: '가방 · 정보 확인 닫기' }).click();
    await page.screenshot({ path: proof + `/local-region-${region}-${viewport.width}.png` });
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
    await writeFile(
      proof + `/local-region-${region}-${viewport.width}.json`,
      JSON.stringify(
        {
          region,
          viewport,
          expected: expected.length,
          loaded: loaded.size,
          compiled: true,
          combatInput: true,
          bagOpenClose: true,
          errors,
          failed,
          independentContext: true,
        },
        null,
        2,
      ) + '\n',
    );
  });
}
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1093, height: 614 },
])
  test(`review controls ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/art/snow-special-complete-v2/review.html');
    await expect(page.locator('canvas').first()).toHaveAttribute('width', '1000');
    await expect(page.locator('#play')).toHaveText('재생');
    for (let actor = 0; actor < 4; actor++) {
      await page.locator('#character').selectOption(String(actor));
      const moves = await page
        .locator('#move option')
        .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
      for (const move of moves) {
        await page.locator('#move').selectOption(move);
        await expect(page.locator('#move option:checked')).not.toHaveText('');
        for (let pose = 0; pose < 6; pose++) {
          await page.locator('#pose').selectOption(String(pose));
          await expect(page.locator('#phase')).not.toHaveText('');
          await expect(page.locator('#phase')).not.toContainText('undefined');
        }
      }
    }
    await page.locator('#character').selectOption('2');
    await page.locator('#move').selectOption('combo');
    await page.locator('#cycle').selectOption('1');
    await page.locator('#pose').selectOption('2');
    await expect(page.locator('#phase')).toContainText('2번째');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.locator('#next').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#pose')).toHaveValue('3');
    await page.screenshot({ path: proof + `/review-${viewport.width}.png` });
    expect(errors).toEqual([]);
  });
