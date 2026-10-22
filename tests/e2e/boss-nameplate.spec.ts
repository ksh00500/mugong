import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { BOSSES, REGIONS } from '../../src/domain/campaign';
import { xpThreshold } from '../../src/domain/content';
import { messages } from '../../src/platform/messages';
import type { GameState } from '../../src/domain/model';

const proof = process.env.MUGONG_DAYTONA_PROOF
  ? `${process.env.MUGONG_DAYTONA_PROOF}/boss-nameplate`
  : 'docs/verification/boss-nameplate-v1';
async function seed(page: Page, state: GameState) {
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
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
}
for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1093, 614],
  [800, 600],
]) {
  for (const [index, locale] of ['ko-KR', 'en-US', 'ja-JP', 'zh-CN', 'zh-TW'].entries()) {
    if (width !== 1093 && index !== 0) continue;
    test(`보스 이름·체력 숫자와 화면 중앙 정렬 ${width}×${height} ${locale}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ viewport: { width, height }, locale });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const boss =
        index === 0
          ? BOSSES.find((b) => b.name === '철나한 도원')!
          : [...BOSSES].sort(
              (a, b) =>
                (messages[b.name]?.[index - 1]?.length ?? 0) -
                (messages[a.name]?.[index - 1]?.length ?? 0),
            )[0];
      const state = emptyGame();
      startRun(state, '청하연', 123);
      const run = state.run!;
      run.wave = boss.phase * 5;
      run.regionRoute = REGIONS.filter((region) => region.name !== boss.region)
        .slice(0, 4)
        .map((region) => region.name);
      run.regionRoute[Math.floor((run.wave - 1) / 5)] = boss.region;
      run.fighter.level = run.fighter.spent = run.spent = 8;
      run.fighter.xp = xpThreshold(8);
      run.offers = [];
      run.fighter.invulnerable = 10000;
      spawnWave(run);
      run.enemies.forEach((enemy) => {
        enemy.state = 'recover';
        enemy.timer = 10000;
        enemy.hp = 51;
        enemy.maxHp = 330;
      });
      await seed(page, state);
      const panel = page.locator('.boss-panel');
      await expect(panel).toBeVisible();
      await expect(panel.locator('b')).toHaveText(
        index === 0 ? boss.name : messages[boss.name][index - 1],
      );
      await expect(panel.locator('small')).toHaveText('51 / 330');
      const bounds = await panel.evaluate((panel) => {
        const rect = (e: Element) => e.getBoundingClientRect().toJSON();
        return {
          panel: rect(panel),
          title: rect(panel.querySelector('b')!),
          meter: rect(panel.querySelector('.meter')!),
          value: rect(panel.querySelector('small')!),
          frame: rect(panel.querySelector('.hud-artwork')!),
          height: panel.clientHeight,
          scroll: panel.scrollHeight,
        };
      });
      expect(Math.abs(bounds.panel.x + bounds.panel.width / 2 - width / 2)).toBeLessThanOrEqual(1);
      expect(bounds.panel.y).toBeGreaterThanOrEqual(0);
      expect(bounds.panel.bottom).toBeLessThan(height / 2);
      expect(bounds.scroll).toBeLessThanOrEqual(bounds.height + 1);
      expect(bounds.title.x).toBeGreaterThanOrEqual(bounds.frame.x + 24);
      expect(bounds.title.right).toBeLessThanOrEqual(bounds.frame.right - 24);
      expect(bounds.title.y).toBeGreaterThan(bounds.frame.y + 8);
      expect(bounds.title.bottom).toBeLessThanOrEqual(bounds.meter.y - 4);
      expect(bounds.meter.bottom).toBeLessThan(bounds.frame.bottom - 20);
      expect(bounds.meter.right).toBeLessThanOrEqual(bounds.frame.right - 60);
      expect(bounds.value.y).toBe(bounds.meter.y);
      expect(bounds.value.bottom).toBe(bounds.meter.bottom);
      const others = await page
        .locator('.player-panel,.progress-panel')
        .evaluateAll((elements) => elements.map((e) => e.getBoundingClientRect().toJSON()));
      for (const box of others) {
        const overlap =
          Math.min(box.right, bounds.panel.right) - Math.max(box.x, bounds.panel.x) > 1 &&
          Math.min(box.bottom, bounds.panel.bottom) - Math.max(box.y, bounds.panel.y) > 1;
        expect(overlap).toBe(false);
      }
      await mkdir(proof, { recursive: true });
      await page.screenshot({
        path: `${proof}/boss-${width}-${locale}.png`,
        animations: 'disabled',
      });
      await panel.screenshot({ path: `${proof}/nameplate-${width}-${locale}.png` });
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}
