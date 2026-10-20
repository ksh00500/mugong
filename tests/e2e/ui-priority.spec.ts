import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
import { seedLoadingRun } from './support/loading';

const proof = process.env.MUGONG_PRIORITY_PROOF ?? 'docs/verification/ui-priority-v1';
const compiled = !!process.env.MUGONG_PRIORITY_COMPILED;
async function fits(locator: Locator, page: Page) {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  const { width, height } = page.viewportSize()!;
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.y).toBeGreaterThanOrEqual(0);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(width + 1);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(height + 1);
}
async function shot(page: Page, name: string) {
  await mkdir(proof, { recursive: true });
  await page.screenshot({ path: `${proof}/${name}.png`, animations: 'disabled' });
}
async function combat(page: Page) {
  await seedRegion(page, 4);
  await observeScene(page);
  await page.evaluate(async () => {
    const w = window as any;
    w.priorityStore = (await w.regionModule('/src/platform/store.ts')).gameStore;
    const s = w.priorityStore,
      r = s.state.run;
    w.regionScene.scene.pause();
    s.paused = false;
    r.enemies = r.enemies.filter((e: any) => e.bossId === '4-1');
    r.enemies[0].hp = 622;
    r.enemies[0].maxHp = 1000;
    r.enemies[0].x = 900;
    r.enemies[0].y = 500;
    r.fighter.hp = 84;
    r.fighter.arts = ['huashan', 'tang', 'shaolin', 'jegal'].map((id, n) => ({
      id,
      level: 3,
      gauge: n ? 0 : 70,
      combo: 0,
      defenseCd: n ? 0 : 2.4,
    }));
    s.notify();
    w.regionScene.draw(r);
  });
}

if (!compiled)
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1093, 614],
  ]) {
    test(`priority HUD, recruitment and growth fit ${width}x${height}`, async ({ page }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/');
      const open = page.getByRole('button', { name: '새 무인으로 출전 →', exact: true });
      await open.click();
      await page.getByRole('button', { name: '모집권 1장 사용', exact: true }).click();
      const candidate = page.locator('.recruitment-select').nth(1);
      await expect(candidate).toBeEnabled();
      await candidate.focus();
      await expect(candidate).toBeFocused();
      await candidate.press('Enter');
      await expect(candidate).toHaveAttribute('aria-pressed', 'true');
      await page.getByLabel('무인의 이름').fill('우선수정검증');
      const start = page.getByRole('button', { name: '강호에 나서기 →', exact: true });
      await expect(start).toBeEnabled();
      await fits(start, page);
      await fits(page.locator('.recruitment-dialog > header'), page);
      await fits(page.locator('.recruitment-name'), page);
      await shot(page, `recruitment-${width}`);
      await page.keyboard.press('Escape');
      await expect(open).toBeFocused();
      await open.click();
      await expect(page.locator('.recruitment-candidate')).toHaveCount(3);
      await page.locator('.recruitment-select').first().click();
      await page.keyboard.press('Escape');
      await combat(page);
      const scan = await page.evaluate(() => {
        const rows = ['.health-line > span', '.boss-health small', '.xp-line'].map((selector) => {
          const el = document.querySelector<HTMLElement>(selector)!,
            s = getComputedStyle(el);
          return {
            selector,
            text: el.innerText,
            font: parseFloat(s.fontSize),
            background: s.backgroundColor,
            shadow: s.textShadow,
            rect: el.getBoundingClientRect().toJSON(),
          };
        });
        return {
          rows,
          bars: ['.hud-health .meter', '.boss-health .meter'].map((selector) =>
            document.querySelector(selector)!.getBoundingClientRect().toJSON(),
          ),
        };
      });
      for (const [index, row] of scan.rows.entries()) {
        expect(row.font).toBeGreaterThanOrEqual(index === 2 ? 12 : 14);
        if (index < 2) {
          expect(row.background).toBe('rgba(0, 0, 0, 0)');
          expect(row.shadow).toBe('none');
          expect(row.rect.bottom).toBeLessThanOrEqual(scan.bars[index].top);
        }
      }
      await fits(page.locator('.hud-vitals'), page);
      await fits(page.locator('.boss-panel'), page);
      await shot(page, `combat-${width}`);
      await page.evaluate(() => {
        const w = window as any;
        w.priorityStore.state.run.fighter.hp = 22;
        w.priorityStore.notify();
      });
      await shot(page, `critical-${width}`);
      await page.evaluate(() => {
        const w = window as any,
          s = w.priorityStore,
          r = s.state.run,
          f = r.fighter;
        r.phase = 'loot';
        f.trainingPoints = 10;
        f.level = 7;
        f.spent = r.spent = 5;
        r.offers = f.arts.slice(0, 3).map((a: any) => ({ art: a.id, type: 'upgrade' }));
        s.notify();
      });
      await expect(page.locator('.choice-card').first()).toBeEnabled();
      await page.locator('.choice-card').first().focus();
      await page.keyboard.down('Shift');
      await expect(page.locator('.quick-details-inline')).toBeVisible();
      await page.keyboard.up('Shift');
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await page.locator('.growth-detail-link').click();
      const panel = page.locator('.quick-details-inline');
      await expect(panel).toBeVisible();
      await fits(panel, page);
      const bounds = await panel.boundingBox();
      for (const card of await page.locator('.choice-card').all()) {
        await fits(card, page);
        const b = (await card.boundingBox())!;
        expect(b.x + b.width).toBeLessThanOrEqual(bounds!.x);
      }
      await shot(page, `growth-details-${width}`);
      await page.keyboard.press('Escape');
      await expect(page.locator('.growth-detail-link')).toBeFocused();
      await page.locator('.choice-card').first().focus();
      await page.keyboard.press('Enter');
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as any).priorityStore.state.run.fighter.arts.find(
                (a: any) => a.id === 'huashan',
              ).level,
          ),
        )
        .toBe(4);
      expect(errors).toEqual([]);
      await writeFile(
        `${proof}/layout-${width}.json`,
        JSON.stringify(
          {
            width,
            height,
            scan,
            errors,
            recruitmentSelectionPersists: true,
            keyboardGrowthWorks: true,
            detailsDoNotOverlap: true,
          },
          null,
          2,
        ),
      );
    });
  }

