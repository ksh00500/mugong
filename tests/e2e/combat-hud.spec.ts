import { test, expect } from '@playwright/test';
import { emptyGame, startRun, command } from '../../src/domain/game';
import { ART_IDS } from '../../src/domain/content';
import type { BoundFighter } from '../../src/domain/model';
import { mkdir, writeFile } from 'node:fs/promises';
const proof =
  process.env.MUGONG_FEEDBACK_PROOF ??
  (process.env.MUGONG_DAYTONA_URL
    ? 'docs/verification/combat-hud-v3/daytona'
    : 'docs/verification/combat-hud-v3');
test.use({ deviceScaleFactor: 2 });

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`무협 HUD ${width}×${height}: Q/E 순환과 실제 회피 재사용`, async ({ page }) => {
    const state = emptyGame();
    startRun(state, '청하연', 123);
    state.run!.offers = [];
    (state.run!.fighter as BoundFighter).bindings = Object.fromEntries(
      ART_IDS.slice(0, 4).map((id) => [id, state.run!.fighter.items[0].id]),
    );
    state.run!.fighter.arts = ART_IDS.slice(0, 4).map((id) => ({
      id,
      level: 5,
      gauge: 75,
      combo: 0,
      defenseCd: 0,
    }));
    state.run!.enemies.forEach((e) => {
      e.hp = e.maxHp = 100000;
      e.timer = 20;
      e.state = 'windup';
    });
    await page.goto('/');
    await expect(page.locator('.home-scene')).toBeVisible({ timeout: 30000 });
    await page.evaluate(async (state) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open('mugong-local-v1', 1);
        r.onsuccess = () => resolve(r.result);
      });
      await new Promise<void>((resolve) => {
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put(state, 'current');
        tx.oncomplete = () => resolve();
      });
      db.close();
    }, state);
    await page.setViewportSize({ width, height });
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 45000,
    });
    await expect(page.locator('.fan-card[aria-pressed="true"]')).toHaveAttribute(
      'aria-label',
      '화산매화검법 전환',
    );
    await page.keyboard.press('e');
    await expect(page.locator('.fan-card[aria-pressed="true"]')).toHaveAttribute(
      'aria-label',
      '무당태극검 전환',
    );
    await expect(page.locator('.defense-panel header b')).toHaveText('흘려받기');
    await page.keyboard.press('q');
    await expect(page.locator('.fan-card[aria-pressed="true"]')).toHaveAttribute(
      'aria-label',
      '화산매화검법 전환',
    );
    await page.keyboard.press('Space');
    await expect(page.locator('.defense-slot.active .cooldown-dial b')).toHaveText(/1\.[0-8]/);
    await page.getByRole('button', { name: '천마신공 전환', exact: true }).click();
    await expect(page.locator('.fan-card[aria-pressed="true"]')).toHaveAttribute(
      'aria-label',
      '천마신공 전환',
    );
    await page.getByRole('button', { name: '화산매화검법 전환', exact: true }).click();
    const bounds = await page
      .locator('.art-fan,.ultimate-panel,.defense-panel,.player-panel,.progress-panel')
      .evaluateAll((els) =>
        els.map((el) => ({
          class: el.className,
          ...el.getBoundingClientRect().toJSON(),
          scroll: el.scrollHeight,
          client: el.clientHeight,
        })),
      );
    for (const box of bounds) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
      expect(box.bottom).toBeLessThanOrEqual(height);
      expect(box.scroll).toBeLessThanOrEqual(box.client + 2);
    }
    const fan = bounds.find((box) => box.class.includes('art-fan'))!,
      ultimate = bounds.find((box) => box.class.includes('ultimate-panel'))!,
      defense = bounds.find((box) => box.class.includes('defense-panel'))!;
    expect(fan.right).toBeLessThan(ultimate.x);
    expect(ultimate.right).toBeLessThan(defense.x);
    await page.waitForLoadState('networkidle');
    await mkdir(proof, { recursive: true });
    await writeFile(
      `${proof}/layout-${width}x${height}.json`,
      JSON.stringify(
        {
          bounds,
          text: await page
            .locator('.player-name,.xp-line,.defense-panel header b,.health-line')
            .evaluateAll((els) =>
              els.map((el) => ({
                text: el.textContent,
                color: getComputedStyle(el).color,
                box: el.getBoundingClientRect().toJSON(),
              })),
            ),
        },
        null,
        2,
      ),
    );
    await page
      .locator('.player-panel')
      .screenshot({ path: `${proof}/player-${width}x${height}.png` });
    await page.screenshot({
      path: `${proof}/combat-${width}x${height}.png`,
      animations: 'disabled',
    });
  });
}

