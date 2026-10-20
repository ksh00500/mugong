import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import type { GameState } from '../../src/domain/model';

const proof = 'docs/verification/text-loading-v3';
async function readSaved(page: Page): Promise<GameState> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('mugong-local-v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    return new Promise<GameState>((resolve) => {
      const request = db.transaction('saves').objectStore('saves').get('current');
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
    });
  });
}
async function screenshot(page: Page, name: string) {
  await mkdir(proof, { recursive: true });
  await page.screenshot({ path: `${proof}/${name}.png`, animations: 'disabled' });
}

test('초기 JS가 늦어도 브라우저 언어의 시작 안내를 보여준다', async ({ browser }) => {
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1093, height: 614 },
  });
  const page = await context.newPage();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/src\/main\.tsx(?:\?.*)?$/, async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#boot-message')).toHaveText('Preparing the game…');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await screenshot(page, 'boot-en-1093');
  release();
  await expect(page.locator('h1')).toHaveText('Enter the Jianghu');
  await context.close();
});

test('지연된 그림은 실제 완료 개수를 표시하고 모두 준비한 뒤 로비를 보여준다', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const artwork = new Set<string>();
  page.on('request', (request) => {
    if (request.url().includes('/art/')) artwork.add(new URL(request.url()).pathname);
  });
  await page.route('**/symbols-v1.webp', async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '세가를 준비하고 있습니다' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  await expect(page.locator('.loading-count')).toHaveText('4 / 5개 그림 준비');
  await expect(page.locator('.home-launch')).toHaveCount(0);
  await page.setViewportSize({ width: 1093, height: 614 });
  await screenshot(page, 'interface-loading-1093');
  await expect(page.locator('.loading-hint')).toContainText('처음 실행하거나 연결이 느리면', {
    timeout: 6500,
  });
  release();
  await expect(page.locator('.home-launch')).toBeVisible();
  await expect(page.locator('.asset-loading')).toHaveCount(0);
  await expect(page.locator('.home-hero-image')).toHaveJSProperty('complete', true);
  expect([...artwork].every((url) => url.endsWith('.webp'))).toBe(true);
  await screenshot(page, 'lobby-1093');
  await writeFile(`${proof}/requested-artwork.json`, JSON.stringify([...artwork], null, 2));
});

test('시작 모듈 실패에서도 브라우저 언어의 새로고침 행동을 제공한다', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  let failing = true;
  await page.route(/\/src\/main\.tsx(?:\?.*)?$/, (route) =>
    failing ? route.fulfill({ status: 503, body: '' }) : route.continue(),
  );
  await page.goto('/');
  await expect(page.locator('#boot-message')).toHaveText('Check your connection and reload.');
  failing = false;
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Enter the Jianghu');
  await context.close();
});

test('UI 그림 실패에서 재시도와 기본 화면 진입이 가능하다', async ({ page }) => {
  let failing = true;
  await page.route('**/navigation-v1.webp', (route) =>
    failing ? route.fulfill({ status: 503, body: '' }) : route.continue(),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '화면을 준비하지 못했습니다' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('저장된 여정은 유지됩니다.');
  await screenshot(page, 'interface-error');
  failing = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('.home-launch')).toBeVisible();
  const saved = await readSaved(page);
  expect(saved.family.runs).toBe(0);
  expect(saved.run).toBeNull();
});

test('그림 장애가 지속되어도 기본 화면으로 창고와 설정을 사용할 수 있다', async ({ page }) => {
  await page.route('**/navigation-v1.webp', (route) => route.fulfill({ status: 503, body: '' }));
  await page.goto('/');
  await page.getByRole('button', { name: '기본 화면으로 계속' }).click();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-art-fallback', 'true');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.locator('#game-language')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '창고', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '세가 창고' })).toBeVisible();
});

test('전투 그림이 늦는 동안 HUD와 입력을 차단하고 준비 후 전투를 시작한다', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/hero-atlas-v2.webp', async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await page.getByLabel('무인의 이름').fill('로딩검객');
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.getByRole('heading', { name: '강호를 준비하고 있습니다' })).toBeVisible();
  await expect(page.locator('.hud')).toHaveCount(0);
  const before = (await readSaved(page)).run!;
  await page.keyboard.press('d');
  await page.mouse.click(600, 400);
  await page.waitForTimeout(600);
  const after = (await readSaved(page)).run!;
  expect([after.id, after.fighter.hp, after.fighter.x, after.fighter.y, after.kills]).toEqual([
    before.id,
    before.fighter.hp,
    before.fighter.x,
    before.fighter.y,
    before.kills,
  ]);
  await page.setViewportSize({ width: 1093, height: 614 });
  await screenshot(page, 'combat-loading-1093');
  release();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.hud')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: '일시 정지', exact: true }).click();
  await expect(page.getByRole('button', { name: '계속하기', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('전투 그림 실패 후 재시도해도 무인을 중복 생성하지 않는다', async ({ page }) => {
  let failing = true;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/hero-atlas-v2.webp', (route) =>
    failing ? route.fulfill({ status: 503, body: '' }) : route.continue(),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.getByRole('heading', { name: '화면을 준비하지 못했습니다' })).toBeVisible();
  const before = await readSaved(page);
  await screenshot(page, 'combat-error');
  failing = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  const after = await readSaved(page);
  expect(after.run!.id).toBe(before.run!.id);
  expect(after.family.runs).toBe(before.family.runs);
  expect(errors).toEqual([]);
});

test('전투 모듈 실패는 저장된 무인을 유지하며 새로고침으로 복구한다', async ({ page }) => {
  let failing = true;
  await page.route(/\/src\/game\/mount\.ts(?:\?.*)?$/, (route) =>
    failing ? route.fulfill({ status: 503, body: '' }) : route.continue(),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.getByRole('heading', { name: '화면을 준비하지 못했습니다' })).toBeVisible();
  const before = await readSaved(page);
  failing = false;
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  const after = await readSaved(page);
  expect(after.run!.id).toBe(before.run!.id);
  expect(after.family.runs).toBe(before.family.runs);
});
