import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const [width,height] of [[1440,900],[1366,768],[1093,614]]) {
  test(`recruitment persists candidates and fits ${width}x${height}`, async ({page}) => {
    await page.setViewportSize({width,height});
    await page.goto('/');
    await page.getByRole('button',{name:'새 무인으로 출전 →'}).click();
    await page.getByRole('button',{name:'모집권 1장 사용'}).click();
    const cards=page.locator('.recruitment-candidate');
    await expect(cards).toHaveCount(3);
    for (const text of await cards.allTextContents()) expect(text).not.toMatch(/후보\s*[123]/);
    const portraits = await cards.locator('.recruitment-portrait').evaluateAll(images => images.map(image => (image as HTMLImageElement).src));
    expect(new Set(portraits).size).toBe(3);
    await expect(page.getByText('모집권 2 / 3')).toBeVisible();
    const rates=await cards.allTextContents();
    const budgets = await page.evaluate(async () => {
      const modulePath='/src/platform/store.ts';
      const {gameStore} = await import(/* @vite-ignore */ modulePath);
      return gameStore.state.family.recruitment!.candidates.map((candidate: { growth: Record<string, number> }) =>
        Object.values(candidate.growth).reduce((total, rate) => total + Math.round(rate * 10), 0));
    });
    expect(budgets).toHaveLength(3);
    for (const budget of budgets) {
      expect(budget).toBeGreaterThanOrEqual(45);
      expect(budget).toBeLessThanOrEqual(55);
    }
    await page.reload();
    await page.getByRole('button',{name:'새 무인으로 출전 →'}).click();
    await expect(cards).toHaveCount(3);
    expect(await cards.allTextContents()).toEqual(rates);
    await cards.nth(1).locator('.recruitment-select').focus();
    await page.keyboard.press('Enter');
    await expect(cards.nth(1).locator('.recruitment-select')).toHaveAttribute('aria-pressed','true');
    await page.getByLabel('무인의 이름').fill('모집검증');
    const start=page.getByRole('button',{name:'강호에 나서기 →'});
    await expect(start).toBeEnabled();
    const box=await page.getByRole('dialog').boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y+box!.height).toBeLessThanOrEqual(height);
    await mkdir('docs/verification/recruitment-v1',{recursive:true});
    await page.screenshot({path:`docs/verification/recruitment-v1/${width}x${height}.png`});
    await start.click();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready','true',{timeout:45000});
  });
}

test('empty tickets allow currency purchase and fixed basic entry', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('button',{name:'새 무인으로 출전 →'})).toBeVisible();
  await page.evaluate(async () => {
    const modulePath='/src/platform/store.ts';
    const {gameStore} = await import(/* @vite-ignore */ modulePath);
    gameStore.state.family.silver=100;
    gameStore.state.family.recruitment={tickets:0,anchor:Date.now(),observedAt:Date.now(),sequence:0,candidates:[]};
    await gameStore.persist();
  });
  await page.getByRole('button',{name:'새 무인으로 출전 →'}).click();
  await expect(page.getByRole('button',{name:'기본 무인으로 출전'})).toBeEnabled();
  await page.getByRole('button',{name:'모집권 구매 · 100'}).click();
  await expect(page.getByText('모집권 1 / 3')).toBeVisible();
  await expect(page.getByRole('button',{name:'모집권 구매 · 100'})).toBeDisabled();
  await page.getByRole('button',{name:'모집권 1장 사용'}).click();
  await expect(page.locator('.recruitment-candidate')).toHaveCount(3);
  await expect(page.getByRole('button',{name:'기본 무인으로 출전'})).toHaveCount(0);
});
