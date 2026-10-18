import { test, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { seedRegion } from './support/region';
import { regionArtManifest } from '../../src/platform/region-art';
import type { Fighter } from '../../src/domain/model';
const proof =
  process.env.MUGONG_RELEASE_PROOF ?? 'docs/verification/daytona-20261006-native-regions-v1/public';
test.beforeEach(async () => {
  test.skip(!process.env.MUGONG_DAYTONA_URL, 'Public release verification only');
  await mkdir(proof, { recursive: true });
});
test('public native build and representative files match local hashes', async ({ request }) => {
  const files = ['index.html'];
  const release = JSON.parse(await readFile(`${proof}/../release.json`, 'utf8'));
  files.push(...release.assets.map((name: string) => `assets/${name}`));
  for (let i = 0; i < 10; i++) {
    const urls = Object.values(regionArtManifest(i));
    files.push(urls[0].slice(1), urls[1].slice(1));
  }
  files.push('art/hero-weapon-v4/guard-6.webp');
  const records = [];
  for (const file of files) {
    const response = await request.get(`/${file}`);
    expect(response.status(), file).toBe(200);
    const hash = createHash('sha256')
      .update(await response.body())
      .digest('hex');
    expect(hash, file).toBe(
      createHash('sha256')
        .update(await readFile(`dist/${file}`))
        .digest('hex'),
    );
    records.push({ file, hash });
  }
  await writeFile(`${proof}/files.json`, JSON.stringify(records, null, 2));
});
for (let region = 0; region < 10; region++) {
  test(`public region ${region} native images and real combat inputs`, async ({ page }) => {
    if (region === 4) await page.setViewportSize({ width: 1440, height: 900 });
    if (region === 6) await page.setViewportSize({ width: 1093, height: 614 });
    const errors: string[] = [],
      failed: string[] = [],
      assets = new Set<string>();
    const expected = Object.values(regionArtManifest(region));
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (response.status() >= 400 && /\/(art|assets|fonts)\//.test(path))
        failed.push(`${response.status()} ${path}`);
      if (response.status() === 200 && expected.includes(path)) assets.add(path);
    });
    await seedRegion(page, region, true, region as Fighter['appearance']);
    await expect.poll(() => assets.size).toBe(expected.length);
    await expect(page.locator('script[src^="/assets/main-"]')).toHaveCount(1);
    await page.keyboard.down('d');
    await page.waitForTimeout(180);
    await page.keyboard.up('d');
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(canvas.x + canvas.width * 0.65, canvas.y + canvas.height * 0.5);
    await page.waitForTimeout(150);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (image) => image.decode()));
    });
    await page.screenshot({ path: `${proof}/region-${region}.png` });
    await page.getByRole('button', { name: '가방', exact: false }).first().click();
    await expect(page.getByRole('dialog', { name: '가방 · 정보 확인' })).toBeVisible();
    await page.getByRole('button', { name: '가방 · 정보 확인 닫기' }).click();
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
    await writeFile(
      `${proof}/region-${region}.json`,
      JSON.stringify(
        {
          region,
          viewport: page.viewportSize(),
          expected: expected.length,
          assets: [...assets],
          errors,
          failed,
          realUserSaveChanged: false,
        },
        null,
        2,
      ),
    );
  });
}