for (const renderer of ['webgl', 'canvas'])
  test(`save, suspend and resume twice with ${renderer}${compiled ? ' compiled' : ''}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript((renderer) => {
      if (renderer === 'canvas') {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          kind: string,
          options?: any,
        ) {
          return ['webgl', 'webgl2', 'experimental-webgl'].includes(kind)
            ? null
            : (original as any).call(this, kind, options);
        } as typeof original;
      } else {
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          const original = proto.getExtension;
          proto.getExtension = function (name: string) {
            return name === 'WEBGL_debug_renderer_info' ? null : original.call(this, name);
          };
        }
      }
    }, renderer);
    const state = await seedLoadingRun(page, 4, 5);
    await expect(page.locator('.game-canvas')).toHaveAttribute(
      'data-renderer',
      renderer === 'canvas' ? 'Canvas' : 'WebGL / AUTO',
    );
    for (let cycle = 0; cycle < 2; cycle++) {
      await page.keyboard.press('Escape');
      await expect(page.locator('.pause-menu')).toBeVisible();
      await page.getByRole('button', { name: '저장하고 일시 종료', exact: true }).click();
      await expect(page.locator('.home-scene')).toBeVisible();
      await page.waitForTimeout(250);
      const saved = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const q = indexedDB.open('mugong-local-v1', 1);
          q.onsuccess = () => resolve(q.result);
        });
        return new Promise<any>((resolve) => {
          const q = db.transaction('saves').objectStore('saves').get('current');
          q.onsuccess = () => {
            db.close();
            resolve(q.result);
          };
        });
      });
      expect(saved.run.fighter.id).toBe(state.run!.fighter.id);
      expect(saved.run.wave).toBe(5);
      await page.locator('.home-departure button.primary').click();
      await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
        timeout: 30000,
      });
    }
    await shot(page, `resume-${renderer}${compiled ? '-compiled' : ''}`);
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/resume-${renderer}${compiled ? '-compiled' : ''}.json`,
      JSON.stringify({ errors, cycles: 2, sameFighter: true, sameWave: true }, null, 2),
    );
  });

