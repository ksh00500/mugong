import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { makeWeapon, xpThreshold } from '../../src/domain/content';
import type { BoundFighter, GameState } from '../../src/domain/model';
import { isGameSave } from '../../src/platform/save-validation';
const proof = `docs/verification/combat-actions-ux-v1/${process.env.MUGONG_ACTION_MODE ?? 'source'}`;
function fixture() {
  const state = emptyGame();
  startRun(state, '전투 조작 검토', 123);
  const r = state.run!,
    f = r.fighter as BoundFighter;
  f.level = f.spent = r.spent = 16;
  f.xp = xpThreshold(16);
  f.augments = ['swift'];
  f.augmentOffers = [];
  r.offers = [];
  f.arts = (['wudang', 'huashan', 'samja', 'tianmo'] as const).map((id, i) => ({
    id,
    level: i === 3 ? 1 : 5,
    gauge: 100,
    combo: 0,
    defenseCd: 0,
  }));
  f.items = [makeWeapon('sword', 'blade', 'weapon')];
  f.bindings = { wudang: 'blade', huashan: 'blade', samja: 'blade', tianmo: 'blade' };
  f.invulnerable = 1000;
  r.enemies.forEach((e) => {
    e.hp = e.maxHp = 100000;
    e.timer = 1000;
    e.state = 'windup';
  });
  return state;
}
async function load(page: Page, state = fixture()) {
  expect(isGameSave(state)).toBe(true);
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
}
async function saved(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    const state = await new Promise<GameState>((resolve) => {
      const q = db.transaction('saves').objectStore('saves').get('current');
      q.onsuccess = () => resolve(q.result);
    });
    db.close();
    return state;
  });
}
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
  [600, 650],
] as const) {
  test(`HUD actions work at ${width}x${height}`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    const defense = page.getByRole('button', { name: '방어 행동 사용', exact: true }),
      ultimate = page.getByRole('button', { name: '궁극 행동 사용', exact: true });
    for (const button of [defense, ultimate]) {
      await expect(button).toHaveAttribute('aria-disabled', 'false');
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThan(100);
      expect(box.height).toBeGreaterThanOrEqual(40);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    const label = await page.locator('.defense-trigger b').evaluate((el) => {
      const b = el.getBoundingClientRect(),
        s = getComputedStyle(el);
      return {
        text: el.textContent,
        width: b.width,
        height: b.height,
        display: s.display,
        color: s.color,
        fontSize: s.fontSize,
      };
    });
    expect(label.width, JSON.stringify(label)).toBeGreaterThan(20);
    expect(label.height).toBeGreaterThan(10);
    await page.screenshot({ path: `${proof}/ready-${width}.png` });
    await defense.click();
    await expect(defense).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#defense-action-state')).toHaveText(/재사용 .*초/);
    // Click the locked action: it must not queue a second defense for later.
    await defense.click({ force: true });
    await expect(defense).toHaveAttribute('aria-disabled', 'false', { timeout: 12000 });
    // Ordinary attack records the last battlefield aim; the HUD must preserve it.
    const canvas = (await page.locator('.game-canvas canvas').boundingBox())!;
    await page.mouse.click(canvas.x + canvas.width * 0.75, canvas.y + canvas.height * 0.35);
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: '일시 정지', exact: true }).click();
    await expect.poll(async () => (await saved(page)).run!.fighter.cooldown).toBeLessThanOrEqual(0);
    const before = (await saved(page)).run!.fighter;
    await page.keyboard.press('Escape');
    await ultimate.click();
    await expect(page.locator('.ultimate-heading span')).toHaveText('0 / 100');
    await expect(page.locator('#ultimate-action-state')).toHaveText(
      '현재 무공으로 적을 타격해 충전',
    );
    await page.getByRole('button', { name: '일시 정지', exact: true }).click();
    await expect.poll(async () => (await saved(page)).run!.fighter.arts[0].gauge).toBe(0);
    const after = (await saved(page)).run!.fighter;
    expect(after.facing).toBeCloseTo(before.facing, 5);
    expect(after.arts[0].defenseCd).toBe(0);
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/actions-${width}.json`,
      JSON.stringify(
        {
          width,
          height,
          aimBefore: before.facing,
          aimAfter: after.facing,
          ultimateGauge: after.arts[0].gauge,
          defenseCooldown: after.arts[0].defenseCd,
          errors,
          label,
        },
        null,
        2,
      ),
    );
  });
}
test('native Space and Enter activate the focused action without also defending', async ({
  page,
}) => {
  await load(page);
  const ultimate = page.getByRole('button', { name: '궁극 행동 사용', exact: true });
  await ultimate.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.ultimate-heading span')).toHaveText('0 / 100');
  await expect(page.getByRole('button', { name: '방어 행동 사용', exact: true })).toHaveAttribute(
    'aria-disabled',
    'false',
  );
  await page.getByRole('button', { name: '방어 행동 사용', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#defense-action-state')).toHaveText(/재사용 .*초/);
});
test('missing weapon explains unavailable actions without consuming gauge', async ({ page }) => {
  const state = fixture(),
    f = state.run!.fighter as BoundFighter;
  f.bindings = {};
  await load(page, state);
  await expect(page.locator('#defense-action-state')).toHaveText('무장 필요');
  await expect(page.locator('#ultimate-action-state')).toHaveText('무장 필요');
  await page.getByRole('button', { name: '궁극 행동 사용', exact: true }).click({ force: true });
  await expect(page.locator('.ultimate-heading span')).toHaveText('100 / 100');
  // A fresh independent page is seeded rather than altering the live game store.
});
test('unlocked artwork and ready gauge do not allow actions at a waystation', async ({ page }) => {
  const state = fixture();
  state.run!.wave = 4;
  spawnWave(state.run!);
  await load(page, state);
  for (const id of ['defense', 'ultimate'])
    await expect(page.locator(`#${id}-action-state`)).toHaveText('전투 중에 사용');
  // The waystation workspace intentionally hides combat actions, not merely disables them.
  await expect(page.locator('.ultimate-trigger')).toBeHidden();
  await expect(page.locator('.defense-trigger')).toBeHidden();
  await expect(page.locator('.ultimate-heading span')).toHaveText('100 / 100');
});
test('low mastery shows the actual unlock level', async ({ page }) => {
  const state = fixture();
  state.run!.fighter.arts[0].level = 1;
  await load(page, state);
  await expect(page.locator('#ultimate-action-state')).toHaveText('무공 Lv.5 개방');
  await expect(page.getByRole('button', { name: '궁극 행동 사용', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});
test('English large HUD in a short viewport retains actionable controls and full boost reason', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1093, height: 614 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('mugong-language-v1', 'en');
    localStorage.setItem('mugong-ui-v1', JSON.stringify({ largeHud: true, highContrast: true }));
  });
  const state = fixture(),
    f = state.run!.fighter as BoundFighter;
  f.arts[0] = { ...f.arts[0], id: 'gaebang', gauge: 200, queuedBoosts: 2 };
  f.items = [makeWeapon('staff', 'staff', 'weapon')];
  f.bindings = { gaebang: 'staff' };
  await load(page, state);
  await expect(page.locator('#ultimate-action-state')).toHaveText('Boosts queued 2/2');
  await page.getByRole('button', { name: 'Use ultimate', exact: true }).click({ force: true });
  await expect(page.locator('.ultimate-heading span')).toHaveText('200 / 200');
  await page.getByRole('button', { name: 'Use defense', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#defense-action-state')).toHaveText(/Cooldown .*s/);
  await page.screenshot({ path: `${proof}/english-large.png` });
});
