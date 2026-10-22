import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('Daytona 공개 빌드의 출전·전투·가방·저장 복원', async ({ page }) => {
  test.skip(!process.env.MUGONG_DAYTONA_URL, 'Daytona URL을 지정한 배포 검증에서만 실행');
  const proof = process.env.MUGONG_DAYTONA_PROOF || 'docs/verification/daytona-20260928';
  await mkdir(proof, { recursive: true });
  const errors: string[] = [],
    failedAssets: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && /\/(assets|art|fonts)\//.test(response.url()))
      failedAssets.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode()));
  });
  await page.screenshot({ path: `${proof}/lobby.png`, animations: 'disabled' });
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await page.getByRole('button', { name: '모집권 1장 사용' }).click();
  const candidateRates = await page
    .locator('.recruitment-candidate')
    .evaluateAll((cards) =>
      cards.map((card) =>
        Array.from(card.querySelectorAll('dd'), (cell) =>
          Number(cell.textContent!.replace('×', '')),
        ),
      ),
    );
  expect(candidateRates).toHaveLength(3);
  for (const rates of candidateRates) {
    expect(rates).toHaveLength(4);
    const budget = rates.reduce((sum, rate) => sum + Math.round(rate * 10), 0);
    expect(budget).toBeGreaterThanOrEqual(45);
    expect(budget).toBeLessThanOrEqual(55);
    for (const rate of rates) {
      expect(rate).toBeGreaterThanOrEqual(0.8);
      expect(rate).toBeLessThanOrEqual(2);
    }
  }
  await expect
    .poll(() =>
      page
        .locator('.recruitment-candidate img')
        .evaluateAll(
          (images) =>
            images.length > 0 &&
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
        ),
    )
    .toBe(true);
  await page.screenshot({ path: `${proof}/recruitment.png`, animations: 'disabled' });
  await page.locator('.recruitment-candidate').first().click();
  await page.getByLabel('무인의 이름').fill('배포검증무인');
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.locator('.choice-card').first()).toBeEnabled();
  await page.locator('.choice-card').first().click();
  await expect(page.getByRole('dialog', { name: '무공 성장 선택' })).toHaveCount(0);
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.keyboard.down('d');
  await page.waitForTimeout(350);
  await page.keyboard.up('d');
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(canvas.x + canvas.width * 0.7, canvas.y + canvas.height * 0.5);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${proof}/combat.png` });
  await page.mouse.up();
  await page.getByRole('button', { name: '가방 Tab' }).click();
  await expect(page.getByRole('dialog', { name: '가방 · 정보 확인' })).toBeVisible();
  await page.getByRole('button', { name: '금창약 선택' }).click();
  await expect(page.getByRole('button', { name: '사용', exact: true })).toBeDisabled();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${proof}/bag.png`, animations: 'disabled' });
  await page.getByRole('button', { name: '가방 · 정보 확인 닫기' }).click();
  await page.getByRole('button', { name: '일시 정지' }).click();
  await page.getByRole('button', { name: '저장하고 일시 종료' }).click();
  await expect(page.locator('.home-run-card')).toContainText('배포검증무인');
  await page.getByRole('button', { name: '강호 이어하기 1 / 20 →' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.player-name')).toContainText('배포검증무인');
  // Loading a saved run restores the field directly; the lobby is a temporary view.
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.player-name')).toContainText('배포검증무인');
  await expect(page.getByRole('region', { name: '강호 진행' })).toContainText('1 / 20');
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
  const animationResources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => url.includes('/art/animation-rebuild-v2/')),
  );
  expect(animationResources.some((url) => url.endsWith('/hero.webp'))).toBe(true);
  expect(animationResources.some((url) => url.endsWith('/hero-reactions.webp'))).toBe(true);
  const nativeResources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => /\/art\/(?:[a-z]+-family-v1|shaolin-staff-v1)\/.*\.webp$/.test(url)),
  );
  expect(nativeResources.length).toBeGreaterThanOrEqual(35);
  await writeFile(
    `${proof}/result.json`,
    JSON.stringify(
      {
        url: process.env.MUGONG_DAYTONA_URL,
        viewport: [page.viewportSize()!.width, page.viewportSize()!.height],
        errors,
        failedAssets,
        candidateRates,
        animationResources,
        nativeResources,
        passed: ['lobby', 'create', 'combat', 'bag restrictions', 'save', 'reload', 'resume'],
        storage: 'isolated Playwright context',
      },
      null,
      2,
    ),
  );
});