if (!compiled)
  test('five languages with large HUD, high contrast and reduced motion at 1093', async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 1093, height: 614 });
    await page.addInitScript(() =>
      localStorage.setItem('mugong-ui-v1', JSON.stringify({ largeHud: true, highContrast: true })),
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await combat(page);
    await page.evaluate(async () => {
      const w = window as any,
        r = w.priorityStore.state.run;
      const { xpThreshold } = await w.regionModule('/src/domain/content.ts');
      r.fighter.name = '아주긴무인이름열두글자';
      r.fighter.level = r.fighter.spent = r.spent = 100;
      r.fighter.xp = xpThreshold(100);
      r.fighter.hp = 80;
      w.priorityStore.notify();
    });
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
      await page.evaluate(async (locale) => {
        const w = window as any;
        const { setLanguage } = await w.regionModule('/src/platform/i18n.ts');
        setLanguage(locale);
      }, locale);
      const metrics = await page.locator('.health-line').evaluate((el) => {
        const label = el.querySelector('small')!.getBoundingClientRect(),
          number = el.querySelector('span:not([aria-hidden])')!.getBoundingClientRect();
        return {
          label: label.toJSON(),
          number: number.toJSON(),
          width: el.clientWidth,
          scroll: el.scrollWidth,
        };
      });
      expect(metrics.label.right).toBeLessThanOrEqual(metrics.number.left);
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 1);
      await fits(page.locator('.hud-vitals'), page);
      const title = await page.locator('.player-name b').boundingBox();
      expect(title!.height).toBeLessThanOrEqual(28);
      await shot(page, `hud-large-${locale}`);
    }
    await page.evaluate(() => {
      const w = window as any,
        r = w.priorityStore.state.run;
      r.phase = 'loot';
      r.fighter.level = 7;
      r.fighter.spent = r.spent = 5;
      r.fighter.trainingPoints = 10;
      r.offers = r.fighter.arts.slice(0, 3).map((a: any) => ({ art: a.id, type: 'upgrade' }));
      w.priorityStore.notify();
    });
    await expect(page.locator('.choice-card').first()).toBeEnabled();
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
      await page.evaluate(async (locale) => {
        const w = window as any;
        const { setLanguage } = await w.regionModule('/src/platform/i18n.ts');
        setLanguage(locale);
      }, locale);
      await page.locator('.growth-detail-link').click();
      const panel = page.locator('.quick-details-inline');
      await expect(panel).toBeVisible();
      await fits(panel, page);
      const b = (await panel.boundingBox())!;
      for (const card of await page.locator('.choice-card').all()) {
        await fits(card, page);
        const c = (await card.boundingBox())!;
        expect(c.x + c.width).toBeLessThanOrEqual(b.x);
      }
      await shot(page, `growth-${locale}`);
      await page.keyboard.press('Escape');
    }
    await writeFile(
      `${proof}/language-preferences.json`,
      JSON.stringify(
        {
          viewport: [1093, 614],
          languages: ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'],
          largeHud: true,
          highContrast: true,
          reducedMotion: true,
          noNumberOverlap: true,
          noChoiceOverlap: true,
        },
        null,
        2,
      ),
    );
  });

test(`recruitment start is reachable at 1093${compiled ? ' compiled' : ''}`, async ({ page }) => {
  await page.setViewportSize({ width: 1093, height: 614 });
  await page.goto('/');
  await page.getByRole('button', { name: '새 무인으로 출전 →', exact: true }).click();
  await page.getByRole('button', { name: '모집권 1장 사용', exact: true }).click();
  await page.locator('.recruitment-select').first().click();
  const button = page.locator('.recruitment-actions .primary');
  await fits(button, page);
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await expect(page.locator('.growth')).toBeVisible();
  await expect(page.locator('.choice-card').first()).toBeEnabled();
  await page.locator('.growth-detail-link').click();
  const details = page.locator('.quick-details-inline');
  await expect(details).toBeVisible();
  await fits(details, page);
  const bounds = (await details.boundingBox())!;
  for (const card of await page.locator('.choice-card').all()) {
    await fits(card, page);
    const rect = (await card.boundingBox())!;
    expect(rect.x + rect.width).toBeLessThanOrEqual(bounds.x);
  }
  await shot(page, `initial-growth${compiled ? '-compiled' : ''}`);
  await page.keyboard.press('Escape');
  await page.locator('.choice-card').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.growth')).not.toBeVisible();
});

if (!compiled)
  test('recruitment actions stay visible in all five languages at 1093', async ({ page }) => {
    await page.setViewportSize({ width: 1093, height: 614 });
    await page.goto('/');
    await page.getByRole('button', { name: '새 무인으로 출전 →', exact: true }).click();
    await page.getByRole('button', { name: '모집권 1장 사용', exact: true }).click();
    await page.locator('.recruitment-select').first().click();
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
      await page.evaluate(async (locale) => {
        const path = '/src/platform/i18n.ts';
        const { setLanguage } = await import(/* @vite-ignore */ path);
        setLanguage(locale);
      }, locale);
      await fits(page.locator('.recruitment-dialog > header'), page);
      await fits(page.locator('.recruitment-footer'), page);
      await expect(page.locator('.recruitment-actions .primary')).toBeEnabled();
      await shot(page, `recruitment-${locale}`);
    }
  });
