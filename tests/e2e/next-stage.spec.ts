import { expect, test } from '@playwright/test';

test('main game remains the root entry', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'ko-KR' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await context.close();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1093, height: 614 },
]) {
  test(`next stage preview fits ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, locale: 'ko-KR' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/next-stage/');
    await expect(page.getByRole('heading', { name: '나설 곳을 고르세요' })).toBeVisible();
    await expect(page.getByText('온라인 기능 미연결')).toBeVisible();
    await page.screenshot({
      path: `test-results/next-stage-select-${viewport.width}.png`,
      fullPage: true,
    });
    await page.locator('.ns-mode-card.raid').click();
    await expect(page.getByRole('heading', { name: '흑풍채로 출전' })).toBeVisible();
    await page.screenshot({
      path: `test-results/next-stage-raid-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: /전투 HUD 시안 보기/ }).click();
    if (viewport.width === 1093)
      await page.screenshot({ path: 'test-results/next-stage-combat-1093.png', fullPage: true });
    await page.getByRole('button', { name: /1층 클리어/ }).click();
    await expect(page.getByText('개인 전리품과 유품')).toBeVisible();
    await expect(page.getByText('무장 가방')).toBeVisible();
    await expect(page.getByText('일반 가방', { exact: true })).toBeVisible();
    await page.screenshot({
      path: `test-results/next-stage-rest-${viewport.width}.png`,
      fullPage: true,
    });
    const gridRatios = await page.locator('.ns-bag-grid').evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width / rect.height;
      }),
    );
    expect(gridRatios[0]).toBeCloseTo(4 / 7, 1);
    expect(gridRatios[1]).toBeCloseTo(10 / 8, 1);
    const bounds = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    }));
    expect(bounds.width).toBeLessThanOrEqual(bounds.viewportWidth + 1);
    expect(bounds.height).toBeLessThanOrEqual(bounds.viewportHeight + 1);
    for (const name of ['함께 귀환하기', '3명으로 다음 층 준비']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.getByRole('button', { name: '출전 선택' }).click();
    await page.locator('.ns-mode-card.biwu').click();
    if (viewport.width === 1093)
      await page.screenshot({ path: 'test-results/next-stage-biwu-1093.png', fullPage: true });
    await expect(page.getByRole('button', { name: /매칭 대기 시안 보기/ })).toBeInViewport();
    await page.getByRole('button', { name: '출전 선택' }).click();
    await page.locator('.ns-mode-card.deathmatch').click();
    if (viewport.width === 1093)
      await page.screenshot({
        path: 'test-results/next-stage-deathmatch-1093.png',
        fullPage: true,
      });
    await expect(page.getByRole('button', { name: /위험 확인 시안 보기/ })).toBeInViewport();
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('rest stores loot, party change resets ready, and lethal entry asks for confirmation', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    locale: 'ko-KR',
  });
  const page = await context.newPage();
  await page.goto('/next-stage/');
  await page.locator('.ns-mode-card.raid').click();
  await page.getByRole('button', { name: /전투 HUD 시안 보기/ }).click();
  await page.getByRole('button', { name: /1층 클리어/ }).click();
  await page.getByRole('button', { name: '일반 가방에 수납' }).click();
  await expect(page.getByRole('status')).toContainText('청운비급을 일반 가방에 수납');
  await page
    .locator('.ns-loot-row button')
    .first()
    .dragTo(page.locator('.ns-bag-grid').nth(1), { targetPosition: { x: 160, y: 110 } });
  await expect(page.getByRole('status')).toContainText('동료의 유품을 일반 가방에 수납');
  await expect(page.getByText('원 소유자 · 월영 세가')).toBeVisible();
  await page.getByRole('button', { name: '3명으로 다음 층 준비' }).click();
  await expect(page.getByRole('button', { name: '준비 취소' })).toBeVisible();
  await page.getByRole('button', { name: '동료 귀환 상황 보기' }).click();
  await expect(page.getByRole('button', { name: '2명으로 다음 층 준비' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('함께 귀환하거나');
  await page.getByRole('button', { name: '출전 선택' }).click();
  await page.locator('.ns-mode-card.biwu').click();
  await page.screenshot({ path: 'test-results/next-stage-biwu-1366.png', fullPage: true });
  await page.getByRole('button', { name: '출전 선택' }).click();
  await page.locator('.ns-mode-card.deathmatch').click();
  await page.screenshot({ path: 'test-results/next-stage-deathmatch-1366.png', fullPage: true });
  await page.getByRole('button', { name: '500 냥' }).click();
  await page.getByRole('button', { name: /위험 확인 시안 보기/ }).click();
  await expect(page.getByRole('dialog')).toContainText('무인을 잃을 수 있습니다');
  await expect(page.getByRole('dialog')).toContainText('500 냥');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: /위험 확인 시안 보기/ })).toBeFocused();
  await context.close();
});
