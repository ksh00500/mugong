import { test, expect, type Page } from '@playwright/test';
import { emptyGame, startRun } from '../../src/domain/game';
import { makeItem } from '../../src/domain/content';
import { mkdir } from 'node:fs/promises';

// Each test uses Playwright's new browser context, never the user's browser save.
async function seed(page: Page, state: unknown) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('mugong-local-v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const transaction = db.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put(state, 'current');
      transaction.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
}

test('손상된 무인 저장은 오류 안내를 표시하고 원본을 덮어쓰지 않는다', async ({ page }) => {
  const state = emptyGame();
  startRun(state, '보존할 무인', 123);
  const fighter = state.run!.fighter;
  state.run = null;
  state.family.roster.push(fighter);
  state.selectedId = fighter.id;
  const corrupted = { ...state, family: { ...state.family, roster: [{ ...fighter, arts: null }] } };
  await seed(page, corrupted);
  await expect(page.getByRole('dialog', { name: '저장 확인이 필요합니다' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('기존 저장은 보존됩니다');
  await page.getByRole('button', { name: '저장 다시 시도' }).click();
  await expect(page.getByRole('alert')).toContainText('기존 저장은 보존됩니다');
  const original = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('mugong-local-v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    return new Promise((resolve) => {
      const request = db.transaction('saves').objectStore('saves').get('current');
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
    });
  });
  expect(original).toEqual(corrupted);
  await mkdir('docs/verification/audit-v1', { recursive: true });
  await page.screenshot({ path: 'docs/verification/audit-v1/save-error.png' });
});

test('설정 창은 배경 화면 초점과 입력을 차단하고 닫으면 원래 버튼으로 돌린다', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: '설정', exact: true });
  await opener.press('Enter');
  await expect(page.getByRole('dialog', { name: '설정' })).toBeVisible();
  await expect(page.locator('.home-scene')).toHaveJSProperty('inert', true);
  await page.locator('.home-launch').evaluate((button: HTMLElement) => button.focus());
  expect(
    await page
      .locator('[role="dialog"]')
      .evaluate((dialog) => dialog.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.home-scene')).toHaveJSProperty('inert', false);
  await expect(opener).toBeFocused();
});

test('폐기 확인 중 가방의 회전 단축키가 뒤에서 실행되지 않는다', async ({ page }) => {
  const state = emptyGame();
  startRun(state, '정리하는 무인', 123);
  const fighter = state.run!.fighter;
  state.run = null;
  state.family.roster.push(fighter);
  state.selectedId = fighter.id;
  fighter.items.push(makeItem('manual', 'pending-manual', 'ground'));
  await seed(page, state);
  await page.getByRole('button', { name: '무장과 가방 살펴보기' }).click();
  await page
    .locator(`[data-item-id="${fighter.items.find((item) => item.place === 'weapon')!.id}"]`)
    .click();
  const rotation = page.getByRole('button', { name: /회전/ });
  const before = await rotation.textContent();
  await page.locator('[data-item-id="pending-manual"]').click();
  await page.getByRole('button', {name:'폐기',exact:true}).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.keyboard.press('r');
  await page.keyboard.press('Escape');
  await expect(rotation).toHaveText(before!);
  await expect(page.getByRole('button', { name: '폐기', exact:true })).toBeFocused();
});

test('뒤로가기 캐시의 pagehide 상태에서도 다른 탭에 저장 권한을 넘기지 않는다', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
  // Simulate the persisted lifecycle event; this is not a browser BFCache eligibility test.
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
  );
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('dialog', { name: '저장 확인이 필요합니다' })).toBeVisible();
  await expect(second.getByRole('alert')).toContainText('다른 탭');
  await page.close();
  await second.getByRole('button', { name: '저장 다시 시도' }).click();
  await expect(second.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
});

test('체력이 가득 차면 약 사용은 비활성화되어 소모되지 않는다', async ({ page }) => {
  const state = emptyGame();
  startRun(state, '건강한 무인', 123);
  state.run!.phase = 'loot';
  await seed(page, state);
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.getByRole('button', { name: '금창약 선택' }).click();
  await expect(page.getByRole('button', { name: '사용', exact: true })).toBeDisabled();
});

test('가방에서 수련 후 성장 창이 열리면 R키가 뒤의 가방에 전달되지 않는다', async ({ page }) => {
  const state = emptyGame();
  startRun(state, '수련하는 무인', 123);
  const fighter = state.run!.fighter;
  state.run = null;
  state.family.roster.push(fighter);
  state.selectedId = fighter.id;
  fighter.items.push({ ...makeItem('manual', 'training-manual', 'general'), x: 3, count: 2 });
  await seed(page, state);
  await page.getByRole('button', { name: '무장과 가방 살펴보기' }).click();
  await page.getByRole('button', { name: '수련 비급 선택' }).click();
  const before = await page.getByRole('button', { name: /회전/ }).textContent();
  await page.getByRole('button', { name: '사용', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '무공 성장 선택' })).toBeVisible();
  await page.keyboard.press('r');
  await page.locator('.choice-card').first().click();
  await expect(page.getByRole('button', { name: /회전/ })).toHaveText(before!);
  await expect(page.getByRole('dialog', { name: '무인의 가방' })).toBeVisible();
  await expect(page.locator('.inventory-workspace')).not.toHaveAttribute('inert');
});
