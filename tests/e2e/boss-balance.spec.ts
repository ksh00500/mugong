import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = 'docs/verification/boss-balance-v1/browser';

for (const [width, height, gpu] of [
  [1440, 900, false],
  [1366, 768, false],
  [1093, 614, false],
  [1440, 900, true],
] as const)
  test(`실제 회복 시계·반격 표시·5언어 ${width} ${gpu ? 'WebGL' : 'Canvas'}`, async ({ page }) => {
    test.setTimeout(90000);
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    if (gpu)
      await page.addInitScript(() => {
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          const get = proto.getExtension;
          proto.getExtension = function (name: string) {
            return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
          };
        }
      });
    await page.emulateMedia({ reducedMotion: width === 1093 ? 'reduce' : 'no-preference' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, 4);
    await observeScene(page);
    const result = await page.evaluate(async () => {
      const w = window as any,
        s = w.regionScene;
      const store = (await w.regionModule('/src/platform/store.ts')).gameStore;
      const { tick } = await w.regionModule('/src/domain/game.ts');
      const { bossOpening } = await w.regionModule('/src/domain/boss-recovery.ts');
      const r = store.state.run,
        e = r.enemies.find((x: any) => x.bossId === '4-1');
      store.paused = false;
      s.scene.pause();
      r.enemies = [e];
      r.zones = [];
      r.encounterObjects = [];
      Object.assign(e, {
        x: 960,
        y: 530,
        state: 'windup',
        move: 'slam',
        timer: 0.4,
        aim: 0,
        facing: 0,
        guardTime: 0,
        rageTime: 0,
      });
      r.fighter.x = 1250;
      r.fighter.y = 530;
      const input = { dx: 0, dy: 0, aim: Math.PI, attack: false, defense: false, ultimate: false };
      let contacts = 0;
      for (let i = 0; i < 70; i++)
        tick(r, input, 1 / 60, (c: any) => {
          if (c.kind === 'strike' && !c.friendly) contacts++;
        });
      const at = { x: e.x, y: e.y, timer: e.timer },
        opening = bossOpening(e);
      for (let i = 0; i < 6; i++) tick(r, input, 1 / 60);
      s.draw(r);
      store.notify();
      return {
        renderer: s.game.renderer.type,
        state: e.state,
        opening,
        at,
        after: { x: e.x, y: e.y, timer: e.timer },
        contacts,
      };
    });
    expect(result.state).toBe('recover');
    expect(result.renderer).toBe(gpu ? 2 : 1);
    expect(result.opening).toBeTruthy();
    expect(result.contacts).toBe(1);
    expect(result.after.x).toBe(result.at.x);
    expect(result.after.y).toBe(result.at.y);
    expect(result.after.timer).toBeCloseTo(result.at.timer - 0.1);
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
      await page.evaluate(async (locale) => {
        const w = window as any;
        (await w.regionModule('/src/platform/i18n.ts')).setLanguage(locale);
        (await w.regionModule('/src/platform/store.ts')).gameStore.notify();
      }, locale);
      await expect(page.locator('.boss-panel')).toHaveAttribute('data-boss-opening', 'true');
      const boxes = await page.locator('.boss-panel,.boss-phase').evaluateAll((nodes) =>
        nodes.map((n) => {
          const b = n.getBoundingClientRect();
          return { x: b.x, y: b.y, right: b.right, bottom: b.bottom };
        }),
      );
      expect(boxes[1].x).toBeGreaterThanOrEqual(boxes[0].x);
      expect(boxes[1].right).toBeLessThanOrEqual(boxes[0].right);
      expect(boxes[1].bottom).toBeLessThan(height);
    }
    await page.evaluate(async () => {
      const w = window as any;
      (await w.regionModule('/src/platform/i18n.ts')).setLanguage('ko');
      (await w.regionModule('/src/platform/store.ts')).gameStore.notify();
    });
    await expect(page.locator('.boss-phase')).toContainText('반격 기회');
    if (width === 1093)
      expect(
        await page.locator('.boss-phase').evaluate((n) => getComputedStyle(n).animationName),
      ).toBe('none');
    await page.screenshot({ path: `${proof}/opening-${width}${gpu ? '-webgl' : ''}.png` });
    await page.keyboard.press('Tab');
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.inventory-workspace')).toHaveCount(0);
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/opening-${width}${gpu ? '-webgl' : ''}.json`,
      JSON.stringify(
        { result, errors, locales: 5, bagReturned: true, independentContext: true },
        null,
        2,
      ),
    );
  });