test('무공 0·1·4개, 보스·궁극 개방과 5개 언어에서 HUD가 화면에 남는다', async ({ browser }) => {
  test.setTimeout(300000);
  await mkdir(proof, { recursive: true });
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
    for (const count of [0, 1, 4]) {
      const context = await browser.newContext({ locale, viewport: { width: 1093, height: 614 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const state = emptyGame();
      startRun(state, '청하연', 123);
      if (count === 4) {
        for (let wave = 1; wave < 5; wave++) {
          state.run!.offers = [];
          state.run!.phase = 'loot';
          command(state, { type: 'next' });
        }
      }
      state.run!.offers = [];
      (state.run!.fighter as BoundFighter).bindings = Object.fromEntries(
        ART_IDS.slice(0, 4).map((id) => [id, state.run!.fighter.items[0].id]),
      );
      state.run!.fighter.arts = ART_IDS.slice(0, count).map((id) => ({
        id,
        level: id === 'samja' ? 8 : 5,
        gauge: 100,
        combo: 0,
        defenseCd: 0,
      }));
      state.run!.enemies.forEach((e) => {
        e.hp = e.maxHp = 100000;
        e.timer = 200;
        e.state = 'windup';
      });
      await page.goto('/');
      await expect(page.locator('.home-scene')).toBeVisible({ timeout: 30000 });
      await page.evaluate(async (state) => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const r = indexedDB.open('mugong-local-v1', 1);
          r.onsuccess = () => resolve(r.result);
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
      await expect(page.locator('.fan-card')).toHaveCount(Math.max(1, count));
      if (count === 4) {
        await expect(page.locator('.boss-panel')).toBeVisible();
        await expect(page.locator('.ultimate-ready')).toBeVisible();
      }
      for (const [width, height] of [
        [1093, 614],
        [760, 614],
        [520, 700],
      ]) {
        await page.setViewportSize({ width, height });
        const failures = await page
          .locator('.hud button,.hud-vitals,.boss-panel,.defense-panel,.ultimate-panel')
          .evaluateAll((els) =>
            els.flatMap((el) => {
              const b = el.getBoundingClientRect(),
                h = el as HTMLElement;
              return b.width &&
                b.height &&
                (b.x < 0 ||
                  b.y < 0 ||
                  b.right > innerWidth + 1 ||
                  b.bottom > innerHeight + 1 ||
                  h.scrollWidth > h.clientWidth + 2 ||
                  h.scrollHeight > h.clientHeight + 2)
                ? [
                    `${el.className}: ${b.x},${b.y},${b.width},${b.height} / ${h.scrollWidth},${h.scrollHeight}`,
                  ]
                : [];
            }),
          );
        expect(failures, `${locale} / ${count} / ${width}`).toEqual([]);
      }
      await page.setViewportSize({ width: 1093, height: 614 });
      if (locale === 'ko' || count === 4)
        await page.screenshot({
          path: `${proof}/state-${locale}-${count}.png`,
          animations: 'disabled',
        });
      expect(errors).toEqual([]);
      await context.close();
    }
  }
});

test('큰 글씨·고대비 설정과 움직임 줄이기에서 HUD 행동이 유지된다', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('mugong-ui-v1', JSON.stringify({ largeHud: true, highContrast: true })),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1093, height: 614 });
  await page.goto('/');
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await page.getByRole('button', { name: '모집권 1장 사용' }).click();
  await page.locator('.recruitment-select').first().click();
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page.locator('.choice-card').first().click();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-large-hud', 'true');
  const overflow = await page
    .locator('.hud-vitals,.wave-ribbon,.ultimate-panel')
    .evaluateAll((els) =>
      els
        .filter(
          (el) => el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2,
        )
        .map((el) => el.className),
    );
  expect(overflow).toEqual([]);
  await expect(page.locator('.fan-card')).toHaveCSS('transition-duration', '0s');
  await page.getByRole('button', { name: '가방 Tab', exact: true }).click();
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '가방 Tab', exact: true })).toBeFocused();
  await page.screenshot({ path: `${proof}/preferences-1093.png`, animations: 'disabled' });
});
