import { test, expect, type Page } from '@playwright/test';
import { messages } from '../../src/platform/messages';
import { mkdir } from 'node:fs/promises';

type Locale = 'ko' | 'en' | 'ja' | 'zh-CN' | 'zh-TW';
const index = { en: 0, ja: 1, 'zh-CN': 2, 'zh-TW': 3 } as const;
const copy = (key: string, locale: Locale) =>
  locale === 'ko' ? key : messages[key][index[locale]];
const proof = process.env.MUGONG_DAYTONA_PROOF
  ? `${process.env.MUGONG_DAYTONA_PROOF}/languages`
  : process.env.MUGONG_DAYTONA_URL
    ? 'docs/verification/language-v1-daytona'
    : 'docs/verification/language-v1';
async function expectFits(page: Page) {
  const failures = await page.evaluate(() => {
    const failures: string[] = [];
    if (
      document.documentElement.scrollWidth > innerWidth + 1 ||
      document.documentElement.scrollHeight > innerHeight + 1
    )
      failures.push('page scroll');
    for (const element of document.querySelectorAll(
      'button,select,input,.home-departure h1,.item-detail,.screen-settings,.bag-grid,.bag-usage',
    )) {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      if (
        box.left < -1 ||
        box.top < -1 ||
        box.right > innerWidth + 1 ||
        box.bottom > innerHeight + 1
      )
        failures.push(`outside: ${element.getAttribute('aria-label') || element.textContent}`);
      const el = element as HTMLElement;
      if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)
        failures.push(
          `overflow: ${el.className} ${el.textContent?.slice(0, 50)} ${el.clientWidth}x${el.clientHeight}/${el.scrollWidth}x${el.scrollHeight} font=${getComputedStyle(el).fontSize}`,
        );
    }
    return failures;
  });
  expect(failures).toEqual([]);
}
for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'] as const) {
  test(`${locale}: 브라우저 감지 및 3개 화면 크기의 로비·설정·가방`, async ({ browser }) => {
    const context = await browser.newContext({ locale, viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('h1')).toHaveText(copy('강호에 나서세요', locale));
    for (const [width, height] of [
      [1366, 768],
      [1440, 900],
      [1093, 614],
    ]) {
      await page.setViewportSize({ width, height });
      await expectFits(page);
      await page.getByRole('button', { name: copy('화면 설정', locale), exact: true }).click();
      await expect(page.locator('#game-language')).toHaveValue('auto');
      await expect(page.locator('#game-language option')).toHaveCount(6);
      await expectFits(page);
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: copy('화면 설정', locale), exact: true }),
      ).toBeFocused();
      await page.getByRole('button', { name: copy('새 무인으로 출전 →', locale) }).click();
      await expectFits(page);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: copy('강호 입문 안내', locale), exact: true }).click();
      await expectFits(page);
      expect(
        await page.locator('.dialog').evaluate((el) => el.scrollHeight <= el.clientHeight + 2),
      ).toBe(true);
      if (width === 1093 && !process.env.MUGONG_DAYTONA_URL) {
        await mkdir('docs/verification/layout-v3/languages', { recursive: true });
        await page.screenshot({
          path: `docs/verification/layout-v3/languages/guide-${locale}.png`,
          animations: 'disabled',
        });
      }
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: copy('새 무인으로 출전 →', locale) }).click();
    await page.getByLabel(copy('무인의 이름', locale)).fill('한글무인');
    await page.getByRole('button', { name: copy('강호에 나서기 →', locale) }).click();
    await expect(page.locator('canvas')).toBeVisible();
    await page.getByRole('button', { name: `${copy('가방', locale)} Tab` }).click();
    await page
      .getByRole('button', {
        name: copy('{0} 선택', locale).replace('{0}', copy('금창약', locale)),
      })
      .click();
    await expectFits(page);
    await expectFits(page);
    await expect(
      page.getByRole('button', { name: copy('사용', locale), exact: true }),
    ).toBeDisabled();
    await expect(page.locator('.item-detail')).toContainText(copy('금창약', locale));
    await expectFits(page);
    await mkdir(proof, { recursive: true });
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${proof}/bag-${locale}-1093.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: copy('일시 정지', locale), exact: true }).click();
    await page.getByRole('button', { name: copy('화면 설정', locale), exact: true }).click();
    await expectFits(page);
    await page.screenshot({
      path: `${proof}/settings-${locale}-1093.png`,
      animations: 'disabled',
    });
    expect(errors).toEqual([]);
    await context.close();
  });
}
test('언어 수동 선택·새로고침·자동 감지 복귀 및 저장된 무인 보존', async ({ browser }) => {
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Language', { exact: true }).selectOption('ko');
  await expect(page.getByRole('dialog', { name: '화면 설정' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('강호에 나서세요');
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await page.getByLabel('무인의 이름').fill('검객한글');
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.locator('.player-name')).toContainText('검객한글');
  await page.getByRole('button', { name: '일시 정지' }).click();
  await page.getByRole('button', { name: '화면 설정', exact: true }).click();
  await page.locator('#game-language').selectOption('ja');
  await expect(page.getByRole('dialog', { name: '設定', exact: true })).toBeVisible();
  await expect(page.locator('.player-name')).toContainText('검객한글');
  await page.locator('#game-language').selectOption('auto');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.locator('.player-name')).toContainText('검객한글');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await context.close();
});
test('미지원 브라우저 언어는 영어로 표시한다', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'fr-FR' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toHaveText('Enter the Jianghu');
  await context.close();
});
