import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { seedRegion } from './support/region';

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  test(`contextual stat and trait explanations fit ${width}x${height}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
    await page.getByRole('button', { name: '모집권 1장 사용' }).click();
    const card = page.locator('.recruitment-candidate').first(),
      selection = card.locator('.recruitment-select');
    await expect(card.locator('.character-info-icon')).toHaveCount(5);
    for (const name of ['체질', '근력', '기민', '내공']) {
      const icon = card.getByRole('button', { name: `${name} 설명`, exact: true });
      await icon.hover();
      const tooltip = page.getByRole('tooltip');
      await expect(tooltip).toHaveCount(1);
      await expect(tooltip.locator('strong')).toHaveText(name);
      const box = await tooltip.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
      await icon.click();
      await expect(selection).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('Escape');
      await expect(tooltip).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: '무인 모집' })).toBeVisible();
    }
    await page.mouse.move(0, 0);
    await card.getByRole('button', { name: '체질 설명', exact: true }).focus();
    await expect(page.getByRole('tooltip')).toContainText('체질');
    await mkdir('docs/verification/character-info-v1', { recursive: true });
    await page.screenshot({
      path: `docs/verification/character-info-v1/recruitment-${width}x${height}.png`,
    });
    await selection.focus();
    await page.keyboard.press('Enter');
    await expect(selection).toHaveAttribute('aria-pressed', 'true');

    await seedRegion(page, 1);
    await page.evaluate(async () => {
      const { gameStore } = await (window as any).regionModule('/src/platform/store.ts');
      const { xpThreshold } = await (window as any).regionModule('/src/domain/content.ts');
      const r = gameStore.state.run,
        f = r.fighter;
      Object.assign(f, {
        progressionVersion: 2,
        growth: { constitution: 1, strength: 1.3, agility: 0.9, inner: 1.6 },
        level: 50,
        xp: xpThreshold(50),
        innate: 'quickhands',
        augments: ['iron', 'reservoir', 'resolve'],
        augmentOffers: [],
        trainingPoints: 8,
      });
      r.offers = [];
      r.phase = 'loot';
      r.enemies = [];
      gameStore.bagOpen = true;
      gameStore.notify();
    });
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await expect(page.getByRole('dialog', { name: '무인의 성장' })).toHaveCount(0);
    const profile = page.locator('.character-profile');
    for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
      await page.evaluate(async (code) => {
        const { setLanguage } = await (window as any).regionModule('/src/platform/i18n.ts');
        setLanguage(code);
      }, language);
      for (const icon of await profile.locator('.character-info-icon').all()) {
        await page.mouse.move(0, 0);
        await icon.focus();
        const tooltip = page.getByRole('tooltip');
        await expect(tooltip).toHaveCount(1);
        await expect(tooltip).not.toBeEmpty();
        const box = await tooltip.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(height);
        await page.keyboard.press('Escape');
        await expect(tooltip).toHaveCount(0);
      }
    }
    await page.evaluate(async () => {
      const { setLanguage } = await (window as any).regionModule('/src/platform/i18n.ts');
      setLanguage('ko');
    });
    await profile.getByRole('button', { name: '재빠른 손 설명', exact: true }).hover();
    await expect(page.getByRole('tooltip')).toContainText(
      '무공 전환 후 다음 기본 공격 피해가 25% 증가합니다. 재사용 4초.',
    );
    await page.screenshot({
      path: `docs/verification/character-info-v1/bag-${width}x${height}.png`,
    });
    await page.getByRole('button', { name: '수련 설명', exact: true }).hover();
    await expect(page.getByRole('tooltip')).toContainText('보스 완료 시 3을 얻습니다.');
    await page.locator('.character-training').click();
    await expect(page.getByRole('dialog', { name: '무공 성장 선택' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
